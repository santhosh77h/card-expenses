"""
Multi-LLM consensus engine.

Aligns transactions from multiple LLM providers, applies majority voting
per field, computes per-transaction confidence scores, and reconciles
card_info / statement_period across providers.
"""

import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from statistics import median

from app.categories import CATEGORY_META, categorize
from app.regex_parsers import infer_transaction_type

logger = logging.getLogger(__name__)


@dataclass
class ConsensusResult:
    transactions: list[dict]
    statement_period: dict | None
    card_info: dict | None
    validation: dict


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_consensus(llm_results: list) -> ConsensusResult:
    """
    Build consensus from multiple LLMResult objects.

    Args:
        llm_results: list of LLMResult (from llm_parser.async_llm_parse_all)

    Returns:
        ConsensusResult with merged transactions and validation metadata.
    """
    if not llm_results:
        return ConsensusResult(
            transactions=[], statement_period=None, card_info=None,
            validation={"confidence": 0.0, "is_validated": False, "llm_count": 0,
                        "llm_sources": [], "consensus_method": "none",
                        "per_transaction_confidence": [], "transactions_flagged": 0},
        )

    provider_count = len(llm_results)
    sources = [r.provider_model for r in llm_results]

    # Single provider — pass through with low confidence
    if provider_count == 1:
        r = llm_results[0]
        per_tx_conf = [0.5] * len(r.transactions)
        return ConsensusResult(
            transactions=r.transactions,
            statement_period=r.statement_period,
            card_info=r.card_info,
            validation={
                "confidence": 0.5,
                "is_validated": False,
                "llm_count": 1,
                "llm_sources": sources,
                "consensus_method": "single_provider",
                "per_transaction_confidence": per_tx_conf,
                "transactions_flagged": len(r.transactions),
            },
        )

    # Multi-provider consensus
    all_tx_lists = [r.transactions for r in llm_results]
    groups = _align_transactions(all_tx_lists, provider_count)

    # Deduplicate within-provider hallucinations
    groups = _deduplicate_groups(groups, provider_count)

    merged_transactions = []
    per_tx_confidence = []

    for group in groups:
        merged_tx, confidence = _vote_transaction(group, provider_count)
        merged_transactions.append(merged_tx)
        per_tx_confidence.append(confidence)

    # Card info & statement period consensus
    merged_card_info = _vote_card_info([r.card_info for r in llm_results if r.card_info])
    merged_statement_period = _vote_statement_period(
        [r.statement_period for r in llm_results if r.statement_period]
    )

    # Overall confidence: amount-weighted average
    overall_confidence = _weighted_confidence(merged_transactions, per_tx_confidence)
    flagged_count = sum(1 for c in per_tx_confidence if c < 0.5)

    logger.info(
        "[consensus] %d providers → %d transactions, confidence=%.3f, flagged=%d",
        provider_count, len(merged_transactions), overall_confidence, flagged_count,
    )

    return ConsensusResult(
        transactions=merged_transactions,
        statement_period=merged_statement_period,
        card_info=merged_card_info,
        validation={
            "confidence": round(overall_confidence, 4),
            "is_validated": provider_count >= 2,
            "llm_count": provider_count,
            "llm_sources": sources,
            "consensus_method": "majority_vote",
            "per_transaction_confidence": [round(c, 4) for c in per_tx_confidence],
            "transactions_flagged": flagged_count,
        },
    )


# ---------------------------------------------------------------------------
# Transaction alignment
# ---------------------------------------------------------------------------

def _normalize_date(date_str: str) -> str | None:
    """Normalize date to YYYY-MM-DD."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except (ValueError, AttributeError):
            continue
    return date_str.strip() if date_str else None


def _normalize_amount(amount) -> float:
    """Normalize amount to rounded float."""
    try:
        return round(float(amount), 2)
    except (ValueError, TypeError):
        return 0.0


def _tx_key(tx: dict) -> tuple[str | None, float]:
    """Primary key: (normalized_date, normalized_amount)."""
    return (_normalize_date(tx.get("date", "")), _normalize_amount(tx.get("amount", 0)))


def _date_nearby(d1: str | None, d2: str | None, tolerance_days: int = 1) -> bool:
    """Check if two YYYY-MM-DD dates are within tolerance_days."""
    if not d1 or not d2:
        return False
    try:
        dt1 = datetime.strptime(d1, "%Y-%m-%d")
        dt2 = datetime.strptime(d2, "%Y-%m-%d")
        return abs((dt1 - dt2).days) <= tolerance_days
    except ValueError:
        return d1 == d2


def _desc_similar(d1: str, d2: str, threshold: float = 0.6) -> bool:
    """Fuzzy description match using SequenceMatcher."""
    if not d1 or not d2:
        return False
    return SequenceMatcher(None, d1.lower(), d2.lower()).ratio() > threshold


def _align_transactions(all_tx_lists: list[list[dict]], provider_count: int) -> list[list[dict]]:
    """
    Align transactions from multiple providers into groups.

    Each group contains 1-N transactions that represent the same real transaction.
    """
    # Tag each transaction with its provider index
    tagged: list[tuple[int, dict]] = []
    for provider_idx, tx_list in enumerate(all_tx_lists):
        for tx in tx_list:
            tagged.append((provider_idx, tx))

    # Pass 1: Exact match on (date, amount)
    key_groups: dict[tuple, list[tuple[int, dict]]] = {}
    unmatched: list[tuple[int, dict]] = []

    for provider_idx, tx in tagged:
        key = _tx_key(tx)
        if key[0] is not None and key[1] != 0.0:
            key_groups.setdefault(key, []).append((provider_idx, tx))
        else:
            unmatched.append((provider_idx, tx))

    groups: list[list[dict]] = []
    still_unmatched: list[tuple[int, dict]] = []

    for key, members in key_groups.items():
        # Only group members from different providers
        groups_by_provider = _split_by_provider(members)
        for group in groups_by_provider:
            groups.append([tx for _, tx in group])

    # Pass 2: Date tolerance (±1 day) + exact amount for unmatched
    for provider_idx, tx in unmatched:
        matched = False
        tx_key = _tx_key(tx)
        for group in groups:
            existing_key = _tx_key(group[0])
            if (_date_nearby(tx_key[0], existing_key[0])
                    and abs(tx_key[1] - existing_key[1]) < 0.01):
                # Check we don't already have this provider in the group
                if not _provider_in_group(provider_idx, group, all_tx_lists):
                    group.append(tx)
                    matched = True
                    break
        if not matched:
            still_unmatched.append((provider_idx, tx))

    # Pass 3: Fuzzy description + amount equality for remaining unmatched
    final_unmatched: list[tuple[int, dict]] = []
    for provider_idx, tx in still_unmatched:
        matched = False
        tx_amt = _normalize_amount(tx.get("amount", 0))
        for group in groups:
            existing_amt = _normalize_amount(group[0].get("amount", 0))
            if (abs(tx_amt - existing_amt) < 0.01
                    and _desc_similar(tx.get("description", ""), group[0].get("description", ""))):
                if not _provider_in_group(provider_idx, group, all_tx_lists):
                    group.append(tx)
                    matched = True
                    break
        if not matched:
            final_unmatched.append((provider_idx, tx))

    # Remaining unmatched become single-entry groups
    for _, tx in final_unmatched:
        groups.append([tx])

    logger.debug("[align] %d groups from %d providers, %d unmatched singletons",
                 len(groups), provider_count, len(final_unmatched))
    return groups


def _split_by_provider(members: list[tuple[int, dict]]) -> list[list[tuple[int, dict]]]:
    """
    Split same-key members ensuring at most one per provider per group.

    If multiple transactions from the same provider have the same key,
    they form separate groups (could be real duplicate charges).
    """
    groups: list[list[tuple[int, dict]]] = []
    for provider_idx, tx in members:
        placed = False
        for group in groups:
            providers_in_group = {p for p, _ in group}
            if provider_idx not in providers_in_group:
                group.append((provider_idx, tx))
                placed = True
                break
        if not placed:
            groups.append([(provider_idx, tx)])
    return groups


def _provider_in_group(provider_idx: int, group: list[dict], all_tx_lists: list[list[dict]]) -> bool:
    """Check if a provider already has a transaction in this group."""
    for gtx in group:
        for pidx, tx_list in enumerate(all_tx_lists):
            if pidx == provider_idx and gtx in tx_list:
                return True
    return False


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _deduplicate_groups(groups: list[list[dict]], provider_count: int) -> list[list[dict]]:
    """
    Handle within-provider duplicate detection.

    If a (date, amount) appears in duplicate groups:
    - Groups have different majority types (credit vs debit) → keep both (real distinct transactions)
    - All providers show it with same type → real duplicate, keep
    - Only 1 provider shows it with same type → likely hallucination, drop the extra
    """
    key_to_groups: dict[tuple, list[int]] = {}
    for i, group in enumerate(groups):
        key = _tx_key(group[0])
        key_to_groups.setdefault(key, []).append(i)

    indices_to_drop: set[int] = set()
    for key, group_indices in key_to_groups.items():
        if len(group_indices) <= 1:
            continue

        # Determine the majority type for each group
        group_types = []
        for gi in group_indices:
            types = [tx.get("type", "debit") for tx in groups[gi]]
            majority_type = Counter(types).most_common(1)[0][0]
            group_types.append(majority_type)

        # If groups have different types (e.g. one credit, one debit), they
        # represent genuinely different transactions — keep all of them.
        if len(set(group_types)) > 1:
            logger.debug(
                "[dedup] Keeping groups with different types for key %s: %s",
                key, group_types,
            )
            continue

        # Same type — original logic: drop single-provider extras as hallucinations
        for gi in group_indices[1:]:  # Keep the first, evaluate the rest
            group = groups[gi]
            if len(group) == 1:
                # Only one provider reported this duplicate — likely hallucination
                logger.debug("[dedup] Dropping likely hallucinated duplicate: %s", key)
                indices_to_drop.add(gi)

    if indices_to_drop:
        groups = [g for i, g in enumerate(groups) if i not in indices_to_drop]

    return groups


# ---------------------------------------------------------------------------
# Majority voting
# ---------------------------------------------------------------------------

def _vote_transaction(group: list[dict], provider_count: int) -> tuple[dict, float]:
    """
    Majority-vote merge a group of aligned transactions.

    Returns (merged_transaction, confidence_score).
    """
    n = len(group)

    # Amount: majority vote, fallback to median
    amounts = [_normalize_amount(tx.get("amount", 0)) for tx in group]
    amount_counter = Counter(amounts)
    amount_winner, amount_votes = amount_counter.most_common(1)[0]
    if amount_votes == 1 and len(amounts) > 1:
        amount_winner = round(median(amounts), 2)

    # Date: majority vote, fallback to median-closest
    dates = [_normalize_date(tx.get("date", "")) for tx in group]
    dates_clean = [d for d in dates if d]
    date_counter = Counter(dates_clean)
    if date_counter:
        date_winner, _ = date_counter.most_common(1)[0]
    else:
        date_winner = dates[0] if dates else None

    # Type: strict majority
    types = [tx.get("type", "debit") for tx in group]
    type_counter = Counter(types)
    type_winner, _ = type_counter.most_common(1)[0]

    # Category: majority, tiebreak with keyword categorizer
    categories = [tx.get("category", "Other") for tx in group]
    cat_counter = Counter(categories)
    cat_winner, cat_votes = cat_counter.most_common(1)[0]
    if cat_votes == 1 and len(categories) > 1:
        # All different — pick first non-"Other", else use keyword categorizer
        non_other = [c for c in categories if c != "Other"]
        if non_other:
            cat_winner = non_other[0]
        else:
            desc = max((tx.get("description", "") for tx in group), key=len, default="")
            keyword_cat = categorize(desc)
            cat_winner = keyword_cat["name"]

    # Transaction type: majority vote, tiebreak with keyword inference
    tx_types = [tx.get("transaction_type", "purchase") for tx in group]
    tx_type_counter = Counter(tx_types)
    tx_type_winner, tx_type_votes = tx_type_counter.most_common(1)[0]
    if tx_type_votes == 1 and len(tx_types) > 1:
        # All different — tiebreak with keyword inference
        desc_for_infer = max((tx.get("description", "") for tx in group), key=len, default="")
        tx_type_winner = infer_transaction_type(desc_for_infer, type_winner)

    # Description: pick the longest
    descriptions = [tx.get("description", "") for tx in group]
    desc_winner = max(descriptions, key=len, default="")

    # Category metadata
    meta = CATEGORY_META.get(cat_winner, CATEGORY_META.get("Other", {"color": "#6B7280", "icon": "file-text"}))

    merged = {
        "date": date_winner,
        "description": desc_winner,
        "amount": amount_winner,
        "type": type_winner,
        "category": cat_winner,
        "category_color": meta["color"],
        "category_icon": meta["icon"],
        "transaction_type": tx_type_winner,
    }

    # Confidence scoring
    confidence = _score_confidence(group, merged, provider_count)

    return merged, confidence


def _score_confidence(group: list[dict], merged: dict, provider_count: int) -> float:
    """Compute per-transaction confidence based on agreement."""
    n = len(group)

    if n >= 3:
        # Check field-level agreement
        all_agree = all(
            _normalize_amount(tx.get("amount", 0)) == merged["amount"]
            and _normalize_date(tx.get("date", "")) == merged["date"]
            and tx.get("type") == merged["type"]
            and tx.get("category") == merged["category"]
            and tx.get("transaction_type", "purchase") == merged.get("transaction_type", "purchase")
            for tx in group
        )
        if all_agree:
            return 1.0
        else:
            return 0.85
    elif n == 2:
        return 0.7
    else:
        # Only 1 provider found this transaction
        return 0.4


# ---------------------------------------------------------------------------
# Card info & statement period voting
# ---------------------------------------------------------------------------

def _vote_card_info(card_infos: list[dict]) -> dict | None:
    """Majority vote on each card_info field across providers."""
    if not card_infos:
        return None

    fields = ["card_last4", "card_network", "credit_limit", "total_amount_due",
              "minimum_amount_due", "payment_due_date", "currency"]
    numeric_fields = {"credit_limit", "total_amount_due", "minimum_amount_due"}

    merged = {}
    for f in fields:
        values = [ci.get(f) for ci in card_infos if ci.get(f) is not None]
        if not values:
            merged[f] = None
            continue
        counter = Counter(str(v) for v in values)
        winner_str, _ = counter.most_common(1)[0]
        # Restore original type
        for ci in card_infos:
            if str(ci.get(f)) == winner_str:
                merged[f] = ci[f]
                break

    # Variance check for numeric fields: if providers disagree by >10%, null it out
    if len(card_infos) >= 2:
        for f in numeric_fields:
            numeric_values = [
                float(ci[f]) for ci in card_infos
                if ci.get(f) is not None
            ]
            if len(numeric_values) >= 2:
                max_val = max(numeric_values)
                min_val = min(numeric_values)
                if max_val > 0 and (max_val - min_val) / max_val > 0.10:
                    logger.warning(
                        "[consensus] Providers disagree on %s (values: %s) — nulling for safety",
                        f, numeric_values,
                    )
                    merged[f] = None

    return merged


def _vote_statement_period(periods: list[dict]) -> dict | None:
    """Majority vote on statement period across providers."""
    if not periods:
        return None

    from_dates = [p.get("from") for p in periods if p.get("from")]
    to_dates = [p.get("to") for p in periods if p.get("to")]

    from_winner = Counter(from_dates).most_common(1)[0][0] if from_dates else None
    to_winner = Counter(to_dates).most_common(1)[0][0] if to_dates else None

    return {"from": from_winner, "to": to_winner}


# ---------------------------------------------------------------------------
# Overall confidence
# ---------------------------------------------------------------------------

def _weighted_confidence(transactions: list[dict], per_tx_confidence: list[float]) -> float:
    """Amount-weighted average of per-transaction confidence scores."""
    if not transactions or not per_tx_confidence:
        return 0.0

    total_weight = 0.0
    weighted_sum = 0.0
    for tx, conf in zip(transactions, per_tx_confidence):
        weight = abs(_normalize_amount(tx.get("amount", 0))) + 0.01  # avoid zero weight
        weighted_sum += conf * weight
        total_weight += weight

    return weighted_sum / total_weight if total_weight > 0 else 0.0

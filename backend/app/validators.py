"""
Post-extraction validation for card_info fields.

Cross-references card_info values against the computed transaction summary
to catch common LLM misextraction patterns. Philosophy: null over wrong —
a missing value hides the UI field; a wrong value actively misleads.

Corroboration logic: When the LLM extracts both total_amount_due AND
minimum_amount_due as distinct values with a plausible ratio (minimum is
1–20% of total), the values likely came from the Account Summary section
rather than transaction totals. In that case, Rules 1 & 2 are skipped to
avoid false-positive nulling (e.g. when previous balance was fully paid off
and total_amount_due legitimately equals total_debits).
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

TOLERANCE = 0.05          # 5% relative tolerance for Rules 3-5
TOLERANCE_STRICT = 0.02   # 2% stricter tolerance for Rules 1 & 2 (transaction-sum comparisons)


def _close(a: float, b: float, tol: float = TOLERANCE) -> bool:
    """Check if two values are within relative tolerance of each other."""
    if b == 0:
        return a == 0
    return abs(a - b) / abs(b) <= tol


def _has_corroborating_minimum(total: Optional[float], minimum: Optional[float]) -> bool:
    """
    Check if minimum_amount_due corroborates total_amount_due.

    Returns True when both values are present, distinct, and minimum is
    between 1% and 20% of total — the typical range for credit card
    minimum payments. This indicates the LLM read from the Account Summary
    section (not transaction totals), so we trust the extraction.
    """
    if total is None or minimum is None or total <= 0:
        return False
    ratio = minimum / total
    return 0.01 <= ratio <= 0.20


def validate_card_info(card_info: Optional[dict], summary: dict) -> Optional[dict]:
    """
    Validate and fix card_info against the computed transaction summary.

    Rules (applied in order):
    1. total ≈ total_credits → null out total (LLM confused credits with dues)
       — SKIPPED if minimum_amount_due corroborates total
    2. total ≈ total_debits → null out total (LLM used transaction sum)
       — SKIPPED if minimum_amount_due corroborates total
    3. total ≈ minimum → null out total (indistinguishable; minimum is more reliable)
    4. total < minimum → swap them (unambiguous error)
    5. minimum ≈ total_credits or total_debits → null out minimum

    Returns a new dict (never mutates the original).
    """
    if not card_info:
        return card_info

    result = dict(card_info)

    total = result.get("total_amount_due")
    minimum = result.get("minimum_amount_due")
    summary_credits = summary.get("total_credits", 0)
    summary_debits = summary.get("total_debits", 0)

    corroborated = _has_corroborating_minimum(total, minimum)

    # Rule 1: total matches total_credits
    if total is not None and summary_credits > 0 and _close(total, summary_credits, TOLERANCE_STRICT):
        if corroborated:
            logger.info(
                "[validate_card_info] Rule 1 SKIPPED: total_amount_due (%.2f) ≈ total_credits (%.2f) "
                "but minimum_amount_due (%.2f) corroborates — keeping total",
                total, summary_credits, minimum,
            )
        else:
            logger.warning(
                "[validate_card_info] Rule 1: total_amount_due (%.2f) ≈ total_credits (%.2f) — nulling total",
                total, summary_credits,
            )
            result["total_amount_due"] = None
            total = None

    # Rule 2: total matches total_debits
    if total is not None and summary_debits > 0 and _close(total, summary_debits, TOLERANCE_STRICT):
        if corroborated:
            logger.info(
                "[validate_card_info] Rule 2 SKIPPED: total_amount_due (%.2f) ≈ total_debits (%.2f) "
                "but minimum_amount_due (%.2f) corroborates — keeping total",
                total, summary_debits, minimum,
            )
        else:
            logger.warning(
                "[validate_card_info] Rule 2: total_amount_due (%.2f) ≈ total_debits (%.2f) — nulling total",
                total, summary_debits,
            )
            result["total_amount_due"] = None
            total = None

    # Rule 3: total == minimum (same value in both fields)
    if total is not None and minimum is not None and _close(total, minimum):
        logger.warning(
            "[validate_card_info] Rule 3: total_amount_due (%.2f) ≈ minimum_amount_due (%.2f) — nulling total",
            total, minimum,
        )
        result["total_amount_due"] = None
        total = None

    # Rule 4: total < minimum → swap
    if total is not None and minimum is not None and total < minimum:
        logger.warning(
            "[validate_card_info] Rule 4: total_amount_due (%.2f) < minimum_amount_due (%.2f) — swapping",
            total, minimum,
        )
        result["total_amount_due"] = minimum
        result["minimum_amount_due"] = total
        total = result["total_amount_due"]
        minimum = result["minimum_amount_due"]

    # Rule 5: minimum matches total_credits or total_debits
    if minimum is not None and summary_credits > 0 and _close(minimum, summary_credits):
        logger.warning(
            "[validate_card_info] Rule 5a: minimum_amount_due (%.2f) ≈ total_credits (%.2f) — nulling minimum",
            minimum, summary_credits,
        )
        result["minimum_amount_due"] = None

    if minimum is not None and summary_debits > 0 and _close(minimum, summary_debits):
        logger.warning(
            "[validate_card_info] Rule 5b: minimum_amount_due (%.2f) ≈ total_debits (%.2f) — nulling minimum",
            minimum, summary_debits,
        )
        result["minimum_amount_due"] = None

    return result

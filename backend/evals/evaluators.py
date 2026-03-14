"""
Custom evaluators for Vector statement parser.

Each evaluator takes (predicted, expected) dicts and returns a score
between 0.0 and 1.0. Designed to work with LangSmith evaluation framework.
"""

from datetime import datetime


def transaction_count_accuracy(predicted: dict, expected: dict) -> float:
    """Measure how close the predicted transaction count is to expected."""
    pred_count = len(predicted.get("transactions", []))
    exp_count = expected.get("transaction_count", 0)
    if exp_count == 0:
        return 1.0 if pred_count == 0 else 0.0
    return max(0.0, 1.0 - abs(pred_count - exp_count) / exp_count)


def amount_match_accuracy(predicted: dict, expected: dict) -> float:
    """Percentage of (date, amount) pairs that match exactly."""
    pred_txns = predicted.get("transactions", [])
    exp_txns = expected.get("transactions", [])

    if not exp_txns:
        return 1.0 if not pred_txns else 0.0

    pred_pairs = {(_norm_date(t.get("date", "")), round(t.get("amount", 0), 2)) for t in pred_txns}
    matches = 0
    for t in exp_txns:
        pair = (_norm_date(t.get("date", "")), round(t.get("amount", 0), 2))
        if pair in pred_pairs:
            matches += 1

    return matches / len(exp_txns)


def type_classification_accuracy(predicted: dict, expected: dict) -> float:
    """Percentage of matched transactions with correct debit/credit type."""
    return _field_accuracy(predicted, expected, "type")


def category_accuracy(predicted: dict, expected: dict) -> float:
    """Percentage of matched transactions with correct category."""
    return _field_accuracy(predicted, expected, "category")


def transaction_type_accuracy(predicted: dict, expected: dict) -> float:
    """Percentage of matched transactions with correct transaction_type."""
    return _field_accuracy(predicted, expected, "transaction_type")


def card_info_accuracy(predicted: dict, expected: dict) -> float:
    """Percentage of card_info fields correctly extracted."""
    pred_info = predicted.get("card_info") or {}
    exp_info = expected.get("card_info") or {}

    if not exp_info:
        return 1.0

    matches = 0
    total = 0
    for key, exp_val in exp_info.items():
        if exp_val is None:
            continue
        total += 1
        pred_val = pred_info.get(key)
        if isinstance(exp_val, float) and isinstance(pred_val, (int, float)):
            if abs(float(pred_val) - exp_val) < 0.01:
                matches += 1
        elif str(pred_val) == str(exp_val):
            matches += 1

    return matches / total if total > 0 else 1.0


def intelligence_accuracy(predicted: dict, expected: dict) -> float:
    """Country + currency + bank detection accuracy."""
    pred_intel = {
        "country": predicted.get("country_detected", ""),
        "currency": predicted.get("currency_detected", ""),
        "bank": predicted.get("bank_detected", ""),
    }
    exp_intel = expected.get("intelligence", {})

    if not exp_intel:
        return 1.0

    matches = 0
    total = 0
    for key, exp_val in exp_intel.items():
        if exp_val is None:
            continue
        total += 1
        pred_val = pred_intel.get(key, "")
        if pred_val.lower() == exp_val.lower():
            matches += 1

    return matches / total if total > 0 else 1.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _norm_date(date_str: str) -> str:
    """Normalize date to YYYY-MM-DD."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except (ValueError, AttributeError):
            continue
    return date_str.strip()


def _field_accuracy(predicted: dict, expected: dict, field: str) -> float:
    """Percentage of matched txns where a given field is correct."""
    pred_txns = predicted.get("transactions", [])
    exp_txns = expected.get("transactions", [])

    if not exp_txns:
        return 1.0

    # Build lookup: (date, amount) → predicted transaction
    pred_lookup = {}
    for t in pred_txns:
        key = (_norm_date(t.get("date", "")), round(t.get("amount", 0), 2))
        pred_lookup[key] = t

    matches = 0
    matched_count = 0
    for t in exp_txns:
        key = (_norm_date(t.get("date", "")), round(t.get("amount", 0), 2))
        pred_t = pred_lookup.get(key)
        if pred_t:
            matched_count += 1
            exp_val = t.get(field, "")
            pred_val = pred_t.get(field, "")
            if str(pred_val).lower() == str(exp_val).lower():
                matches += 1

    return matches / matched_count if matched_count > 0 else 0.0


# All evaluators for easy iteration
ALL_EVALUATORS = {
    "transaction_count_accuracy": transaction_count_accuracy,
    "amount_match_accuracy": amount_match_accuracy,
    "type_classification_accuracy": type_classification_accuracy,
    "category_accuracy": category_accuracy,
    "transaction_type_accuracy": transaction_type_accuracy,
    "card_info_accuracy": card_info_accuracy,
    "intelligence_accuracy": intelligence_accuracy,
}

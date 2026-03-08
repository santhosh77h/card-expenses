"""
Bank and currency detection from PDF statement text.
"""

BANK_KEYWORDS: dict[str, list[str]] = {
    "hdfc": ["hdfc bank", "hdfc credit card", "hdfcbank"],
    "icici": ["icici bank", "icici credit card"],
    "sbi": ["sbi card", "state bank of india", "sbicard"],
    "axis": ["axis bank", "axis credit card"],
    "chase": ["chase", "jpmorgan chase"],
    "amex": ["american express", "amex", "membership rewards"],
    "citi": ["citibank", "citi credit card", "citi card"],
}

BANK_CURRENCIES: dict[str, str] = {
    "hdfc": "INR", "icici": "INR", "sbi": "INR", "axis": "INR",
    "chase": "USD", "citi": "USD", "amex": "USD",
}


def detect_bank(text: str) -> str:
    """Identify the issuing bank from statement text. Returns bank key or 'generic'."""
    text_lower = text.lower()
    for bank, keywords in BANK_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return bank
    return "generic"


def detect_currency(text: str, bank: str) -> str:
    """Detect ISO 4217 currency code from statement text and bank identity."""
    if bank in BANK_CURRENCIES:
        return BANK_CURRENCIES[bank]

    text_lower = text.lower()
    if any(s in text_lower for s in ["rs.", "rs ", "inr", "\u20b9"]):
        return "INR"
    if any(s in text_lower for s in ["$", "usd"]):
        return "USD"
    if any(s in text_lower for s in ["\u20ac", "eur"]):
        return "EUR"
    if any(s in text_lower for s in ["\u00a3", "gbp"]):
        return "GBP"

    return "INR"

"""
Bank, currency, and region detection from PDF statement text.
"""

import logging

logger = logging.getLogger(__name__)

BANK_KEYWORDS: dict[str, list[str]] = {
    # India
    "hdfc": ["hdfc bank", "hdfc credit card", "hdfcbank"],
    "icici": ["icici bank", "icici credit card"],
    "sbi": ["sbi card", "state bank of india", "sbicard"],
    "axis": ["axis bank", "axis credit card"],
    "kotak": ["kotak mahindra", "kotak bank", "kotak credit card"],
    "yes_bank": ["yes bank"],
    "indusind": ["indusind bank", "indusind credit card"],
    "rbl": ["rbl bank", "rbl credit card"],
    "federal": ["federal bank"],
    "idfc_first": ["idfc first", "idfc bank"],
    "au_bank": ["au small finance", "au bank"],
    "bob": ["bank of baroda"],
    "canara": ["canara bank"],
    "pnb": ["punjab national bank", "pnb"],
    # US
    "chase": ["chase", "jpmorgan chase"],
    "citi": ["citibank", "citi credit card", "citi card"],
    "bofa": ["bank of america"],
    "wells_fargo": ["wells fargo"],
    "capital_one": ["capital one"],
    "discover": ["discover", "discover card", "discover it"],
    "us_bank": ["u.s. bank", "us bank", "usbank"],
    "synchrony": ["synchrony bank", "synchrony financial"],
    "pnc_us": ["pnc bank", "pnc financial"],
    "td_bank": ["td bank"],
    "usaa": ["usaa"],
    "barclays_us": ["barclays us", "barclaycard us"],
    # UK
    "barclays_uk": ["barclays", "barclaycard"],
    "hsbc_uk": ["hsbc uk", "hsbc credit card"],
    "natwest": ["natwest", "national westminster"],
    "lloyds": ["lloyds bank", "lloyds credit card"],
    "santander_uk": ["santander uk"],
    "halifax": ["halifax"],
    "nationwide": ["nationwide building society", "nationwide credit card"],
    "virgin_money": ["virgin money"],
    "tesco_bank": ["tesco bank", "tesco credit card"],
    "ms_bank": ["m&s bank", "marks and spencer bank"],
    "john_lewis": ["john lewis financial", "john lewis partnership card"],
    "metro_bank": ["metro bank"],
    "monzo": ["monzo"],
    "starling": ["starling bank"],
    # Multi-country
    "amex": ["american express", "amex", "membership rewards"],
    "hsbc": ["hsbc"],
}

BANK_CURRENCIES: dict[str, str] = {
    # India
    "hdfc": "INR", "icici": "INR", "sbi": "INR", "axis": "INR",
    "kotak": "INR", "yes_bank": "INR", "indusind": "INR", "rbl": "INR",
    "federal": "INR", "idfc_first": "INR", "au_bank": "INR",
    "bob": "INR", "canara": "INR", "pnb": "INR",
    # US
    "chase": "USD", "citi": "USD", "bofa": "USD", "wells_fargo": "USD",
    "capital_one": "USD", "discover": "USD", "us_bank": "USD",
    "synchrony": "USD", "pnc_us": "USD", "td_bank": "USD",
    "usaa": "USD", "barclays_us": "USD",
    # UK
    "barclays_uk": "GBP", "hsbc_uk": "GBP", "natwest": "GBP",
    "lloyds": "GBP", "santander_uk": "GBP", "halifax": "GBP",
    "nationwide": "GBP", "virgin_money": "GBP", "tesco_bank": "GBP",
    "ms_bank": "GBP", "john_lewis": "GBP", "metro_bank": "GBP",
    "monzo": "GBP", "starling": "GBP",
}

BANK_REGIONS: dict[str, str | None] = {
    # India
    "hdfc": "IN", "icici": "IN", "sbi": "IN", "axis": "IN",
    "kotak": "IN", "yes_bank": "IN", "indusind": "IN", "rbl": "IN",
    "federal": "IN", "idfc_first": "IN", "au_bank": "IN",
    "bob": "IN", "canara": "IN", "pnb": "IN",
    # US
    "chase": "US", "citi": "US", "bofa": "US", "wells_fargo": "US",
    "capital_one": "US", "discover": "US", "us_bank": "US",
    "synchrony": "US", "pnc_us": "US", "td_bank": "US",
    "usaa": "US", "barclays_us": "US",
    # UK
    "barclays_uk": "UK", "hsbc_uk": "UK", "natwest": "UK",
    "lloyds": "UK", "santander_uk": "UK", "halifax": "UK",
    "nationwide": "UK", "virgin_money": "UK", "tesco_bank": "UK",
    "ms_bank": "UK", "john_lewis": "UK", "metro_bank": "UK",
    "monzo": "UK", "starling": "UK",
    # Multi-country (resolved via currency fallback)
    "amex": None, "hsbc": None,
}

_CURRENCY_TO_REGION: dict[str, str] = {
    "INR": "IN",
    "USD": "US",
    "GBP": "UK",
    "EUR": "UK",  # EUR statements most likely UK-adjacent context
}


def detect_bank(text: str) -> str:
    """Identify the issuing bank from statement text. Returns bank key or 'generic'."""
    text_lower = text.lower()
    # Check more specific bank keys first (e.g., "hsbc_uk" before "hsbc")
    # Sort by keyword length descending so longer/more-specific matches win
    for bank, keywords in sorted(
        BANK_KEYWORDS.items(),
        key=lambda item: max(len(kw) for kw in item[1]),
        reverse=True,
    ):
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
    if any(s in text_lower for s in ["\u00a3", "gbp"]):
        return "GBP"
    if any(s in text_lower for s in ["\u20ac", "eur"]):
        return "EUR"

    return "INR"


def detect_region(text: str, bank: str, currency: str) -> str:
    """
    Detect the statement's region/country for prompt selection.

    Resolution order:
    1. Bank-based region (if bank maps to a single region)
    2. Currency-based fallback (for multi-country banks like Amex/HSBC)
    3. Text clue fallback (currency symbols)
    4. Default: "IN"
    """
    # 1. Bank-based
    if bank in BANK_REGIONS:
        region = BANK_REGIONS[bank]
        if region is not None:
            logger.debug("Region from bank '%s': %s", bank, region)
            return region

    # 2. Currency-based
    if currency in _CURRENCY_TO_REGION:
        region = _CURRENCY_TO_REGION[currency]
        logger.debug("Region from currency '%s': %s", currency, region)
        return region

    # 3. Text clue fallback
    text_lower = text.lower()
    if any(s in text_lower for s in ["\u20b9", "rs.", "rs ", "inr"]):
        return "IN"
    if any(s in text_lower for s in ["\u00a3", "gbp"]):
        return "UK"
    if any(s in text_lower for s in ["$", "usd"]):
        return "US"

    # 4. Default
    return "IN"

"""
Bank-specific regex parsers for credit card statement text.

Supports HDFC, ICICI, SBI, Axis, Chase, Amex, Citi, and a generic fallback.
Each parser returns a list of transaction dicts with keys:
  date (YYYY-MM-DD), description, amount (float), type (debit|credit)
"""

import re
from datetime import datetime
from typing import Callable, Optional

# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

INDIAN_DATE_PATTERNS = [
    (r"(\d{2})/(\d{2})/(\d{4})", "%d/%m/%Y"),
    (r"(\d{2})-(\d{2})-(\d{4})", "%d-%m-%Y"),
    (r"(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})", None),
    (r"(\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{4})", None),
]

US_DATE_PATTERNS = [
    (r"(\d{2})/(\d{2})/(\d{4})", "%m/%d/%Y"),
    (r"(\d{2})/(\d{2})/(\d{2})", "%m/%d/%y"),
    (r"(\d{2})-(\d{2})-(\d{4})", "%m-%d-%Y"),
]

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_indian_date(date_str: str) -> Optional[str]:
    date_str = date_str.strip()
    for pattern, fmt in INDIAN_DATE_PATTERNS:
        m = re.match(pattern, date_str, re.IGNORECASE)
        if not m:
            continue
        if fmt:
            try:
                return datetime.strptime(m.group(0), fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        else:
            day, mon_str, year = m.group(1), m.group(2), m.group(3)
            mon = _MONTH_MAP.get(mon_str.lower()[:3])
            if mon:
                try:
                    return datetime(int(year), mon, int(day)).strftime("%Y-%m-%d")
                except ValueError:
                    continue
    return None


def parse_us_date(date_str: str) -> Optional[str]:
    date_str = date_str.strip()
    for pattern, fmt in US_DATE_PATTERNS:
        m = re.match(pattern, date_str)
        if m:
            try:
                return datetime.strptime(m.group(0), fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None


# ---------------------------------------------------------------------------
# Amount parsing
# ---------------------------------------------------------------------------

def parse_amount(amount_str: str) -> Optional[float]:
    cleaned = amount_str.strip()
    cleaned = re.sub(r"Rs\.?|INR|USD|\$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[,\s]", "", cleaned)
    cleaned = cleaned.replace("(", "").replace(")", "")
    if not cleaned:
        return None
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


_CREDIT_KEYWORDS = ("cr", "credit", "refund", "cashback", "reversal", "cr.")


def _is_credit(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in _CREDIT_KEYWORDS)


# ---------------------------------------------------------------------------
# Indian bank parsers
# ---------------------------------------------------------------------------

def _parse_indian_bank(text: str, pattern: re.Pattern) -> list[dict]:
    """Shared logic for Indian bank parsers (HDFC, ICICI, SBI, Axis)."""
    transactions = []
    for m in pattern.finditer(text):
        date = parse_indian_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(3))
        if amount is None:
            continue
        cr_dr = m.group(4)
        tx_type = "credit" if (cr_dr and cr_dr.lower() == "cr") or _is_credit(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_hdfc(text: str) -> list[dict]:
    """HDFC Bank: DD/MM/YYYY  Description  Amount  Cr/Dr"""
    return _parse_indian_bank(text, re.compile(
        r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    ))


def parse_icici(text: str) -> list[dict]:
    """ICICI Bank: DD-Mon-YYYY or DD/MM/YYYY  Description  Amount"""
    return _parse_indian_bank(text, re.compile(
        r"(\d{2}[-/]\w{3}[-/]\d{4}|\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    ))


def parse_sbi(text: str) -> list[dict]:
    """SBI Card: DD Mon YYYY  Description  Amount"""
    return _parse_indian_bank(text, re.compile(
        r"(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s+"
        r"(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    ))


def parse_axis(text: str) -> list[dict]:
    """Axis Bank: DD-MM-YYYY  Description  Amount"""
    return _parse_indian_bank(text, re.compile(
        r"(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    ))


# ---------------------------------------------------------------------------
# US bank parsers
# ---------------------------------------------------------------------------

def _parse_us_bank(text: str, pattern: re.Pattern) -> list[dict]:
    """Shared logic for US bank parsers (Chase, Amex, Citi)."""
    transactions = []
    for m in pattern.finditer(text):
        date = parse_us_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(4))
        if amount is None:
            continue
        tx_type = "credit" if m.group(3) == "-" or _is_credit(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_chase(text: str) -> list[dict]:
    """Chase: MM/DD/YYYY or MM/DD/YY  Description  $Amount"""
    return _parse_us_bank(text, re.compile(
        r"(\d{2}/\d{2}/\d{4}|\d{2}/\d{2}/\d{2})\s+(.+?)\s+(-?)\$?([\d,]+\.\d{2})",
    ))


def parse_amex(text: str) -> list[dict]:
    """American Express: MM/DD/YY  Description  $Amount"""
    return _parse_us_bank(text, re.compile(
        r"(\d{2}/\d{2}/\d{2,4})\s+(.+?)\s+(-?)[\$]?([\d,]+\.\d{2})",
    ))


def parse_citi(text: str) -> list[dict]:
    """Citi: MM/DD/YY  Description  $Amount"""
    return _parse_us_bank(text, re.compile(
        r"(\d{2}/\d{2}/\d{2,4})\s+(.+?)\s+(-?)[\$]?([\d,]+\.\d{2})",
    ))


# ---------------------------------------------------------------------------
# Generic fallback
# ---------------------------------------------------------------------------

def parse_generic(text: str) -> list[dict]:
    """Try multiple date + amount patterns to extract transactions."""
    transactions: list[dict] = []
    patterns = [
        re.compile(
            r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
            re.IGNORECASE,
        ),
        re.compile(
            r"(\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})\s+"
            r"(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
            re.IGNORECASE,
        ),
        re.compile(
            r"(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s+"
            r"(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr)?",
            re.IGNORECASE,
        ),
        re.compile(
            r"(\d{2}/\d{2}/\d{2,4})\s+(.+?)\s+(-?)[\$]?([\d,]+\.\d{2})",
        ),
    ]

    for pat in patterns:
        for m in pat.finditer(text):
            date_str = m.group(1)
            date = parse_indian_date(date_str) or parse_us_date(date_str)
            if not date:
                continue
            desc = m.group(2).strip()
            amount_str = m.group(3) if m.lastindex >= 3 else None
            if amount_str and re.match(r"[\d,]+\.\d{2}$", amount_str):
                amount = parse_amount(amount_str)
                cr_dr = m.group(4) if m.lastindex >= 4 else None
                tx_type = "credit" if (cr_dr and cr_dr.lower() == "cr") or _is_credit(desc) else "debit"
            elif m.lastindex >= 4:
                sign = m.group(3)
                amount = parse_amount(m.group(4))
                tx_type = "credit" if sign == "-" or _is_credit(desc) else "debit"
            else:
                continue
            if amount is None:
                continue
            transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
        if len(transactions) >= 3:
            break

    return transactions


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

BANK_PARSERS: dict[str, Callable[[str], list[dict]]] = {
    "hdfc": parse_hdfc,
    "icici": parse_icici,
    "sbi": parse_sbi,
    "axis": parse_axis,
    "chase": parse_chase,
    "amex": parse_amex,
    "citi": parse_citi,
    "generic": parse_generic,
}

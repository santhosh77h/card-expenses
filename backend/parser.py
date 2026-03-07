"""
PDF statement parser for Cardlytics.

Supports 7 bank-specific formats (HDFC, ICICI, SBI, Axis, Chase, Amex, Citi)
plus a generic fallback parser. PDF bytes are processed in-memory only.
"""

import io
import logging
import re
from datetime import datetime
from typing import Optional

import pdfplumber

from categorizer import categorize

logger = logging.getLogger(__name__)


class PDFEncryptedError(Exception):
    """Raised when PDF is encrypted and no/wrong password was provided."""
    pass


def check_pdf_encrypted(file_bytes: bytes) -> bool:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        if not reader.is_encrypted:
            return False
        # Some PDFs use empty-string owner password (print restrictions only)
        if reader.decrypt("") > 0:
            return False
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Bank detection
# ---------------------------------------------------------------------------

BANK_KEYWORDS: dict[str, list[str]] = {
    "hdfc": ["hdfc bank", "hdfc credit card", "hdfcbank"],
    "icici": ["icici bank", "icici credit card"],
    "sbi": ["sbi card", "state bank of india", "sbicard"],
    "axis": ["axis bank", "axis credit card"],
    "chase": ["chase", "jpmorgan chase"],
    "amex": ["american express", "amex", "membership rewards"],
    "citi": ["citibank", "citi credit card", "citi card"],
}


def detect_bank(text: str) -> str:
    text_lower = text.lower()
    for bank, keywords in BANK_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return bank
    return "generic"


# ---------------------------------------------------------------------------
# Currency detection
# ---------------------------------------------------------------------------

BANK_CURRENCIES: dict[str, str] = {
    "hdfc": "INR", "icici": "INR", "sbi": "INR", "axis": "INR",
    "chase": "USD", "citi": "USD", "amex": "USD",
}


def detect_currency(text: str, bank: str) -> str:
    """Detect ISO 4217 currency code from statement text and bank identity."""
    # Bank-level default takes priority for known banks
    if bank in BANK_CURRENCIES:
        return BANK_CURRENCIES[bank]

    # Scan text for currency indicators
    text_lower = text.lower()
    if any(indicator in text_lower for indicator in ["rs.", "rs ", "inr", "\u20b9"]):
        return "INR"
    if any(indicator in text_lower for indicator in ["$", "usd"]):
        return "USD"
    if any(indicator in text_lower for indicator in ["\u20ac", "eur"]):
        return "EUR"
    if any(indicator in text_lower for indicator in ["\u00a3", "gbp"]):
        return "GBP"

    return "INR"


# ---------------------------------------------------------------------------
# Date parsing helpers
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

MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_indian_date(date_str: str) -> Optional[str]:
    date_str = date_str.strip()
    for pattern, fmt in INDIAN_DATE_PATTERNS:
        m = re.match(pattern, date_str, re.IGNORECASE)
        if m:
            if fmt:
                try:
                    dt = datetime.strptime(m.group(0), fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
            else:
                day, mon_str, year = m.group(1), m.group(2), m.group(3)
                mon = MONTH_MAP.get(mon_str.lower()[:3])
                if mon:
                    try:
                        dt = datetime(int(year), mon, int(day))
                        return dt.strftime("%Y-%m-%d")
                    except ValueError:
                        continue
    return None


def parse_us_date(date_str: str) -> Optional[str]:
    date_str = date_str.strip()
    for pattern, fmt in US_DATE_PATTERNS:
        m = re.match(pattern, date_str)
        if m:
            try:
                dt = datetime.strptime(m.group(0), fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None


# ---------------------------------------------------------------------------
# Amount parsing
# ---------------------------------------------------------------------------

def parse_amount(amount_str: str) -> Optional[float]:
    cleaned = amount_str.strip()
    # Remove currency symbols and prefixes but preserve decimal point
    cleaned = re.sub(r"Rs\.?|INR|USD|\$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[,\s]", "", cleaned)
    cleaned = cleaned.replace("(", "").replace(")", "")
    if not cleaned:
        return None
    try:
        return abs(float(cleaned))
    except ValueError:
        return None


def is_credit_keyword(text: str) -> bool:
    credit_kw = ["cr", "credit", "refund", "cashback", "reversal", "cr."]
    text_lower = text.lower()
    return any(kw in text_lower for kw in credit_kw)


# ---------------------------------------------------------------------------
# Bank-specific parsers
# ---------------------------------------------------------------------------

def parse_hdfc(text: str) -> list[dict]:
    """HDFC Bank: DD/MM/YYYY  Description  Amount"""
    transactions = []
    pattern = re.compile(
        r"(\d{2}/\d{2}/\d{4})\s+"
        r"(.+?)\s+"
        r"([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        date = parse_indian_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(3))
        if amount is None:
            continue
        tx_type = "credit" if (m.group(4) and m.group(4).lower() == "cr") or is_credit_keyword(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_icici(text: str) -> list[dict]:
    """ICICI Bank: DD-Mon-YYYY or DD/MM/YYYY  Description  Amount"""
    transactions = []
    pattern = re.compile(
        r"(\d{2}[-/]\w{3}[-/]\d{4}|\d{2}/\d{2}/\d{4})\s+"
        r"(.+?)\s+"
        r"([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        date = parse_indian_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(3))
        if amount is None:
            continue
        tx_type = "credit" if (m.group(4) and m.group(4).lower() == "cr") or is_credit_keyword(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_sbi(text: str) -> list[dict]:
    """SBI Card: DD Mon YYYY  Description  Amount"""
    transactions = []
    pattern = re.compile(
        r"(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s+"
        r"(.+?)\s+"
        r"([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        date = parse_indian_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(3))
        if amount is None:
            continue
        tx_type = "credit" if (m.group(4) and m.group(4).lower() == "cr") or is_credit_keyword(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_axis(text: str) -> list[dict]:
    """Axis Bank: DD-MM-YYYY  Description  Amount"""
    transactions = []
    pattern = re.compile(
        r"(\d{2}-\d{2}-\d{4})\s+"
        r"(.+?)\s+"
        r"([\d,]+\.\d{2})\s*(Cr|Dr)?",
        re.IGNORECASE,
    )
    for m in pattern.finditer(text):
        date = parse_indian_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(3))
        if amount is None:
            continue
        tx_type = "credit" if (m.group(4) and m.group(4).lower() == "cr") or is_credit_keyword(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_chase(text: str) -> list[dict]:
    """Chase: MM/DD/YYYY or MM/DD  Description  Amount"""
    transactions = []
    pattern = re.compile(
        r"(\d{2}/\d{2}/\d{4}|\d{2}/\d{2}/\d{2})\s+"
        r"(.+?)\s+"
        r"(-?)\$?([\d,]+\.\d{2})",
    )
    for m in pattern.finditer(text):
        date = parse_us_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(4))
        if amount is None:
            continue
        tx_type = "credit" if m.group(3) == "-" or is_credit_keyword(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_amex(text: str) -> list[dict]:
    """American Express: MM/DD/YY  Description  $Amount"""
    transactions = []
    pattern = re.compile(
        r"(\d{2}/\d{2}/\d{2,4})\s+"
        r"(.+?)\s+"
        r"(-?)[\$]?([\d,]+\.\d{2})",
    )
    for m in pattern.finditer(text):
        date = parse_us_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(4))
        if amount is None:
            continue
        tx_type = "credit" if m.group(3) == "-" or is_credit_keyword(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_citi(text: str) -> list[dict]:
    """Citi: MM/DD  Description  Amount"""
    transactions = []
    pattern = re.compile(
        r"(\d{2}/\d{2}/\d{2,4})\s+"
        r"(.+?)\s+"
        r"(-?)[\$]?([\d,]+\.\d{2})",
    )
    for m in pattern.finditer(text):
        date = parse_us_date(m.group(1))
        if not date:
            continue
        desc = m.group(2).strip()
        amount = parse_amount(m.group(4))
        if amount is None:
            continue
        tx_type = "credit" if m.group(3) == "-" or is_credit_keyword(desc) else "debit"
        transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
    return transactions


def parse_generic(text: str) -> list[dict]:
    """Generic fallback: tries multiple date + amount patterns."""
    transactions = []
    # Try Indian format first, then US
    patterns = [
        # DD/MM/YYYY ... amount
        re.compile(
            r"(\d{2}/\d{2}/\d{4})\s+"
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s*(Cr|Dr)?",
            re.IGNORECASE,
        ),
        # DD-Mon-YYYY ... amount
        re.compile(
            r"(\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})\s+"
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s*(Cr|Dr)?",
            re.IGNORECASE,
        ),
        # DD Mon YYYY ... amount
        re.compile(
            r"(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s+"
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s*(Cr|Dr)?",
            re.IGNORECASE,
        ),
        # MM/DD/YYYY ... $amount (US)
        re.compile(
            r"(\d{2}/\d{2}/\d{2,4})\s+"
            r"(.+?)\s+"
            r"(-?)[\$]?([\d,]+\.\d{2})",
        ),
    ]

    for pat in patterns:
        for m in pat.finditer(text):
            date_str = m.group(1)
            date = parse_indian_date(date_str) or parse_us_date(date_str)
            if not date:
                continue
            desc = m.group(2).strip()
            # Amount group position varies
            amount_str = m.group(3) if m.lastindex >= 3 else None
            if amount_str and re.match(r"[\d,]+\.\d{2}$", amount_str):
                amount = parse_amount(amount_str)
                cr_dr = m.group(4) if m.lastindex >= 4 else None
                tx_type = "credit" if (cr_dr and cr_dr.lower() == "cr") or is_credit_keyword(desc) else "debit"
            elif m.lastindex >= 4:
                sign = m.group(3)
                amount = parse_amount(m.group(4))
                tx_type = "credit" if sign == "-" or is_credit_keyword(desc) else "debit"
            else:
                continue
            if amount is None:
                continue
            transactions.append({"date": date, "description": desc, "amount": amount, "type": tx_type})
        if len(transactions) >= 3:
            break

    return transactions


# ---------------------------------------------------------------------------
# Bank parser dispatch
# ---------------------------------------------------------------------------

BANK_PARSERS = {
    "hdfc": parse_hdfc,
    "icici": parse_icici,
    "sbi": parse_sbi,
    "axis": parse_axis,
    "chase": parse_chase,
    "amex": parse_amex,
    "citi": parse_citi,
    "generic": parse_generic,
}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def extract_text(file_bytes: bytes, password: Optional[str] = None) -> str:
    """Extract text from PDF using pdfplumber, fallback to PyPDF2."""
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes), password=password) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except PDFEncryptedError:
        raise
    except Exception:
        pass

    if not text.strip():
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            if reader.is_encrypted:
                if not password:
                    raise PDFEncryptedError("password_required")
                if reader.decrypt(password) == 0:
                    raise PDFEncryptedError("incorrect_password")
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        except PDFEncryptedError:
            raise
        except Exception:
            pass

    return text


def build_summary(transactions: list[dict]) -> dict:
    """Build summary statistics from parsed transactions."""
    total_debits = sum(t["amount"] for t in transactions if t["type"] == "debit")
    total_credits = sum(t["amount"] for t in transactions if t["type"] == "credit")

    categories: dict[str, dict] = {}
    for t in transactions:
        cat = t.get("category", "Other")
        if cat not in categories:
            categories[cat] = {"total": 0.0, "count": 0}
        categories[cat]["total"] += t["amount"]
        categories[cat]["count"] += 1

    dates = [t["date"] for t in transactions if t.get("date")]
    dates.sort()
    period = {
        "from": dates[0] if dates else None,
        "to": dates[-1] if dates else None,
    }

    return {
        "total_transactions": len(transactions),
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "net": round(total_debits - total_credits, 2),
        "categories": categories,
        "statement_period": period,
    }


def generate_csv(transactions: list[dict]) -> str:
    """Generate CSV string from transactions."""
    lines = ["date,description,amount,category,type"]
    for t in transactions:
        desc = t["description"].replace('"', '""')
        lines.append(
            f'{t["date"]},"{desc}",{t["amount"]},{t.get("category", "Other")},{t["type"]}'
        )
    return "\n".join(lines)


def parse_pdf(file_bytes: bytes, password: Optional[str] = None) -> dict:
    """
    Main entry point: parse a PDF credit card statement.

    Returns dict with keys: transactions, summary, csv, bank_detected
    """
    if not password and check_pdf_encrypted(file_bytes):
        raise PDFEncryptedError("password_required")

    text = extract_text(file_bytes, password=password)
    if not text.strip():
        raise ValueError("Could not extract text from PDF. It may be scanned/image-based.")

    bank = detect_bank(text)

    # --- Try LLM-based extraction first ---
    transactions = None
    llm_statement_period = None
    llm_card_info = None
    try:
        from llm_parser import llm_parse_transactions
        llm_result = llm_parse_transactions(text, bank_hint=bank)
        if llm_result and llm_result.get("transactions"):
            transactions = llm_result["transactions"]
            llm_statement_period = llm_result.get("statement_period")
            llm_card_info = llm_result.get("card_info")
            logger.info("Using LLM-extracted transactions (%d found)", len(transactions))
    except Exception:
        logger.debug("LLM parser unavailable — using regex fallback", exc_info=True)

    # --- Regex fallback (unchanged) ---
    if transactions is None:
        parser = BANK_PARSERS.get(bank, parse_generic)
        transactions = parser(text)

        # Fallback to generic if bank-specific parser yielded < 3 results
        if len(transactions) < 3 and bank != "generic":
            generic_txns = parse_generic(text)
            if len(generic_txns) > len(transactions):
                transactions = generic_txns

        if not transactions:
            raise ValueError(
                "No transactions found. The PDF format may not be supported yet."
            )

        # Categorize each transaction
        for t in transactions:
            cat = categorize(t["description"])
            t["category"] = cat["name"]
            t["category_color"] = cat["color"]
            t["category_icon"] = cat["icon"]

    summary = build_summary(transactions)

    # Override statement period with LLM-provided values when available
    if llm_statement_period:
        if llm_statement_period.get("from") or llm_statement_period.get("to"):
            summary["statement_period"] = {
                "from": llm_statement_period.get("from") or summary["statement_period"]["from"],
                "to": llm_statement_period.get("to") or summary["statement_period"]["to"],
            }

    csv = generate_csv(transactions)

    # Prefer LLM-detected currency, fall back to regex-based detection
    llm_currency = llm_card_info.get("currency") if llm_card_info else None
    currency = llm_currency if llm_currency else detect_currency(text, bank)

    return {
        "transactions": transactions,
        "summary": summary,
        "csv": csv,
        "bank_detected": bank,
        "card_info": llm_card_info,
        "currency_detected": currency,
    }

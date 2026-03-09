"""
Statement parsing orchestrator.

Coordinates PDF extraction, bank detection, LLM parsing, regex fallback,
categorization, and summary generation. This is the main entry point
called by the API route.
"""

import csv
import io
import logging
from typing import Optional

from app.categories import categorize
from app.detector import detect_bank, detect_currency, detect_region
from app.exceptions import PDFEncryptedError, ParseError
from app.llm_parser import llm_parse_transactions
from app.pdf import check_encrypted, extract_text, validate_pdf_bytes
from app.regex_parsers import BANK_PARSERS, parse_generic

logger = logging.getLogger(__name__)


def parse_pdf(file_bytes: bytes, password: Optional[str] = None) -> dict:
    """
    Parse a PDF credit card statement end-to-end.

    Returns dict with keys:
      transactions, summary, csv, bank_detected, card_info, currency_detected
    """
    validate_pdf_bytes(file_bytes)

    if not password and check_encrypted(file_bytes):
        raise PDFEncryptedError("password_required")

    text = extract_text(file_bytes, password=password)
    if not text.strip():
        raise ParseError("Could not extract text from PDF. It may be scanned/image-based.")

    bank = detect_bank(text)
    currency_hint = detect_currency(text, bank)
    region = detect_region(text, bank, currency_hint)

    # --- LLM-based extraction (preferred) ---
    transactions = None
    llm_statement_period = None
    llm_card_info = None

    try:
        llm_result = llm_parse_transactions(text, bank_hint=bank, region=region)
        if llm_result and llm_result.get("transactions"):
            transactions = llm_result["transactions"]
            llm_statement_period = llm_result.get("statement_period")
            llm_card_info = llm_result.get("card_info")
            logger.info("Using LLM-extracted transactions (%d found)", len(transactions))
    except Exception:
        logger.debug("LLM parser unavailable — using regex fallback", exc_info=True)

    # --- Regex fallback ---
    if transactions is None:
        parser_fn = BANK_PARSERS.get(bank, parse_generic)
        transactions = parser_fn(text)

        if len(transactions) < 3 and bank != "generic":
            generic_txns = parse_generic(text)
            if len(generic_txns) > len(transactions):
                transactions = generic_txns

        if not transactions:
            raise ParseError(
                "No transactions found. The PDF format may not be supported yet."
            )

        for t in transactions:
            cat = categorize(t["description"])
            t["category"] = cat["name"]
            t["category_color"] = cat["color"]
            t["category_icon"] = cat["icon"]

    summary = _build_summary(transactions)

    if llm_statement_period:
        if llm_statement_period.get("from") or llm_statement_period.get("to"):
            summary["statement_period"] = {
                "from": llm_statement_period.get("from") or summary["statement_period"]["from"],
                "to": llm_statement_period.get("to") or summary["statement_period"]["to"],
            }

    llm_currency = llm_card_info.get("currency") if llm_card_info else None
    currency = llm_currency if llm_currency else currency_hint

    return {
        "transactions": transactions,
        "summary": summary,
        "csv": _generate_csv(transactions),
        "bank_detected": bank,
        "card_info": llm_card_info,
        "currency_detected": currency,
        "region_detected": region,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_summary(transactions: list[dict]) -> dict:
    total_debits = sum(t["amount"] for t in transactions if t["type"] == "debit")
    total_credits = sum(t["amount"] for t in transactions if t["type"] == "credit")

    categories: dict[str, dict] = {}
    for t in transactions:
        cat = t.get("category", "Other")
        if cat not in categories:
            categories[cat] = {"total": 0.0, "count": 0}
        categories[cat]["total"] += t["amount"]
        categories[cat]["count"] += 1

    dates = sorted(t["date"] for t in transactions if t.get("date"))

    return {
        "total_transactions": len(transactions),
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "net": round(total_debits - total_credits, 2),
        "categories": categories,
        "statement_period": {
            "from": dates[0] if dates else None,
            "to": dates[-1] if dates else None,
        },
    }


def _generate_csv(transactions: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "description", "amount", "category", "type"])
    for t in transactions:
        writer.writerow([
            t["date"],
            t["description"],
            t["amount"],
            t.get("category", "Other"),
            t["type"],
        ])
    return output.getvalue()

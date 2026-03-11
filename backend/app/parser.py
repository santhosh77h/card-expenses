"""
Statement parsing orchestrator.

Coordinates PDF extraction, bank detection, LLM parsing (with multi-LLM
consensus when available), regex fallback, categorization, and summary
generation. This is the main entry point called by the API route.
"""

import asyncio
import csv
import io
import logging
from typing import Optional

from app.categories import categorize
from app.config import settings
from app.consensus import build_consensus
from app.detector import detect_bank, detect_currency, detect_region
from app.exceptions import PDFEncryptedError, ParseError
from app.llm_parser import async_llm_parse_all, llm_parse_transactions
from app.pdf import check_encrypted, extract_text, validate_pdf_bytes
from app.regex_parsers import BANK_PARSERS, parse_generic

logger = logging.getLogger(__name__)


async def parse_pdf(file_bytes: bytes, password: Optional[str] = None) -> dict:
    """
    Parse a PDF credit card statement end-to-end.

    Returns dict with keys:
      transactions, summary, csv, bank_detected, card_info,
      currency_detected, region_detected, validation
    """
    # Phase 1: Sync (fast, CPU-bound) — extract text, detect bank/currency/region
    text, bank, currency_hint, region = _extract_and_detect(file_bytes, password)

    # Phase 2: LLM parsing (async, I/O-bound)
    transactions = None
    validation_metadata = None
    llm_statement_period = None
    llm_card_info = None

    if settings.consensus_capable:
        # Multi-LLM consensus (parallel)
        try:
            llm_results = await async_llm_parse_all(text, bank_hint=bank, region=region)
            if llm_results:
                consensus = build_consensus(llm_results)
                transactions = consensus.transactions
                llm_statement_period = consensus.statement_period
                llm_card_info = consensus.card_info
                validation_metadata = consensus.validation
                logger.info("Using consensus-validated transactions (%d found, confidence=%.3f)",
                            len(transactions), validation_metadata.get("confidence", 0))
        except Exception:
            logger.warning("Consensus pipeline failed — trying single LLM", exc_info=True)

    if transactions is None and settings.llm_enabled:
        # Single-LLM fallback (run sync in executor)
        try:
            loop = asyncio.get_event_loop()
            llm_result = await loop.run_in_executor(None, llm_parse_transactions, text, bank, region)
            if llm_result and llm_result.get("transactions"):
                transactions = llm_result["transactions"]
                llm_statement_period = llm_result.get("statement_period")
                llm_card_info = llm_result.get("card_info")
                logger.info("Using single-LLM transactions (%d found)", len(transactions))
        except Exception:
            logger.debug("LLM parser unavailable — using regex fallback", exc_info=True)

    # Phase 3: Regex fallback (sync, fast)
    if transactions is None:
        transactions = _regex_fallback(text, bank)

    # Phase 4: Build response
    summary = _build_summary(transactions)

    if llm_statement_period:
        if llm_statement_period.get("from") or llm_statement_period.get("to"):
            summary["statement_period"] = {
                "from": llm_statement_period.get("from") or summary["statement_period"]["from"],
                "to": llm_statement_period.get("to") or summary["statement_period"]["to"],
            }

    llm_currency = llm_card_info.get("currency") if llm_card_info else None
    currency = llm_currency if llm_currency else currency_hint

    result = {
        "transactions": transactions,
        "summary": summary,
        "csv": _generate_csv(transactions),
        "bank_detected": bank,
        "card_info": llm_card_info,
        "currency_detected": currency,
        "region_detected": region,
    }

    if validation_metadata:
        result["validation"] = validation_metadata

    return result


# ---------------------------------------------------------------------------
# Phase helpers
# ---------------------------------------------------------------------------

def _extract_and_detect(file_bytes: bytes, password: Optional[str] = None) -> tuple[str, str, str, str]:
    """Phase 1: Extract text from PDF and detect bank/currency/region."""
    validate_pdf_bytes(file_bytes)

    logger.info("[parse_pdf] password=%s, file_size=%d bytes", "provided" if password else "none", len(file_bytes))

    encrypted = check_encrypted(file_bytes)
    logger.info("[parse_pdf] check_encrypted=%s", encrypted)
    if not password and encrypted:
        raise PDFEncryptedError("password_required")

    text = extract_text(file_bytes, password=password)
    logger.info("[parse_pdf] extracted text length=%d", len(text.strip()))
    if not text.strip():
        raise ParseError("Could not extract text from PDF. It may be scanned/image-based.")

    bank = detect_bank(text)
    currency_hint = detect_currency(text, bank)
    region = detect_region(text, bank, currency_hint)

    return text, bank, currency_hint, region


def _regex_fallback(text: str, bank: str) -> list[dict]:
    """Phase 3: Regex-based extraction with categorization."""
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

    return transactions


# ---------------------------------------------------------------------------
# Summary & CSV (unchanged)
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

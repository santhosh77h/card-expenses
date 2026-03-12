"""
Statement parsing orchestrator.

Coordinates pipeline stages: Document Intelligence (Stage 1), LLM parsing
with multi-LLM consensus (Stage 2), regex fallback, categorization, and
summary generation. This is the main entry point called by the API route.
"""

import asyncio
import csv
import io
import logging
import re
from functools import partial
from typing import Optional

from app.categories import categorize
from app.config import settings
from app.consensus import build_consensus
from app.validators import validate_card_info
from app.exceptions import PDFEncryptedError, ParseError
from app.llm_parser import async_llm_parse_all, llm_parse_transactions
from app.pdf import check_encrypted, extract_text, validate_pdf_bytes
from app.pipeline import PipelineContext
from app.regex_parsers import BANK_PARSERS, parse_generic, infer_transaction_type
from app.stages.intelligence import run_intelligence_stage

logger = logging.getLogger(__name__)


async def parse_pdf(file_bytes: bytes, password: Optional[str] = None) -> dict:
    """
    Parse a PDF credit card statement end-to-end.

    Returns dict with keys:
      transactions, summary, csv, bank_detected, card_info,
      currency_detected, region_detected, validation,
      country_detected, date_format_detected, statement_type_detected,
      language_detected
    """
    # Extract text from PDF (sync, fast)
    text = _extract_text(file_bytes, password)
    text = _clean_text(text)

    # Build pipeline context
    ctx = PipelineContext(text=text, file_bytes=file_bytes, password=password)

    # ── Stage 1: Document Intelligence ──
    await run_intelligence_stage(ctx)
    intel = ctx.intelligence
    logger.info(
        "[pipeline] Stage 1 complete: country=%s, currency=%s, date_format=%s, bank=%s, method=%s",
        intel.country, intel.currency, intel.date_format, intel.bank, intel.method,
    )

    # ── Stage 2: Transaction Parsing ──
    intel_kwargs = {
        "country": intel.country,
        "currency": intel.currency,
        "date_format": intel.date_format,
        "statement_type": intel.statement_type,
    }

    if settings.consensus_capable:
        try:
            llm_results = await async_llm_parse_all(
                text, bank_hint=intel.bank, region=intel.region, **intel_kwargs
            )
            if llm_results:
                consensus = build_consensus(llm_results)
                ctx.transactions = consensus.transactions
                ctx.statement_period = consensus.statement_period
                ctx.card_info = consensus.card_info
                ctx.validation = consensus.validation
                logger.info(
                    "Using consensus-validated transactions (%d found, confidence=%.3f)",
                    len(ctx.transactions),
                    ctx.validation.get("confidence", 0) if ctx.validation else 0,
                )
        except Exception:
            logger.warning("Consensus pipeline failed — trying single LLM", exc_info=True)

    if ctx.transactions is None and settings.llm_enabled:
        try:
            loop = asyncio.get_event_loop()
            llm_result = await loop.run_in_executor(
                None,
                partial(llm_parse_transactions, text, intel.bank, intel.region, **intel_kwargs),
            )
            if llm_result and llm_result.get("transactions"):
                ctx.transactions = llm_result["transactions"]
                ctx.statement_period = llm_result.get("statement_period")
                ctx.card_info = llm_result.get("card_info")
                logger.info("Using single-LLM transactions (%d found)", len(ctx.transactions))
        except Exception:
            logger.debug("LLM parser unavailable — using regex fallback", exc_info=True)

    # Regex fallback (sync, fast)
    if ctx.transactions is None:
        ctx.transactions = _regex_fallback(text, intel.bank)

    # ── Future: Stage 3, 4, ... ──
    # await run_enrichment_stage(ctx)

    # ── Build response ──
    return _build_response(ctx)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    """Remove PDF extraction artifacts that confuse LLM and regex parsers."""
    # Remove (cid:X) markers — unresolved character IDs from PDF font subsetting
    text = re.sub(r'\(cid:\d+\)', ' ', text)
    # Collapse runs of whitespace (but preserve newlines)
    text = re.sub(r'[^\S\n]+', ' ', text)
    return text


def _extract_text(file_bytes: bytes, password: Optional[str] = None) -> str:
    """Extract text from PDF bytes with encryption handling."""
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

    return text


def _regex_fallback(text: str, bank: str) -> list[dict]:
    """Regex-based extraction with categorization."""
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
        t["transaction_type"] = infer_transaction_type(t["description"], t["type"])

    return transactions


def _build_response(ctx: PipelineContext) -> dict:
    """Build the final API response from pipeline context."""
    intel = ctx.intelligence
    transactions = ctx.transactions
    summary = _build_summary(transactions)

    if ctx.statement_period:
        if ctx.statement_period.get("from") or ctx.statement_period.get("to"):
            summary["statement_period"] = {
                "from": ctx.statement_period.get("from") or summary["statement_period"]["from"],
                "to": ctx.statement_period.get("to") or summary["statement_period"]["to"],
            }

    validated_card_info = validate_card_info(ctx.card_info, summary)

    llm_currency = validated_card_info.get("currency") if validated_card_info else None
    currency = llm_currency if llm_currency else intel.currency

    result = {
        "transactions": transactions,
        "summary": summary,
        "csv": _generate_csv(transactions),
        "bank_detected": intel.bank,
        "card_info": validated_card_info,
        "currency_detected": currency,
        "region_detected": intel.region,
        "country_detected": intel.country,
        "date_format_detected": intel.date_format,
        "statement_type_detected": intel.statement_type,
        "language_detected": intel.language,
    }

    if ctx.validation:
        result["validation"] = {
            **ctx.validation,
            "intelligence": {
                "country": intel.country,
                "region": intel.region,
                "currency": intel.currency,
                "date_format": intel.date_format,
                "statement_type": intel.statement_type,
                "language": intel.language,
                "bank": intel.bank,
                "confidence": intel.confidence,
                "method": intel.method,
            },
        }

    return result


# ---------------------------------------------------------------------------
# Summary & CSV
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

    transaction_types: dict[str, int] = {}
    for t in transactions:
        tt = t.get("transaction_type", "purchase")
        transaction_types[tt] = transaction_types.get(tt, 0) + 1

    return {
        "total_transactions": len(transactions),
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "net": round(total_debits - total_credits, 2),
        "categories": categories,
        "transaction_types": transaction_types,
        "statement_period": {
            "from": dates[0] if dates else None,
            "to": dates[-1] if dates else None,
        },
    }


def _generate_csv(transactions: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "description", "amount", "category", "type", "transaction_type"])
    for t in transactions:
        writer.writerow([
            t["date"],
            t["description"],
            t["amount"],
            t.get("category", "Other"),
            t["type"],
            t.get("transaction_type", "purchase"),
        ])
    return output.getvalue()

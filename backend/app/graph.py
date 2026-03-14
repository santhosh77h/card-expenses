"""
LangGraph pipeline for statement parsing.

Models the parsing stages as a StateGraph with typed state, giving:
- Visual trace trees in LangSmith
- Declarative, testable pipeline flow
- Automatic latency/cost tracking per stage

The graph orchestrates: extract_text → intelligence → parse_transactions
→ validate → build_response.
"""

import asyncio
import csv
import io
import logging
import re
from functools import partial
from typing import Any, Optional
from uuid import uuid4

from langgraph.graph import END, START, StateGraph

from app.categories import categorize
from app.config import settings
from app.consensus import build_consensus
from app.exceptions import PDFEncryptedError, ParseError
from app.llm_parser import async_llm_parse_all, llm_parse_transactions
from app.pdf import check_encrypted, extract_text, extract_text_and_tables, validate_pdf_bytes
from app.pipeline import DocumentIntelligence, PipelineContext
from app.regex_parsers import BANK_PARSERS, infer_transaction_type, parse_generic
from app.stages.intelligence import run_intelligence_stage
from app.telemetry import get_call_records, init_call_records
from app.validators import validate_card_info

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pipeline State
# ---------------------------------------------------------------------------

try:
    from typing import TypedDict
except ImportError:
    from typing_extensions import TypedDict


class PipelineState(TypedDict, total=False):
    """Typed state flowing through the LangGraph pipeline."""
    # Input
    file_bytes: bytes
    password: Optional[str]
    filename: str
    statement_id: str

    # After extract_text
    text: str
    text_for_llm: str

    # After intelligence
    intelligence: Any  # DocumentIntelligence instance

    # After parse_transactions
    transactions: Optional[list[dict]]
    statement_period: Optional[dict]
    card_info: Optional[dict]
    validation: Optional[dict]
    parsing_method: str

    # After validate
    summary: dict

    # After build_response
    response: dict


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

async def extract_text_node(state: PipelineState) -> dict:
    """Extract text from PDF and clean artifacts."""
    file_bytes = state["file_bytes"]
    password = state.get("password")

    validate_pdf_bytes(file_bytes)

    logger.info(
        "[extract_text] password=%s, file_size=%d bytes",
        "provided" if password else "none",
        len(file_bytes),
    )

    encrypted = check_encrypted(file_bytes)
    logger.info("[extract_text] check_encrypted=%s", encrypted)
    if not password and encrypted:
        raise PDFEncryptedError("password_required")

    result = extract_text_and_tables(file_bytes, password=password)
    logger.info(
        "[extract_text] extracted text length=%d, table_supplement length=%d",
        len(result.text.strip()),
        len(result.table_supplement),
    )
    if not result.text.strip():
        raise ParseError("Could not extract text from PDF. It may be scanned/image-based.")

    # Clean PDF extraction artifacts for regex-friendly text
    text = re.sub(r'\(cid:\d+\)', ' ', result.text)
    text = re.sub(r'[^\S\n]+', ' ', text)

    # Build LLM text: layout-preserved supplement FIRST, then cleaned text.
    # Supplement goes first so that MAX_TEXT_LENGTH truncation (in llm_parser.py)
    # cuts from the end of the transaction list, not the account summary metadata.
    text_for_llm = text
    if result.table_supplement:
        text_for_llm = result.table_supplement + "\n\n" + text
        if len(text_for_llm) > 80_000:
            logger.warning(
                "[extract_text] text_for_llm is %d chars (supplement=%d, text=%d)"
                " — may be truncated at 100K by LLM parser",
                len(text_for_llm), len(result.table_supplement), len(text),
            )

    return {"text": text, "text_for_llm": text_for_llm}


async def intelligence_node(state: PipelineState) -> dict:
    """Stage 1: Detect document locale via LLM probe or heuristic fallback."""
    ctx = PipelineContext(text=state["text"])
    await run_intelligence_stage(ctx)

    intel = ctx.intelligence
    logger.info(
        "[intelligence] Stage 1 complete: country=%s, currency=%s, date_format=%s, bank=%s, method=%s",
        intel.country, intel.currency, intel.date_format, intel.bank, intel.method,
    )
    return {"intelligence": intel}


async def parse_transactions_node(state: PipelineState) -> dict:
    """Stage 2: Parse transactions via consensus, single LLM, or regex fallback."""
    intel: DocumentIntelligence = state["intelligence"]
    text: str = state["text"]
    text_for_llm: str = state.get("text_for_llm", text)

    intel_kwargs = {
        "country": intel.country,
        "currency": intel.currency,
        "date_format": intel.date_format,
        "statement_type": intel.statement_type,
    }

    transactions = None
    statement_period = None
    card_info = None
    validation = None
    parsing_method = "regex"

    # Try consensus (multi-LLM) — use enriched text with layout supplement
    if settings.consensus_capable:
        try:
            llm_results = await async_llm_parse_all(
                text_for_llm, bank_hint=intel.bank, region=intel.region, **intel_kwargs
            )
            if llm_results:
                consensus = build_consensus(llm_results)
                transactions = consensus.transactions
                statement_period = consensus.statement_period
                card_info = consensus.card_info
                validation = consensus.validation
                parsing_method = "consensus"
                logger.info(
                    "Using consensus-validated transactions (%d found, confidence=%.3f)",
                    len(transactions),
                    validation.get("confidence", 0) if validation else 0,
                )
        except Exception:
            logger.warning("Consensus pipeline failed — trying single LLM", exc_info=True)

    # Fallback: single LLM — use enriched text with layout supplement
    if transactions is None and settings.llm_enabled:
        try:
            loop = asyncio.get_event_loop()
            llm_result = await loop.run_in_executor(
                None,
                partial(llm_parse_transactions, text_for_llm, intel.bank, intel.region, **intel_kwargs),
            )
            if llm_result and llm_result.get("transactions"):
                transactions = llm_result["transactions"]
                statement_period = llm_result.get("statement_period")
                card_info = llm_result.get("card_info")
                parsing_method = "single_llm"
                logger.info("Using single-LLM transactions (%d found)", len(transactions))
        except Exception:
            logger.debug("LLM parser unavailable — using regex fallback", exc_info=True)

    # Fallback: regex
    if transactions is None:
        transactions = _regex_fallback(text, intel.bank)
        parsing_method = "regex"

    return {
        "transactions": transactions,
        "statement_period": statement_period,
        "card_info": card_info,
        "validation": validation,
        "parsing_method": parsing_method,
    }


async def validate_node(state: PipelineState) -> dict:
    """Validate card_info against computed transaction summary."""
    transactions = state["transactions"]
    summary = _build_summary(transactions)

    statement_period = state.get("statement_period")
    if statement_period:
        if statement_period.get("from") or statement_period.get("to"):
            summary["statement_period"] = {
                "from": statement_period.get("from") or summary["statement_period"]["from"],
                "to": statement_period.get("to") or summary["statement_period"]["to"],
            }

    validated_card_info = validate_card_info(state.get("card_info"), summary)

    return {"card_info": validated_card_info, "summary": summary}


async def build_response_node(state: PipelineState) -> dict:
    """Assemble the final API response from pipeline state."""
    intel: DocumentIntelligence = state["intelligence"]
    transactions = state["transactions"]
    summary = state["summary"]
    validated_card_info = state.get("card_info")

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

    validation = state.get("validation")
    if validation:
        result["validation"] = {
            **validation,
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

    return {"response": result}


async def save_to_dashboard_node(state: PipelineState) -> dict:
    """Persist parsing results to the dashboard DB. Never fails the pipeline."""
    try:
        from app.dashboard_db import save_llm_call, save_pdf, save_response, save_statement

        if not settings.DASHBOARD_ENABLED:
            return {}

        statement_id = state.get("statement_id", "")
        if not statement_id:
            return {}

        response = state.get("response", {})
        filename = state.get("filename", "")
        file_bytes = state.get("file_bytes", b"")
        file_size = len(file_bytes)
        parsing_method = state.get("parsing_method", "unknown")
        password = state.get("password")

        # Save statement metadata
        save_statement(statement_id, filename, file_size, response, parsing_method, pdf_password=password)

        # Save the uploaded PDF for later viewing
        save_pdf(statement_id, file_bytes)

        # Save all LLM call records from telemetry
        for record in get_call_records():
            save_llm_call(
                statement_id=statement_id,
                stage=record.stage,
                provider=record.provider,
                provider_model=record.provider_model,
                system_prompt=record.system_prompt,
                user_message=record.user_message,
                raw_response=record.raw_response,
                parsed_response=record.parsed_response,
                success=record.success,
                error=record.error,
                latency_ms=record.latency_ms,
            )

        # Save full API response
        save_response(statement_id, response)

        logger.info("[dashboard] Saved statement %s (%s)", statement_id, filename)

    except Exception:
        logger.warning("[dashboard] Failed to save — non-critical", exc_info=True)

    return {}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

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


def _build_summary(transactions: list[dict]) -> dict:
    """Build transaction summary with totals, categories, and period."""
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
    """Generate CSV export from transactions."""
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


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_pipeline_graph():
    """Build and compile the LangGraph pipeline."""
    graph = StateGraph(PipelineState)

    graph.add_node("extract_text", extract_text_node)
    graph.add_node("intelligence", intelligence_node)
    graph.add_node("parse_transactions", parse_transactions_node)
    graph.add_node("validate", validate_node)
    graph.add_node("build_response", build_response_node)
    graph.add_node("save_to_dashboard", save_to_dashboard_node)

    graph.add_edge(START, "extract_text")
    graph.add_edge("extract_text", "intelligence")
    graph.add_edge("intelligence", "parse_transactions")
    graph.add_edge("parse_transactions", "validate")
    graph.add_edge("validate", "build_response")
    graph.add_edge("build_response", "save_to_dashboard")
    graph.add_edge("save_to_dashboard", END)

    return graph.compile()


# Compiled pipeline — reused across requests
pipeline = build_pipeline_graph()


async def run_pipeline(
    file_bytes: bytes,
    password: str | None = None,
    filename: str = "",
) -> dict:
    """
    Main entry point — invokes the LangGraph pipeline.

    Returns the full API response dict.
    """
    statement_id = uuid4().hex
    init_call_records()

    result = await pipeline.ainvoke({
        "file_bytes": file_bytes,
        "password": password,
        "filename": filename,
        "statement_id": statement_id,
    })

    response = result["response"]
    response["_statement_id"] = statement_id
    return response

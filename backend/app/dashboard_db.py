"""
Dashboard MongoDB storage — persists parsed statement history,
LLM call traces, and full API responses for the web dashboard.

Uses pymongo with the shared MongoClient from ``app.mongo``.
All function signatures are identical to the previous SQLite implementation
so callers (dashboard_routes.py, graph.py) require zero changes.

Dashboard writes are non-critical and never block the parse pipeline.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import settings
from app.mongo import doc_to_dict, get_db, nanoid

PDF_STORAGE_DIR = Path(settings.DASHBOARD_DB_PATH).parent / "pdfs"

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------

def _statements():
    return get_db()["statements"]


def _llm_calls():
    return get_db()["llm_calls"]


def _responses():
    return get_db()["responses"]


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def init_dashboard_db() -> None:
    """Create indexes. Called at app startup."""
    if not settings.DASHBOARD_ENABLED:
        return

    _statements().create_index("created_at")
    _statements().create_index("bank_detected")
    _statements().create_index("label")
    _llm_calls().create_index("statement_id")
    _responses().create_index("statement_id", unique=True)

    PDF_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("[dashboard_db] Initialized (MongoDB)")
    logger.info("[dashboard_db] PDF storage at %s", PDF_STORAGE_DIR)


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def save_statement(
    statement_id: str,
    filename: str,
    file_size_bytes: int,
    response: dict,
    parsing_method: str = "unknown",
    pdf_password: str | None = None,
) -> None:
    """Insert a parsed statement record from the pipeline response."""
    if not settings.DASHBOARD_ENABLED:
        return

    summary = response.get("summary", {})
    validation = response.get("validation", {})
    card_info = response.get("card_info") or {}
    period = summary.get("statement_period", {})
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "_id": statement_id,
        "filename": filename,
        "file_size_bytes": file_size_bytes,
        "bank_detected": response.get("bank_detected"),
        "currency_detected": response.get("currency_detected"),
        "country_detected": response.get("country_detected"),
        "region_detected": response.get("region_detected"),
        "date_format_detected": response.get("date_format_detected"),
        "statement_type_detected": response.get("statement_type_detected"),
        "language_detected": response.get("language_detected"),
        "transaction_count": summary.get("total_transactions", 0),
        "total_debits": summary.get("total_debits", 0),
        "total_credits": summary.get("total_credits", 0),
        "net": summary.get("net", 0),
        "confidence": validation.get("confidence"),
        "consensus_method": validation.get("consensus_method"),
        "llm_count": validation.get("llm_count"),
        "llm_sources": validation.get("llm_sources", []),
        "transactions_flagged": validation.get("transactions_flagged"),
        "parsing_method": parsing_method,
        "label": "",
        "notes": "",
        "statement_period_from": period.get("from"),
        "statement_period_to": period.get("to"),
        "card_last4": card_info.get("card_last4"),
        "card_network": card_info.get("card_network"),
        "pdf_password": pdf_password,
        "created_at": now,
        "updated_at": now,
    }

    try:
        _statements().insert_one(doc)
    except Exception:
        logger.warning("[dashboard_db] Failed to save statement %s", statement_id, exc_info=True)


def save_llm_call(
    statement_id: str,
    stage: str,
    provider: str,
    provider_model: str,
    system_prompt: str,
    user_message: str,
    raw_response: Optional[str] = None,
    parsed_response: Optional[dict] = None,
    success: bool = True,
    error: Optional[str] = None,
    latency_ms: Optional[int] = None,
) -> None:
    """Insert an LLM call record."""
    if not settings.DASHBOARD_ENABLED:
        return

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": nanoid(),
        "statement_id": statement_id,
        "stage": stage,
        "provider": provider,
        "provider_model": provider_model,
        "system_prompt": system_prompt,
        "user_message": user_message,
        "raw_response": raw_response,
        "parsed_response": parsed_response,
        "success": success,
        "error": error,
        "latency_ms": latency_ms,
        "created_at": now,
    }

    try:
        _llm_calls().insert_one(doc)
    except Exception:
        logger.warning("[dashboard_db] Failed to save llm_call", exc_info=True)


def save_response(statement_id: str, response: dict) -> None:
    """Store the full API response."""
    if not settings.DASHBOARD_ENABLED:
        return

    now = datetime.now(timezone.utc).isoformat()
    # Round-trip through JSON to ensure all values are BSON-safe (handles
    # datetime, Decimal, custom objects via default=str).
    safe_response = json.loads(json.dumps(response, default=str))

    doc = {
        "_id": nanoid(),
        "statement_id": statement_id,
        "response_json": safe_response,
        "created_at": now,
    }

    try:
        _responses().insert_one(doc)
    except Exception:
        logger.warning("[dashboard_db] Failed to save response", exc_info=True)


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_stats() -> dict:
    """Aggregate dashboard statistics."""
    col = _statements()

    # Main aggregation
    pipeline = [
        {"$group": {
            "_id": None,
            "total_statements": {"$sum": 1},
            "total_transactions": {"$sum": {"$ifNull": ["$transaction_count", 0]}},
            "avg_confidence": {"$avg": {"$ifNull": ["$confidence", 0]}},
            "total_debits_all": {"$sum": {"$ifNull": ["$total_debits", 0]}},
            "total_credits_all": {"$sum": {"$ifNull": ["$total_credits", 0]}},
        }},
    ]
    agg = list(col.aggregate(pipeline))
    stats = agg[0] if agg else {
        "total_statements": 0,
        "total_transactions": 0,
        "avg_confidence": 0,
        "total_debits_all": 0,
        "total_credits_all": 0,
    }

    # Banks breakdown
    bank_pipeline = [
        {"$match": {"bank_detected": {"$ne": None}}},
        {"$group": {"_id": "$bank_detected", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    banks = [{"bank": b["_id"], "count": b["count"]} for b in col.aggregate(bank_pipeline)]

    # Recent 10 statements
    projection = {
        "_id": 1, "filename": 1, "bank_detected": 1,
        "created_at": 1, "transaction_count": 1, "confidence": 1, "label": 1,
    }
    recent = [
        doc_to_dict(d)
        for d in col.find({}, projection).sort("created_at", -1).limit(10)
    ]

    return {
        "total_statements": stats["total_statements"],
        "total_transactions": stats["total_transactions"],
        "avg_confidence": round(stats.get("avg_confidence") or 0, 4),
        "total_debits_all": round(stats.get("total_debits_all") or 0, 2),
        "total_credits_all": round(stats.get("total_credits_all") or 0, 2),
        "banks": banks,
        "recent": recent,
    }


def get_statements(
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    bank: str = "",
    label: str = "",
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> dict:
    """Paginated list of statements."""
    allowed_sort = {"created_at", "filename", "bank_detected", "transaction_count", "confidence"}
    if sort_by not in allowed_sort:
        sort_by = "created_at"
    sort_dir = -1 if sort_order == "desc" else 1

    query: dict = {}
    if search:
        query["$or"] = [
            {"filename": {"$regex": search, "$options": "i"}},
            {"bank_detected": {"$regex": search, "$options": "i"}},
        ]
    if bank:
        query["bank_detected"] = bank
    if label:
        query["label"] = label

    col = _statements()
    total = col.count_documents(query)

    projection = {
        "_id": 1, "filename": 1, "file_size_bytes": 1, "bank_detected": 1,
        "currency_detected": 1, "transaction_count": 1, "total_debits": 1,
        "total_credits": 1, "net": 1, "confidence": 1, "consensus_method": 1,
        "parsing_method": 1, "label": 1, "notes": 1,
        "statement_period_from": 1, "statement_period_to": 1,
        "card_last4": 1, "card_network": 1, "created_at": 1,
    }

    offset = (page - 1) * page_size
    cursor = col.find(query, projection).sort(sort_by, sort_dir).skip(offset).limit(page_size)

    return {
        "statements": [doc_to_dict(d) for d in cursor],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


def get_statement_detail(statement_id: str) -> Optional[dict]:
    """Full detail including LLM calls and API response."""
    stmt = _statements().find_one({"_id": statement_id})
    if not stmt:
        return None

    result = doc_to_dict(stmt)

    # LLM calls for this statement
    calls = _llm_calls().find(
        {"statement_id": statement_id},
        {"_id": 1, "stage": 1, "provider": 1, "provider_model": 1,
         "system_prompt": 1, "user_message": 1, "raw_response": 1,
         "parsed_response": 1, "success": 1, "error": 1,
         "latency_ms": 1, "created_at": 1},
    ).sort("created_at", 1)

    result["llm_calls"] = [doc_to_dict(c) for c in calls]

    # Full response
    resp_doc = _responses().find_one({"statement_id": statement_id})
    result["full_response"] = resp_doc["response_json"] if resp_doc else None

    return result


def update_statement_label(statement_id: str, label: str = "", notes: str = "") -> bool:
    """Update the label and notes for a statement."""
    now = datetime.now(timezone.utc).isoformat()
    result = _statements().update_one(
        {"_id": statement_id},
        {"$set": {"label": label, "notes": notes, "updated_at": now}},
    )
    return result.matched_count > 0


def delete_statement(statement_id: str) -> bool:
    """Delete a statement, all related data, and stored PDF."""
    result = _statements().delete_one({"_id": statement_id})
    if result.deleted_count > 0:
        # Manual cascade — MongoDB has no FK cascades
        _llm_calls().delete_many({"statement_id": statement_id})
        _responses().delete_one({"statement_id": statement_id})
        delete_pdf(statement_id)
        return True
    return False


# ---------------------------------------------------------------------------
# PDF storage (file-system — unchanged from SQLite version)
# ---------------------------------------------------------------------------

def save_pdf(statement_id: str, file_bytes: bytes) -> None:
    """Save uploaded PDF to disk for later viewing."""
    if not settings.DASHBOARD_ENABLED:
        return
    try:
        pdf_path = PDF_STORAGE_DIR / f"{statement_id}.pdf"
        pdf_path.write_bytes(file_bytes)
        logger.debug("[dashboard_db] Saved PDF %s (%d bytes)", pdf_path.name, len(file_bytes))
    except Exception:
        logger.warning("[dashboard_db] Failed to save PDF", exc_info=True)


def get_pdf_path(statement_id: str) -> Path | None:
    """Return path to stored PDF, or None if not found."""
    pdf_path = PDF_STORAGE_DIR / f"{statement_id}.pdf"
    return pdf_path if pdf_path.exists() else None


def delete_pdf(statement_id: str) -> None:
    """Delete stored PDF from disk."""
    pdf_path = PDF_STORAGE_DIR / f"{statement_id}.pdf"
    if pdf_path.exists():
        pdf_path.unlink()


def get_all_labels() -> list[str]:
    """Get all unique labels."""
    labels = _statements().distinct("label", {"label": {"$ne": ""}})
    return sorted(labels)

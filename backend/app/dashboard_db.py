"""
Dashboard SQLite storage — persists parsed statement history,
LLM call traces, and full API responses for the web dashboard.

Uses Python's built-in sqlite3. Dashboard writes are non-critical
and never block the parse pipeline.
"""

import json
import logging
import sqlite3
from pathlib import Path
from typing import Optional
from uuid import uuid4

from app.config import settings

PDF_STORAGE_DIR = Path(settings.DASHBOARD_DB_PATH).parent / "pdfs"

logger = logging.getLogger(__name__)

_DB_PATH: Path | None = None


def _get_db_path() -> Path:
    global _DB_PATH
    if _DB_PATH is None:
        _DB_PATH = Path(settings.DASHBOARD_DB_PATH)
    return _DB_PATH


def _connect() -> sqlite3.Connection:
    db_path = _get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_dashboard_db() -> None:
    """Create tables if they don't exist. Called at app startup."""
    if not settings.DASHBOARD_ENABLED:
        return

    conn = _connect()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS statements (
                id                    TEXT PRIMARY KEY,
                filename              TEXT NOT NULL,
                file_size_bytes       INTEGER,
                bank_detected         TEXT,
                currency_detected     TEXT,
                country_detected      TEXT,
                region_detected       TEXT,
                date_format_detected  TEXT,
                statement_type_detected TEXT,
                language_detected     TEXT,
                transaction_count     INTEGER,
                total_debits          REAL,
                total_credits         REAL,
                net                   REAL,
                confidence            REAL,
                consensus_method      TEXT,
                llm_count             INTEGER,
                llm_sources           TEXT,
                transactions_flagged  INTEGER,
                parsing_method        TEXT,
                label                 TEXT DEFAULT '',
                notes                 TEXT DEFAULT '',
                statement_period_from TEXT,
                statement_period_to   TEXT,
                card_last4            TEXT,
                card_network          TEXT,
                pdf_password          TEXT,
                created_at            TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS llm_calls (
                id              TEXT PRIMARY KEY,
                statement_id    TEXT NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
                stage           TEXT NOT NULL,
                provider        TEXT NOT NULL,
                provider_model  TEXT NOT NULL,
                system_prompt   TEXT,
                user_message    TEXT,
                raw_response    TEXT,
                parsed_response TEXT,
                success         INTEGER NOT NULL DEFAULT 1,
                error           TEXT,
                latency_ms      INTEGER,
                created_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS responses (
                id              TEXT PRIMARY KEY,
                statement_id    TEXT NOT NULL UNIQUE REFERENCES statements(id) ON DELETE CASCADE,
                response_json   TEXT NOT NULL,
                created_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_statements_created_at ON statements(created_at);
            CREATE INDEX IF NOT EXISTS idx_statements_bank ON statements(bank_detected);
            CREATE INDEX IF NOT EXISTS idx_statements_label ON statements(label);
            CREATE INDEX IF NOT EXISTS idx_llm_calls_statement_id ON llm_calls(statement_id);
        """)
        conn.commit()

        # Migrations for existing DBs
        try:
            conn.execute("ALTER TABLE statements ADD COLUMN pdf_password TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists

        logger.info("[dashboard_db] Initialized at %s", _get_db_path())
    finally:
        conn.close()

    PDF_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
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

    conn = _connect()
    try:
        conn.execute(
            """INSERT INTO statements (
                id, filename, file_size_bytes,
                bank_detected, currency_detected, country_detected,
                region_detected, date_format_detected, statement_type_detected,
                language_detected, transaction_count, total_debits, total_credits,
                net, confidence, consensus_method, llm_count, llm_sources,
                transactions_flagged, parsing_method,
                statement_period_from, statement_period_to,
                card_last4, card_network, pdf_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                statement_id,
                filename,
                file_size_bytes,
                response.get("bank_detected"),
                response.get("currency_detected"),
                response.get("country_detected"),
                response.get("region_detected"),
                response.get("date_format_detected"),
                response.get("statement_type_detected"),
                response.get("language_detected"),
                summary.get("total_transactions", 0),
                summary.get("total_debits", 0),
                summary.get("total_credits", 0),
                summary.get("net", 0),
                validation.get("confidence"),
                validation.get("consensus_method"),
                validation.get("llm_count"),
                json.dumps(validation.get("llm_sources", [])),
                validation.get("transactions_flagged"),
                parsing_method,
                period.get("from"),
                period.get("to"),
                card_info.get("card_last4"),
                card_info.get("card_network"),
                pdf_password,
            ),
        )
        conn.commit()
    except Exception:
        logger.warning("[dashboard_db] Failed to save statement %s", statement_id, exc_info=True)
    finally:
        conn.close()


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

    conn = _connect()
    try:
        conn.execute(
            """INSERT INTO llm_calls (
                id, statement_id, stage, provider, provider_model,
                system_prompt, user_message, raw_response, parsed_response,
                success, error, latency_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                uuid4().hex,
                statement_id,
                stage,
                provider,
                provider_model,
                system_prompt,
                user_message,
                raw_response,
                json.dumps(parsed_response) if parsed_response else None,
                1 if success else 0,
                error,
                latency_ms,
            ),
        )
        conn.commit()
    except Exception:
        logger.warning("[dashboard_db] Failed to save llm_call", exc_info=True)
    finally:
        conn.close()


def save_response(statement_id: str, response: dict) -> None:
    """Store the full API response JSON."""
    if not settings.DASHBOARD_ENABLED:
        return

    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO responses (id, statement_id, response_json) VALUES (?, ?, ?)",
            (uuid4().hex, statement_id, json.dumps(response, default=str)),
        )
        conn.commit()
    except Exception:
        logger.warning("[dashboard_db] Failed to save response", exc_info=True)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_stats() -> dict:
    """Aggregate dashboard statistics."""
    conn = _connect()
    try:
        row = conn.execute("""
            SELECT
                COUNT(*) as total_statements,
                COALESCE(SUM(transaction_count), 0) as total_transactions,
                COALESCE(AVG(confidence), 0) as avg_confidence,
                COALESCE(SUM(total_debits), 0) as total_debits_all,
                COALESCE(SUM(total_credits), 0) as total_credits_all
            FROM statements
        """).fetchone()

        banks = conn.execute("""
            SELECT bank_detected, COUNT(*) as count
            FROM statements
            WHERE bank_detected IS NOT NULL
            GROUP BY bank_detected
            ORDER BY count DESC
        """).fetchall()

        recent = conn.execute("""
            SELECT id, filename, bank_detected, created_at, transaction_count, confidence, label
            FROM statements
            ORDER BY created_at DESC
            LIMIT 10
        """).fetchall()

        return {
            "total_statements": row["total_statements"],
            "total_transactions": row["total_transactions"],
            "avg_confidence": round(row["avg_confidence"], 4),
            "total_debits_all": round(row["total_debits_all"], 2),
            "total_credits_all": round(row["total_credits_all"], 2),
            "banks": [{"bank": b["bank_detected"], "count": b["count"]} for b in banks],
            "recent": [dict(r) for r in recent],
        }
    finally:
        conn.close()


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
    if sort_order not in ("asc", "desc"):
        sort_order = "desc"

    conn = _connect()
    try:
        conditions = []
        params: list = []

        if search:
            conditions.append("(filename LIKE ? OR bank_detected LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        if bank:
            conditions.append("bank_detected = ?")
            params.append(bank)
        if label:
            conditions.append("label = ?")
            params.append(label)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        total = conn.execute(
            f"SELECT COUNT(*) as cnt FROM statements {where}", params
        ).fetchone()["cnt"]

        offset = (page - 1) * page_size
        rows = conn.execute(
            f"""SELECT id, filename, file_size_bytes, bank_detected, currency_detected,
                       transaction_count, total_debits, total_credits, net,
                       confidence, consensus_method, parsing_method, label, notes,
                       statement_period_from, statement_period_to,
                       card_last4, card_network, created_at
                FROM statements {where}
                ORDER BY {sort_by} {sort_order}
                LIMIT ? OFFSET ?""",
            params + [page_size, offset],
        ).fetchall()

        return {
            "statements": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    finally:
        conn.close()


def get_statement_detail(statement_id: str) -> Optional[dict]:
    """Full detail including LLM calls and API response."""
    conn = _connect()
    try:
        stmt = conn.execute(
            "SELECT * FROM statements WHERE id = ?", (statement_id,)
        ).fetchone()
        if not stmt:
            return None

        llm_calls = conn.execute(
            """SELECT id, stage, provider, provider_model, system_prompt, user_message,
                      raw_response, parsed_response, success, error, latency_ms, created_at
               FROM llm_calls WHERE statement_id = ? ORDER BY created_at""",
            (statement_id,),
        ).fetchall()

        response_row = conn.execute(
            "SELECT response_json FROM responses WHERE statement_id = ?",
            (statement_id,),
        ).fetchone()

        result = dict(stmt)
        result["llm_calls"] = []
        for call in llm_calls:
            call_dict = dict(call)
            if call_dict.get("parsed_response"):
                try:
                    call_dict["parsed_response"] = json.loads(call_dict["parsed_response"])
                except (json.JSONDecodeError, TypeError):
                    pass
            result["llm_calls"].append(call_dict)

        result["full_response"] = None
        if response_row:
            try:
                result["full_response"] = json.loads(response_row["response_json"])
            except (json.JSONDecodeError, TypeError):
                result["full_response"] = response_row["response_json"]

        return result
    finally:
        conn.close()


def update_statement_label(statement_id: str, label: str = "", notes: str = "") -> bool:
    """Update the label and notes for a statement."""
    conn = _connect()
    try:
        cursor = conn.execute(
            """UPDATE statements
               SET label = ?, notes = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (label, notes, statement_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_statement(statement_id: str) -> bool:
    """Delete a statement, all related data (cascades), and stored PDF."""
    conn = _connect()
    try:
        cursor = conn.execute("DELETE FROM statements WHERE id = ?", (statement_id,))
        conn.commit()
        if cursor.rowcount > 0:
            delete_pdf(statement_id)
            return True
        return False
    finally:
        conn.close()


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
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT DISTINCT label FROM statements WHERE label != '' ORDER BY label"
        ).fetchall()
        return [r["label"] for r in rows]
    finally:
        conn.close()

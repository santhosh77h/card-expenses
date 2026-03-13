"""
Dashboard API routes for the web observability UI.

Provides endpoints to browse parsed statements, inspect LLM prompts/responses,
manage labels, and view/update prompt templates.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app import dashboard_db
from app.config import settings
from app.parser import parse_pdf
from app.prompts import get_system_prompt, REGION_PROMPTS
from app.prompts.base import (
    PREAMBLE,
    BASE_RULES,
    CATEGORY_RULES,
    CARD_METADATA_RULES,
    FOOTER,
    STATEMENT_PERIOD_RULES,
    TRANSACTION_TYPE_RULES,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats():
    """Aggregate dashboard statistics."""
    return dashboard_db.get_stats()


# ---------------------------------------------------------------------------
# Statements CRUD
# ---------------------------------------------------------------------------

@router.get("/statements")
async def list_statements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search filename or bank"),
    bank: str = Query("", description="Filter by bank"),
    label: str = Query("", description="Filter by label"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="asc or desc"),
):
    return dashboard_db.get_statements(page, page_size, search, bank, label, sort_by, sort_order)


@router.get("/statements/{statement_id}")
async def get_statement(statement_id: str):
    """Full detail including LLM calls and API response."""
    result = dashboard_db.get_statement_detail(statement_id)
    if not result:
        raise HTTPException(404, "Statement not found")
    return result


class LabelUpdate(BaseModel):
    label: str = ""
    notes: str = ""


@router.patch("/statements/{statement_id}/label")
async def update_label(statement_id: str, body: LabelUpdate):
    ok = dashboard_db.update_statement_label(statement_id, body.label, body.notes)
    if not ok:
        raise HTTPException(404, "Statement not found")
    return {"status": "updated"}


@router.delete("/statements/{statement_id}")
async def delete_statement(statement_id: str):
    ok = dashboard_db.delete_statement(statement_id)
    if not ok:
        raise HTTPException(404, "Statement not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# PDF Viewer
# ---------------------------------------------------------------------------

@router.get("/statements/{statement_id}/pdf")
async def get_statement_pdf(statement_id: str):
    """Serve the stored PDF file for viewing."""
    pdf_path = dashboard_db.get_pdf_path(statement_id)
    if not pdf_path:
        raise HTTPException(404, "PDF not found for this statement")

    stmt = dashboard_db.get_statement_detail(statement_id)
    filename = stmt["filename"] if stmt else "statement.pdf"

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=filename,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

@router.get("/labels")
async def list_labels():
    """Get all unique labels used across statements."""
    return {"labels": dashboard_db.get_all_labels()}


# ---------------------------------------------------------------------------
# Upload (same as main parse but saves to dashboard)
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_statement(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    label: Optional[str] = Form(""),
):
    """Upload and parse a PDF, saving results to dashboard."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    if len(file_bytes) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit.",
        )

    result = await parse_pdf(file_bytes, password=password, filename=file.filename)

    # Apply label if provided
    if label and result.get("_statement_id"):
        dashboard_db.update_statement_label(result["_statement_id"], label)

    return result


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

@router.get("/prompts")
async def get_prompts():
    """Return current prompt templates organized by section and region."""
    regions = {}
    for region_key in REGION_PROMPTS:
        regions[region_key] = get_system_prompt(region_key)

    return {
        "sections": {
            "preamble": PREAMBLE,
            "base_rules": BASE_RULES,
            "transaction_type_rules": TRANSACTION_TYPE_RULES,
            "category_rules": CATEGORY_RULES,
            "statement_period_rules": STATEMENT_PERIOD_RULES,
            "card_metadata_rules": CARD_METADATA_RULES,
            "footer": FOOTER,
        },
        "region_rules": {k: v for k, v in REGION_PROMPTS.items()},
        "composed_prompts": regions,
    }

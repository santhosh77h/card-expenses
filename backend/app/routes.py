"""
API route handlers.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.config import settings
from app.parser import parse_pdf
from app.rate_limiter import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()

DEBUG_DIR = Path(__file__).resolve().parent.parent / "debug"


def _save_debug(filename: str, response: dict) -> None:
    """Save filename + API response to debug/ for inspection."""
    try:
        DEBUG_DIR.mkdir(exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        stem = Path(filename).stem if filename else "unknown"
        debug_path = DEBUG_DIR / f"{ts}_{stem}.json"

        debug_data = {
            "timestamp": datetime.now().isoformat(),
            "filename": filename,
            "response": response,
        }

        debug_path.write_text(json.dumps(debug_data, indent=2, default=str), encoding="utf-8")
        logger.debug("[debug] Saved response to %s", debug_path)
    except Exception:
        logger.warning("[debug] Failed to save debug response", exc_info=True)


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "privacy": "no-data-stored",
        "llm_enabled": settings.llm_enabled,
        "consensus_enabled": settings.consensus_capable,
    }


@router.post("/parse-statement/json")
async def parse_statement(
    request: Request,
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
):
    await check_rate_limit(request)
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

    result = await parse_pdf(file_bytes, password=password, filename=file.filename or "")

    if settings.DEBUG_RESPONSES:
        _save_debug(file.filename, result)

    return result

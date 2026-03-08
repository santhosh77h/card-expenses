"""
API route handlers.
"""

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.parser import parse_pdf

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "privacy": "no-data-stored",
        "llm_enabled": settings.llm_enabled,
    }


@router.post("/parse-statement/json")
async def parse_statement(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
):
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

    return parse_pdf(file_bytes, password=password)

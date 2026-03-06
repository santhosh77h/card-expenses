"""
FastAPI backend for Cardlytics — privacy-first credit card statement parser.

All PDF processing happens in-memory. No financial data is ever stored.
"""

import logging

from dotenv import load_dotenv
load_dotenv()

from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from parser import PDFEncryptedError, parse_pdf

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logging.getLogger("llm_parser").setLevel(logging.DEBUG)

app = FastAPI(
    title="Cardlytics API",
    description="Privacy-first credit card statement parser. No data stored.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@app.get("/health")
async def health():
    return {"status": "ok", "privacy": "no-data-stored"}


@app.post("/parse-statement/json")
async def parse_statement(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit.")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        result = parse_pdf(file_bytes, password=password)
    except PDFEncryptedError as e:
        error_code = str(e)
        message = (
            "This PDF is password-protected. Please provide the password."
            if error_code == "password_required"
            else "The password you entered is incorrect. Please try again."
        )
        raise HTTPException(
            status_code=422,
            detail={"error_code": error_code, "message": message},
        )
    except ValueError as e:
        logger.error("Validation error parsing '%s': %s", file.filename, e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Unexpected error parsing '%s'", file.filename)
        raise HTTPException(
            status_code=500,
            detail="Failed to parse statement. Please try a different PDF.",
        )

    return result

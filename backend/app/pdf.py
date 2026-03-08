"""
PDF text extraction and encryption handling.

Uses pdfplumber as primary extractor with pypdf as fallback.
All processing happens in-memory — no files are written to disk.
"""

import io
import logging
from typing import Optional

import pdfplumber

from app.exceptions import PDFEncryptedError

logger = logging.getLogger(__name__)

# First 5 bytes of a valid PDF file.
_PDF_MAGIC = b"%PDF-"


def validate_pdf_bytes(file_bytes: bytes) -> None:
    """Raise ValueError if the bytes don't look like a PDF."""
    if not file_bytes.startswith(_PDF_MAGIC):
        raise ValueError("File does not appear to be a valid PDF.")


def check_encrypted(file_bytes: bytes) -> bool:
    """Return True if the PDF is encrypted and requires a user password."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        if not reader.is_encrypted:
            return False
        # Some PDFs use an empty owner password (print restrictions only).
        if reader.decrypt("") > 0:
            return False
        return True
    except Exception:
        return False


def extract_text(file_bytes: bytes, password: Optional[str] = None) -> str:
    """
    Extract text from a PDF.

    Tries pdfplumber first, falls back to pypdf if pdfplumber yields nothing.
    Raises PDFEncryptedError if the PDF requires a password.
    """
    text = _extract_with_pdfplumber(file_bytes, password)

    if not text.strip():
        text = _extract_with_pypdf(file_bytes, password)

    return text


def _extract_with_pdfplumber(file_bytes: bytes, password: Optional[str]) -> str:
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes), password=password) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception:
        pass
    return text


def _extract_with_pypdf(file_bytes: bytes, password: Optional[str]) -> str:
    text = ""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            if not password:
                raise PDFEncryptedError("password_required")
            if reader.decrypt(password) == 0:
                raise PDFEncryptedError("incorrect_password")
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except PDFEncryptedError:
        raise
    except Exception:
        pass
    return text

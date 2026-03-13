"""
PDF text extraction and encryption handling.

Uses pdfplumber as primary extractor with pypdf as fallback.
All processing happens in-memory — no files are written to disk.
"""

import io
import logging
from dataclasses import dataclass
from typing import Optional

import pdfplumber

from app.exceptions import PDFEncryptedError

logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """Text extraction result with optional layout supplement for LLM."""
    text: str
    table_supplement: str

# First 5 bytes of a valid PDF file.
_PDF_MAGIC = b"%PDF-"


def validate_pdf_bytes(file_bytes: bytes) -> None:
    """Raise ValueError if the bytes don't look like a PDF."""
    if not file_bytes.startswith(_PDF_MAGIC):
        raise ValueError("File does not appear to be a valid PDF.")


def check_encrypted(file_bytes: bytes) -> bool:
    """Return True if the PDF is encrypted and requires a user password."""
    # Try pypdf first
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        logger.info("[check_encrypted] pypdf: is_encrypted=%s", reader.is_encrypted)
        if not reader.is_encrypted:
            return False
        # Some PDFs use an empty owner password (print restrictions only).
        result = reader.decrypt("")
        logger.info("[check_encrypted] pypdf: decrypt('')=%s", result)
        if result > 0:
            return False
        return True
    except Exception as e:
        logger.warning("[check_encrypted] pypdf failed: %s: %s", type(e).__name__, e)

    # Fallback: try pdfplumber to detect encryption
    try:
        logger.info("[check_encrypted] Trying pdfplumber fallback...")
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            if pdf.pages:
                pdf.pages[0].extract_text()
        logger.info("[check_encrypted] pdfplumber opened OK — not encrypted")
        return False
    except Exception as e:
        logger.info("[check_encrypted] pdfplumber failed: %s: %s", type(e).__name__, e)
        err_str = str(e).lower()
        if "password" in err_str or "encrypt" in err_str or "decrypt" in err_str:
            logger.info("[check_encrypted] Detected encryption keyword in error")
            return True
        return False


def extract_text(file_bytes: bytes, password: Optional[str] = None) -> str:
    """
    Extract text from a PDF.

    Tries pdfplumber first, falls back to pypdf if pdfplumber yields nothing.
    Raises PDFEncryptedError if the PDF requires a password.
    """
    logger.info("[extract_text] Starting extraction (password=%s)", "provided" if password else "none")
    text = _extract_with_pdfplumber(file_bytes, password)
    logger.info("[extract_text] pdfplumber result: %d chars", len(text.strip()))

    if not text.strip():
        text = _extract_with_pypdf(file_bytes, password)
        logger.info("[extract_text] pypdf result: %d chars", len(text.strip()))

    return text


def extract_text_and_tables(
    file_bytes: bytes, password: Optional[str] = None
) -> ExtractionResult:
    """
    Extract text and a layout-preserved supplement from a PDF.

    Returns both the compact text (for regex parsers) and a layout-preserved
    version of the first 2 pages (for LLM parsing). The layout text preserves
    spatial relationships in tabular sections (e.g. account summary boxes)
    that are lost by the default compact extraction.
    """
    text = extract_text(file_bytes, password)
    table_supplement = _extract_table_supplement(file_bytes, password)
    return ExtractionResult(text=text, table_supplement=table_supplement)


def _extract_table_supplement(
    file_bytes: bytes, password: Optional[str] = None, max_pages: int = 2
) -> str:
    """Extract layout-preserved text from the first N pages for LLM context."""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes), password=password) as pdf:
            pages = []
            for page in pdf.pages[:max_pages]:
                layout_text = page.extract_text(layout=True)
                if layout_text:
                    pages.append(layout_text)
        if pages:
            return "\n--- LAYOUT-PRESERVED TEXT (Pages 1-{}) ---\n{}".format(
                len(pages), "\n--- PAGE BREAK ---\n".join(pages)
            )
    except Exception:
        logger.warning("[table_supplement] Layout extraction failed", exc_info=True)
    return ""


def _extract_with_pdfplumber(file_bytes: bytes, password: Optional[str]) -> str:
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes), password=password) as pdf:
            logger.info("[pdfplumber] Opened PDF, pages=%d", len(pdf.pages))
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                if i == 0:
                    logger.info("[pdfplumber] Page 0 text length=%d", len(page_text or ""))
    except PDFEncryptedError:
        raise
    except Exception as e:
        logger.warning("[pdfplumber] Exception: %s: %s", type(e).__name__, e)
        err_str = str(e).lower()
        if "password" in err_str or "encrypt" in err_str or "decrypt" in err_str:
            logger.info("[pdfplumber] Detected encryption error, raising PDFEncryptedError")
            if not password:
                raise PDFEncryptedError("password_required")
            else:
                raise PDFEncryptedError("incorrect_password")
    return text


def _extract_with_pypdf(file_bytes: bytes, password: Optional[str]) -> str:
    text = ""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        logger.info("[pypdf] is_encrypted=%s", reader.is_encrypted)
        if reader.is_encrypted:
            if not password:
                logger.info("[pypdf] Encrypted, no password — raising password_required")
                raise PDFEncryptedError("password_required")
            result = reader.decrypt(password)
            logger.info("[pypdf] decrypt() result=%s", result)
            if result == 0:
                raise PDFEncryptedError("incorrect_password")
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
            if i == 0:
                logger.info("[pypdf] Page 0 text length=%d", len(page_text or ""))
    except PDFEncryptedError:
        raise
    except Exception as e:
        logger.warning("[pypdf] Exception: %s: %s", type(e).__name__, e)
        err_str = str(e).lower()
        if "password" in err_str or "encrypt" in err_str or "decrypt" in err_str:
            logger.info("[pypdf] Detected encryption error, raising PDFEncryptedError")
            if not password:
                raise PDFEncryptedError("password_required")
            else:
                raise PDFEncryptedError("incorrect_password")
    return text

"""
Custom exceptions and FastAPI error handlers.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class PDFEncryptedError(Exception):
    """Raised when a PDF is encrypted and no valid password was provided."""

    def __init__(self, code: str):
        # code: "password_required" | "incorrect_password"
        self.code = code
        super().__init__(code)


class ParseError(Exception):
    """Raised when PDF parsing fails for a known reason (e.g., no text, unsupported format)."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    """Register structured error handlers on the FastAPI app."""

    @app.exception_handler(PDFEncryptedError)
    async def _handle_encrypted(_request: Request, exc: PDFEncryptedError) -> JSONResponse:
        message = (
            "This PDF is password-protected. Please provide the password."
            if exc.code == "password_required"
            else "The password you entered is incorrect. Please try again."
        )
        return JSONResponse(
            status_code=422,
            content={"error_code": exc.code, "message": message},
        )

    @app.exception_handler(ParseError)
    async def _handle_parse_error(_request: Request, exc: ParseError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error_code": "parse_error", "message": exc.message},
        )

"""Global API key + HMAC request signing middleware."""

import hashlib
import hmac
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

EXEMPT_PATHS = {"/health", "/docs", "/openapi.json"}
EXEMPT_PREFIXES = ("/auth/", "/webhooks/", "/api/admin/", "/api/blog/")

HMAC_WINDOW_SECONDS = 60


def _is_exempt(path: str) -> bool:
    if path in EXEMPT_PATHS:
        return True
    return any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES)


def _verify_hmac(request: Request) -> str | None:
    """Verify HMAC signature. Returns error message or None if valid."""
    timestamp_str = request.headers.get("X-Timestamp", "")
    signature = request.headers.get("X-Signature", "")

    if not timestamp_str or not signature:
        return "Missing X-Timestamp or X-Signature headers"

    # Validate timestamp is within window
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return "Invalid X-Timestamp"

    now = int(time.time())
    if abs(now - timestamp) > HMAC_WINDOW_SECONDS:
        return "Request timestamp expired"

    # Compute expected signature
    path = request.url.path
    message = f"{timestamp_str}.{path}"
    expected = hmac.new(
        settings.HMAC_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        return "Invalid request signature"

    return None


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if _is_exempt(path):
            return await call_next(request)

        # API key check
        if settings.VECTOR_API_KEY:
            api_key = request.headers.get("X-Vector-API-Key")
            if api_key != settings.VECTOR_API_KEY:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or missing API key"},
                )

        # HMAC signature check (skip if secret not configured)
        if settings.HMAC_SECRET:
            error = _verify_hmac(request)
            if error:
                return JSONResponse(
                    status_code=401,
                    content={"detail": error},
                )

        return await call_next(request)

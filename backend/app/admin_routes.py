"""
Admin authentication routes.

Handles admin login/logout for the customer-webpage blog admin panel.
Uses JWT tokens signed with the same secret as the mobile app auth.
"""

import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

_ADMIN_TOKEN_EXPIRY_DAYS = 7


class AdminLoginRequest(BaseModel):
    password: str


def _create_admin_token() -> str:
    """Create a JWT token for admin sessions."""
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY is not set")

    now = datetime.now(timezone.utc)
    payload = {
        "sub": "admin",
        "role": "admin",
        "iat": now,
        "exp": now + timedelta(days=_ADMIN_TOKEN_EXPIRY_DAYS),
        "type": "admin_access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def verify_admin_token(token: str) -> dict:
    """Verify an admin JWT token. Returns payload or raises."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "admin_access" or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Not an admin token")

    return payload


@router.post("/login")
async def admin_login(body: AdminLoginRequest):
    """Validate admin password and return a JWT session token."""
    if not settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=500, detail="Admin login is not configured")

    if body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")

    token = _create_admin_token()
    logger.info("[admin] Admin login successful")
    return {"ok": True, "token": token}


@router.post("/verify")
async def admin_verify_session(token: str = ""):
    """Verify an admin session token is still valid."""
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    verify_admin_token(token)
    return {"valid": True}


@router.post("/logout")
async def admin_logout():
    """Admin logout — stateless JWT, so this is a no-op on the backend.
    The frontend clears the cookie."""
    return {"ok": True}

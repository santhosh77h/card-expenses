"""
JWT utilities for Vector session management.

Issues short-lived HS256 access tokens and opaque refresh tokens.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

logger = logging.getLogger(__name__)


def _get_secret() -> str:
    """Return the JWT signing secret. Raises if not configured."""
    if not settings.JWT_SECRET_KEY:
        raise RuntimeError("JWT_SECRET_KEY is not set — cannot issue tokens")
    return settings.JWT_SECRET_KEY


def create_access_token(apple_user_id: str) -> str:
    """Create a short-lived HS256 access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": apple_user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, _get_secret(), algorithm="HS256")


def create_token_pair(apple_user_id: str) -> dict:
    """
    Create an access + refresh token pair.

    Returns:
        {
            "access_token": str,
            "refresh_token": str,          # raw token (send to client)
            "refresh_token_hash": str,     # SHA-256 hash (store in DB)
            "expires_in": int,             # access token TTL in seconds
        }
    """
    access_token = create_access_token(apple_user_id)
    refresh_token = f"vprt_{secrets.token_urlsafe(48)}"

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "refresh_token_hash": hash_token(refresh_token),
        "expires_in": settings.JWT_ACCESS_EXPIRY_MINUTES * 60,
    }


def decode_access_token(token: str) -> dict:
    """
    Validate and decode an access token.

    Returns the payload dict (contains 'sub', 'iat', 'exp', 'type').

    Raises:
        jwt.ExpiredSignatureError: If the token has expired.
        jwt.InvalidTokenError: If the token is invalid.
    """
    payload = jwt.decode(token, _get_secret(), algorithms=["HS256"])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Token is not an access token")
    return payload


def hash_token(raw: str) -> str:
    """SHA-256 hash a raw token for secure storage."""
    return hashlib.sha256(raw.encode()).hexdigest()

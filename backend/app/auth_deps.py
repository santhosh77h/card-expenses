"""
FastAPI dependencies for JWT-based authentication.

Provides ``get_current_user`` (required) and ``get_optional_user`` (optional)
for use with ``Depends()`` on protected endpoints.
"""

import logging
from typing import Optional

import jwt as pyjwt
from fastapi import Header, HTTPException

from app.jwt_utils import decode_access_token
from app.user_db import find_or_create_user, get_subscription, get_trial, is_trial_active, trial_parses_remaining

logger = logging.getLogger(__name__)


def _extract_bearer(authorization: str) -> Optional[str]:
    """Extract the token from 'Bearer <token>' header value."""
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]


async def get_current_user(authorization: str = Header(default="")) -> dict:
    """
    Decode the Bearer access token and return the user dict.

    Raises 401 if the token is missing, expired, or invalid.
    """
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    try:
        payload = decode_access_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token expired")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid access token: {e}")

    apple_user_id = payload.get("sub")
    if not apple_user_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

    user = find_or_create_user(apple_user_id)
    user["subscription"] = get_subscription(user["id"])
    trial = get_trial(user["id"])
    user["trial"] = trial
    user["trial_active"] = is_trial_active(trial)
    user["trial_remaining"] = trial_parses_remaining(trial) if user["trial_active"] else 0
    return user


async def get_optional_user(authorization: str = Header(default="")) -> Optional[dict]:
    """
    Like ``get_current_user`` but returns ``None`` for anonymous requests
    instead of raising 401. Use on endpoints that serve both authenticated
    and anonymous users (e.g. the parse endpoint).
    """
    token = _extract_bearer(authorization)
    if not token:
        return None

    try:
        payload = decode_access_token(token)
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return None

    apple_user_id = payload.get("sub")
    if not apple_user_id:
        return None

    user = find_or_create_user(apple_user_id)
    user["subscription"] = get_subscription(user["id"])
    trial = get_trial(user["id"])
    user["trial"] = trial
    user["trial_active"] = is_trial_active(trial)
    user["trial_remaining"] = trial_parses_remaining(trial) if user["trial_active"] else 0
    return user

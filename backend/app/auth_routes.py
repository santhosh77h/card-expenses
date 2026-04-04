"""
Authentication routes — Sign in with Apple, token refresh, logout.
"""

import logging

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.apple_auth import verify_identity_token
from app.auth_deps import get_current_user
from app.jwt_utils import create_token_pair, hash_token
from app.user_db import (
    delete_refresh_token,
    delete_refresh_tokens,
    find_or_create_user,
    get_subscription,
    get_trial,
    grant_trial_if_needed,
    is_trial_active,
    store_refresh_token,
    trial_parses_remaining,
    validate_refresh_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class AppleAuthRequest(BaseModel):
    identity_token: str
    user_id: str
    email: Optional[str] = None  # Fallback email from Apple credential


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------------------------------------------------------------------------
# POST /auth/apple
# ---------------------------------------------------------------------------

@router.post("/apple")
async def apple_sign_in(body: AppleAuthRequest):
    """
    Verify an Apple identity token and return session tokens.

    - Validates the JWT against Apple's public keys
    - Confirms the token ``sub`` matches the provided ``user_id``
    - Upserts the user in MongoDB
    - Returns access + refresh tokens
    """
    try:
        verified = await verify_identity_token(body.identity_token)
    except ValueError as e:
        logger.warning("[auth] Apple token verification failed: %s", e)
        raise HTTPException(status_code=401, detail=str(e))

    # Confirm sub matches the user_id from the client
    if verified["apple_user_id"] != body.user_id:
        raise HTTPException(
            status_code=401,
            detail="Token subject does not match provided user_id",
        )

    # Prefer JWT email (trusted); fall back to client-provided email
    email = verified.get("email") or body.email

    # Upsert user
    apple_user_id = verified["apple_user_id"]
    user = find_or_create_user(
        apple_user_id=apple_user_id,
        email=email,
        email_verified=verified.get("email_verified", False),
    )
    user_id = user["id"]

    # Grant free trial if this is a new user with no subscription
    grant_trial_if_needed(user_id, apple_user_id)

    # Create session tokens
    tokens = create_token_pair(apple_user_id)
    store_refresh_token(tokens["refresh_token_hash"], user_id, apple_user_id)

    # Include subscription + trial status
    subscription = get_subscription(user_id)
    trial = get_trial(user_id)

    logger.info("[auth] Apple sign-in: user=%s", user_id)

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_in": tokens["expires_in"],
        "user": {
            "id": user_id,
            "apple_user_id": apple_user_id,
            "email": user.get("email"),
            "subscription": subscription,
            "trial": {
                "active": is_trial_active(trial),
                "parses_remaining": trial_parses_remaining(trial),
                "expires_at": trial.get("expires_at") if trial else None,
            } if trial else None,
        },
    }


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------

@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """
    Exchange a valid refresh token for a new access + refresh token pair.

    The old refresh token is consumed (deleted) and a new one is issued.
    """
    token_hash = hash_token(body.refresh_token)
    stored = validate_refresh_token(token_hash)

    if not stored:
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

    apple_user_id = stored.get("apple_user_id", "")

    # Rotate: delete old, issue new
    delete_refresh_token(token_hash)
    tokens = create_token_pair(apple_user_id)

    user = find_or_create_user(apple_user_id)
    user_id = user["id"]

    store_refresh_token(tokens["refresh_token_hash"], user_id, apple_user_id)

    subscription = get_subscription(user_id)
    trial = get_trial(user_id)

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_in": tokens["expires_in"],
        "user": {
            "id": user_id,
            "apple_user_id": apple_user_id,
            "email": user.get("email"),
            "subscription": subscription,
            "trial": {
                "active": is_trial_active(trial),
                "parses_remaining": trial_parses_remaining(trial),
                "expires_at": trial.get("expires_at") if trial else None,
            } if trial else None,
        },
    }


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """Revoke all refresh tokens for the authenticated user."""
    delete_refresh_tokens(user["id"])
    logger.info("[auth] Logout: user=%s", user["id"])
    return {"status": "ok"}

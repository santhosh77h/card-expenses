"""
Authentication routes — Sign in with Apple, token refresh, logout.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.apple_auth import verify_identity_token
from app.auth_deps import get_current_user
from app.jwt_utils import create_token_pair, hash_token
from app.user_db import (
    delete_refresh_tokens,
    delete_refresh_token,
    find_or_create_user,
    get_subscription,
    grant_trial_if_needed,
    store_refresh_token,
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

    # Upsert user
    user = find_or_create_user(
        apple_user_id=verified["apple_user_id"],
        email=verified.get("email"),
        email_verified=verified.get("email_verified", False),
    )

    # Grant free trial if this is a new user with no subscription
    grant_trial_if_needed(verified["apple_user_id"])

    # Create session tokens
    tokens = create_token_pair(verified["apple_user_id"])
    store_refresh_token(tokens["refresh_token_hash"], verified["apple_user_id"])

    # Include subscription status
    subscription = get_subscription(verified["apple_user_id"])

    logger.info("[auth] Apple sign-in: user=%s", user["id"])

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_in": tokens["expires_in"],
        "user": {
            "id": user["id"],
            "apple_user_id": user["apple_user_id"],
            "email": user.get("email"),
            "subscription": subscription,
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

    apple_user_id = stored["apple_user_id"]

    # Rotate: delete old, issue new
    delete_refresh_token(token_hash)
    tokens = create_token_pair(apple_user_id)
    store_refresh_token(tokens["refresh_token_hash"], apple_user_id)

    user = find_or_create_user(apple_user_id)
    subscription = get_subscription(apple_user_id)

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "expires_in": tokens["expires_in"],
        "user": {
            "id": user["id"],
            "apple_user_id": user["apple_user_id"],
            "email": user.get("email"),
            "subscription": subscription,
        },
    }


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """Revoke all refresh tokens for the authenticated user."""
    delete_refresh_tokens(user["apple_user_id"])
    logger.info("[auth] Logout: user=%s", user["id"])
    return {"status": "ok"}

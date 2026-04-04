"""
Admin authentication routes.

Handles admin login/logout for the customer-webpage blog admin panel.
Uses JWT tokens signed with the same secret as the mobile app auth.
"""

import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.user_db import (
    find_user_by_email,
    get_credit_balance,
    get_subscription,
    get_trial,
    get_usage,
    is_subscription_active,
    is_trial_active,
    trial_parses_remaining,
)

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


# ---------------------------------------------------------------------------
# Admin dependency
# ---------------------------------------------------------------------------

def require_admin(authorization: str = Header(...)) -> dict:
    """Extract and verify admin Bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    return verify_admin_token(token)


# ---------------------------------------------------------------------------
# GET /api/admin/user/lookup?email=...
# ---------------------------------------------------------------------------

@router.get("/user/lookup")
async def admin_user_lookup(
    email: str = Query(..., description="User email to look up"),
    _admin: dict = Depends(require_admin),
):
    """Look up a user by email and return their trial, subscription, usage, and credits."""
    user = find_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="No user found with that email")

    user_id = user["id"]

    # Trial
    trial = get_trial(user_id)
    trial_active = is_trial_active(trial)
    t_remaining = trial_parses_remaining(trial) if trial_active else 0

    # Subscription
    subscription = get_subscription(user_id)
    sub_active = is_subscription_active(subscription)
    usage = get_usage(user_id)
    parses_used = usage.get("parses_used", 0)
    max_parses = subscription.get("max_parses", 0) if sub_active else 0
    sub_remaining = max(0, max_parses - parses_used)

    # Credits
    credit_balance = get_credit_balance(user_id)

    return {
        "user": {
            "id": user_id,
            "apple_user_id": user["apple_user_id"],
            "email": user.get("email"),
            "email_verified": user.get("email_verified", False),
            "created_at": user.get("created_at"),
        },
        "trial": {
            "active": trial_active,
            "max_parses": trial.get("max_parses", 0),
            "parses_used": trial.get("parses_used", 0),
            "parses_remaining": t_remaining,
            "expires_at": trial.get("expires_at") or trial.get("current_period_end"),
        } if trial else None,
        "subscription": {
            "plan": subscription["plan"],
            "status": subscription["status"] if sub_active else "expired",
            "max_parses": subscription["max_parses"],
            "current_period_start": subscription.get("current_period_start"),
            "current_period_end": subscription.get("current_period_end"),
        } if subscription else None,
        "usage": {
            "month": usage["month"],
            "parses_used": parses_used,
            "parses_remaining": sub_remaining,
        },
        "credits": {
            "balance": credit_balance,
        },
    }

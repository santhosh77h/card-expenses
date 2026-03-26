"""
Subscription and usage API routes.

Provides endpoints for the mobile app to check subscription status
and remaining parse allowance.
"""

import logging

from fastapi import APIRouter, Depends

from app.auth_deps import get_current_user
from app.user_db import get_subscription, get_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["subscription"])


@router.get("/subscription")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    """Return the user's current subscription and usage for this month."""
    apple_user_id = user["apple_user_id"]

    subscription = get_subscription(apple_user_id)
    usage = get_usage(apple_user_id)

    parses_remaining = 0
    if subscription and subscription.get("status") == "active":
        max_parses = subscription.get("max_parses", 0)
        parses_remaining = max(0, max_parses - usage.get("parses_used", 0))

    return {
        "subscription": {
            "plan": subscription["plan"],
            "status": subscription["status"],
            "max_parses": subscription["max_parses"],
            "current_period_end": subscription.get("current_period_end"),
        } if subscription else None,
        "usage": {
            "month": usage["month"],
            "parses_used": usage["parses_used"],
            "parses_remaining": parses_remaining,
        },
    }


@router.get("/usage/check")
async def check_usage(user: dict = Depends(get_current_user)):
    """
    Lightweight pre-check: is the user allowed to parse?

    No side effects — does not increment usage.
    """
    apple_user_id = user["apple_user_id"]

    subscription = get_subscription(apple_user_id)
    usage = get_usage(apple_user_id)

    if not subscription or subscription.get("status") != "active":
        return {"allowed": False, "parses_remaining": 0, "reason": "No active subscription"}

    max_parses = subscription.get("max_parses", 0)
    parses_used = usage.get("parses_used", 0)
    remaining = max(0, max_parses - parses_used)

    return {
        "allowed": remaining > 0,
        "parses_remaining": remaining,
        "reason": None if remaining > 0 else "Monthly parse limit reached",
    }

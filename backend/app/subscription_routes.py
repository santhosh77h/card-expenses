"""
Subscription, trial, and usage API routes.

Provides endpoints for the mobile app to check subscription status,
trial status, and remaining parse allowance.
"""

import logging

from fastapi import APIRouter, Depends

from app.auth_deps import get_current_user
from app.user_db import (
    get_credit_balance,
    get_credit_info,
    get_subscription,
    get_trial,
    get_usage,
    is_subscription_active,
    is_trial_active,
    trial_parses_remaining,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["subscription"])


@router.get("/subscription")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    """Return the user's current trial, subscription, and usage for this month."""
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


@router.get("/usage/check")
async def check_usage(user: dict = Depends(get_current_user)):
    """
    Lightweight pre-check: is the user allowed to parse?

    No side effects — does not increment usage.
    Checks trial first, then subscription allowance, then credit balance.
    """
    user_id = user["id"]

    # Trial
    trial = get_trial(user_id)
    trial_active = is_trial_active(trial)
    trial_remaining = trial_parses_remaining(trial) if trial_active else 0

    # Subscription
    subscription = get_subscription(user_id)
    sub_active = is_subscription_active(subscription)
    usage = get_usage(user_id)
    max_parses = subscription.get("max_parses", 0) if sub_active else 0
    sub_remaining = max(0, max_parses - usage.get("parses_used", 0))

    # Credits
    credit_balance = get_credit_balance(user_id)

    allowed = trial_remaining > 0 or sub_remaining > 0 or credit_balance > 0

    reason = None
    if not allowed:
        reason = "No trial, subscription, or credits available"

    return {
        "allowed": allowed,
        "trial_remaining": trial_remaining,
        "subscription_remaining": sub_remaining,
        "credit_balance": credit_balance,
        "reason": reason,
    }


@router.get("/credits")
async def get_credits(user: dict = Depends(get_current_user)):
    """Return credit balance and purchase history."""
    user_id = user["id"]
    return get_credit_info(user_id)

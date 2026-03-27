"""
RevenueCat webhook handler.

Receives subscription lifecycle events and updates MongoDB accordingly.
The ``app_user_id`` in RevenueCat events equals the ``apple_user_id``
because the mobile app calls ``Purchases.logIn(appleUserId)``.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings
from app.user_db import (
    find_or_create_user,
    get_subscription,
    reset_usage,
    upsert_subscription,
    _plan_max_parses,
    _product_credits,
    add_credits,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _parse_plan(product_id: str | None) -> str | None:
    """Derive plan name from RevenueCat product_id."""
    if not product_id:
        return None
    pid = product_id.lower()
    if "annual" in pid or "yearly" in pid:
        return "yearly"
    if "month" in pid:
        return "monthly"
    return "monthly"  # default assumption


def _ms_to_iso(ms: int | None) -> str | None:
    """Convert epoch milliseconds to ISO string."""
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()


@router.post("/revenuecat")
async def revenuecat_webhook(request: Request, authorization: str = Header(default="")):
    """
    Handle RevenueCat webhook events.

    Events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
    BILLING_ISSUE, PRODUCT_CHANGE, REFUND.
    """
    # Verify webhook secret
    # RevenueCat sends the raw value in the Authorization header (no "Bearer" prefix)
    if settings.REVENUECAT_WEBHOOK_SECRET:
        token = authorization.removeprefix("Bearer ").strip()
        if token != settings.REVENUECAT_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Invalid webhook authorization")

    body = await request.json()
    event = body.get("event", {})
    event_type = event.get("type", "UNKNOWN")
    app_user_id = event.get("app_user_id", "")
    product_id = event.get("product_id")

    if not app_user_id:
        logger.warning("[webhook] Event %s missing app_user_id, skipping", event_type)
        return {"status": "skipped", "reason": "missing app_user_id"}

    # Skip RevenueCat anonymous IDs (start with $RCAnonymousID:)
    if app_user_id.startswith("$RCAnonymousID:"):
        logger.info("[webhook] Skipping anonymous user event: %s", event_type)
        return {"status": "skipped", "reason": "anonymous_user"}

    logger.info(
        "[webhook] %s — user=%s product=%s",
        event_type, app_user_id, product_id,
    )

    # Ensure user exists
    find_or_create_user(app_user_id)

    if event_type == "INITIAL_PURCHASE":
        plan = _parse_plan(product_id)
        upsert_subscription(
            app_user_id,
            plan=plan,
            product_id=product_id,
            status="active",
            max_parses=_plan_max_parses(plan),
            current_period_start=_ms_to_iso(event.get("purchased_at_ms")),
            current_period_end=_ms_to_iso(event.get("expiration_at_ms")),
        )

    elif event_type == "RENEWAL":
        plan = _parse_plan(product_id)
        upsert_subscription(
            app_user_id,
            plan=plan,
            product_id=product_id,
            status="active",
            max_parses=_plan_max_parses(plan),
            current_period_start=_ms_to_iso(event.get("purchased_at_ms")),
            current_period_end=_ms_to_iso(event.get("expiration_at_ms")),
        )
        # Reset usage for the new billing period
        reset_usage(app_user_id)

    elif event_type == "CANCELLATION":
        # Subscription still active until period end, just mark cancelled
        upsert_subscription(app_user_id, status="cancelled")

    elif event_type == "EXPIRATION":
        upsert_subscription(
            app_user_id,
            status="expired",
            max_parses=0,
        )

    elif event_type == "REFUND":
        upsert_subscription(
            app_user_id,
            status="refunded",
            max_parses=0,
        )

    elif event_type == "PRODUCT_CHANGE":
        plan = _parse_plan(product_id)
        upsert_subscription(
            app_user_id,
            plan=plan,
            product_id=product_id,
            max_parses=_plan_max_parses(plan),
        )

    elif event_type == "NON_RENEWING_PURCHASE":
        # Consumable credit purchase — add credits to user balance
        credit_count = _product_credits(product_id)
        add_credits(app_user_id, credit_count, product_id=product_id)

    elif event_type == "BILLING_ISSUE":
        logger.warning("[webhook] Billing issue for user %s", app_user_id)
        # No state change — RevenueCat handles grace periods

    else:
        logger.info("[webhook] Unhandled event type: %s", event_type)

    return {"status": "ok"}

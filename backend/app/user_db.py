"""
User, subscription, usage, and refresh-token storage in MongoDB.

Collections: users, subscriptions, usage, refresh_tokens.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.config import settings
from app.mongo import doc_to_dict, get_db, nanoid

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Parse-limit constants
# ---------------------------------------------------------------------------

MONTHLY_MAX_PARSES = 4
YEARLY_MAX_PARSES = 4
TRIAL_MAX_PARSES = 15
TRIAL_DAYS = 15


def _plan_max_parses(plan: str | None) -> int:
    if plan == "yearly":
        return YEARLY_MAX_PARSES
    if plan == "monthly":
        return MONTHLY_MAX_PARSES
    if plan == "trial":
        return TRIAL_MAX_PARSES
    return 0


# ---------------------------------------------------------------------------
# Collection accessors
# ---------------------------------------------------------------------------

def _users():
    return get_db()["users"]


def _subscriptions():
    return get_db()["subscriptions"]


def _usage():
    return get_db()["usage"]


def _refresh_tokens():
    return get_db()["refresh_tokens"]


def _credits():
    return get_db()["credits"]


# ---------------------------------------------------------------------------
# Initialisation (call at app startup)
# ---------------------------------------------------------------------------

def init_user_db() -> None:
    """Create indexes for all user-related collections."""
    _users().create_index("apple_user_id", unique=True)

    _subscriptions().create_index("apple_user_id", unique=True)

    _usage().create_index(
        [("apple_user_id", 1), ("month", 1)],
        unique=True,
    )

    _refresh_tokens().create_index("apple_user_id")
    _refresh_tokens().create_index("expires_at", expireAfterSeconds=0)  # TTL index

    _credits().create_index("apple_user_id", unique=True)

    logger.info("[user_db] Indexes created (MongoDB)")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def find_or_create_user(
    apple_user_id: str,
    email: Optional[str] = None,
    email_verified: bool = False,
) -> dict:
    """Upsert a user by apple_user_id. Returns the user dict (with 'id')."""
    now = datetime.now(timezone.utc).isoformat()

    result = _users().find_one_and_update(
        {"apple_user_id": apple_user_id},
        {
            "$setOnInsert": {
                "_id": nanoid(),
                "apple_user_id": apple_user_id,
                "created_at": now,
            },
            "$set": {
                "email": email,
                "email_verified": email_verified,
                "updated_at": now,
            },
        },
        upsert=True,
        return_document=True,
    )
    return doc_to_dict(result)


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------

def get_subscription(apple_user_id: str) -> Optional[dict]:
    """Get the subscription for a user, or None."""
    doc = _subscriptions().find_one({"apple_user_id": apple_user_id})
    return doc_to_dict(doc)


def upsert_subscription(apple_user_id: str, **fields) -> dict:
    """
    Create or update a subscription for the given user.

    Accepted fields: plan, product_id, status, max_parses,
    current_period_start, current_period_end.
    """
    now = datetime.now(timezone.utc).isoformat()

    set_fields = {k: v for k, v in fields.items() if v is not None}
    set_fields["updated_at"] = now

    result = _subscriptions().find_one_and_update(
        {"apple_user_id": apple_user_id},
        {
            "$setOnInsert": {
                "_id": nanoid(),
                "apple_user_id": apple_user_id,
                "created_at": now,
            },
            "$set": set_fields,
        },
        upsert=True,
        return_document=True,
    )
    return doc_to_dict(result)


def grant_trial_if_needed(apple_user_id: str) -> Optional[dict]:
    """
    Grant a free trial (15 parses / 15 days) if the user has no subscription.
    Returns the subscription doc if trial was granted, or None if user already has one.
    """
    existing = get_subscription(apple_user_id)
    if existing:
        return None  # Already has a subscription (trial, active, expired, etc.)

    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)

    return upsert_subscription(
        apple_user_id,
        plan="trial",
        product_id="trial",
        status="active",
        max_parses=TRIAL_MAX_PARSES,
        current_period_start=now.isoformat(),
        current_period_end=trial_end.isoformat(),
    )


# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_usage(apple_user_id: str, month: Optional[str] = None) -> dict:
    """Get usage for a given month (defaults to current). Creates if missing."""
    month = month or _current_month()
    now = datetime.now(timezone.utc).isoformat()

    result = _usage().find_one_and_update(
        {"apple_user_id": apple_user_id, "month": month},
        {
            "$setOnInsert": {
                "_id": nanoid(),
                "apple_user_id": apple_user_id,
                "month": month,
                "parses_used": 0,
            },
            "$set": {"updated_at": now},
        },
        upsert=True,
        return_document=True,
    )
    return doc_to_dict(result)


def increment_usage(apple_user_id: str, month: Optional[str] = None) -> int:
    """Increment parses_used for a month. Returns the new count."""
    month = month or _current_month()
    now = datetime.now(timezone.utc).isoformat()

    result = _usage().find_one_and_update(
        {"apple_user_id": apple_user_id, "month": month},
        {
            "$setOnInsert": {
                "_id": nanoid(),
                "apple_user_id": apple_user_id,
                "month": month,
            },
            "$inc": {"parses_used": 1},
            "$set": {"updated_at": now},
        },
        upsert=True,
        return_document=True,
    )
    return result["parses_used"]


def reset_usage(apple_user_id: str, month: Optional[str] = None) -> None:
    """Reset parses_used to 0 for a given month."""
    month = month or _current_month()
    now = datetime.now(timezone.utc).isoformat()

    _usage().update_one(
        {"apple_user_id": apple_user_id, "month": month},
        {"$set": {"parses_used": 0, "updated_at": now}},
    )


# ---------------------------------------------------------------------------
# Credits (consumable top-ups)
# ---------------------------------------------------------------------------

# Product ID → credit count mapping (must match mobile CREDIT_PRODUCT_MAP)
CREDIT_PRODUCT_MAP: dict[str, int] = {
    "vector_credits_10": 10,
    "vector_credits_100": 100,
}

DEFAULT_CREDITS = 10


def _product_credits(product_id: str | None) -> int:
    """Return the number of credits for a given product ID."""
    if not product_id:
        return DEFAULT_CREDITS
    return CREDIT_PRODUCT_MAP.get(product_id, DEFAULT_CREDITS)


def get_credit_balance(apple_user_id: str) -> int:
    """Get the current credit balance for a user. Returns 0 if none."""
    doc = _credits().find_one({"apple_user_id": apple_user_id})
    if not doc:
        return 0
    return doc.get("balance", 0)


def get_credit_info(apple_user_id: str) -> dict:
    """Get credit balance and purchase history for a user."""
    doc = _credits().find_one({"apple_user_id": apple_user_id})
    if not doc:
        return {"balance": 0, "history": []}
    history = doc.get("history", [])
    # Only return purchase entries (not usage), most recent first
    purchases = [h for h in history if h.get("type") == "purchase"]
    purchases.reverse()
    return {
        "balance": doc.get("balance", 0),
        "history": purchases,
    }


def add_credits(apple_user_id: str, amount: int, product_id: str | None = None) -> int:
    """Add credits to a user's balance. Returns the new balance."""
    now = datetime.now(timezone.utc).isoformat()

    result = _credits().find_one_and_update(
        {"apple_user_id": apple_user_id},
        {
            "$setOnInsert": {
                "_id": nanoid(),
                "apple_user_id": apple_user_id,
                "created_at": now,
            },
            "$inc": {"balance": amount},
            "$set": {"updated_at": now},
            "$push": {
                "history": {
                    "type": "purchase",
                    "amount": amount,
                    "product_id": product_id,
                    "at": now,
                }
            },
        },
        upsert=True,
        return_document=True,
    )
    new_balance = result.get("balance", 0)
    logger.info("[user_db] Credits +%d for %s (product=%s, new_balance=%d)", amount, apple_user_id, product_id, new_balance)
    return new_balance


def use_credit(apple_user_id: str) -> int:
    """Decrement one credit. Returns the new balance. Raises ValueError if balance is 0."""
    now = datetime.now(timezone.utc).isoformat()

    doc = _credits().find_one({"apple_user_id": apple_user_id})
    if not doc or doc.get("balance", 0) <= 0:
        raise ValueError("No credits available")

    result = _credits().find_one_and_update(
        {"apple_user_id": apple_user_id, "balance": {"$gt": 0}},
        {
            "$inc": {"balance": -1},
            "$set": {"updated_at": now},
            "$push": {
                "history": {
                    "type": "used",
                    "amount": -1,
                    "at": now,
                }
            },
        },
        return_document=True,
    )
    if not result:
        raise ValueError("No credits available")

    new_balance = result.get("balance", 0)
    logger.info("[user_db] Credit used for %s (new_balance=%d)", apple_user_id, new_balance)
    return new_balance


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------

def store_refresh_token(
    token_hash: str,
    apple_user_id: str,
    expires_at: Optional[datetime] = None,
) -> None:
    """Store a hashed refresh token."""
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS)

    _refresh_tokens().insert_one({
        "_id": token_hash,
        "apple_user_id": apple_user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


def validate_refresh_token(token_hash: str) -> Optional[dict]:
    """
    Look up a refresh token by hash.

    Returns the document if valid (not expired), or None.
    The TTL index handles cleanup, but we also check expiry here.
    """
    doc = _refresh_tokens().find_one({"_id": token_hash})
    if not doc:
        return None

    expires_at = doc["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        _refresh_tokens().delete_one({"_id": token_hash})
        return None

    return doc


def delete_refresh_token(token_hash: str) -> None:
    """Delete a single refresh token (used during rotation)."""
    _refresh_tokens().delete_one({"_id": token_hash})


def delete_refresh_tokens(apple_user_id: str) -> None:
    """Delete ALL refresh tokens for a user (logout / revocation)."""
    result = _refresh_tokens().delete_many({"apple_user_id": apple_user_id})
    if result.deleted_count:
        logger.info("[user_db] Deleted %d refresh tokens for %s", result.deleted_count, apple_user_id)

"""
LLM-powered transaction extraction using OpenAI structured output.

Falls back gracefully when the API key is missing, the openai package
isn't installed, or the LLM call fails.
"""

import json
import logging
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.categories import CATEGORY_META
from app.config import settings
from app.prompts import get_system_prompt

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 100_000


# ---------------------------------------------------------------------------
# Pydantic models for structured output
# ---------------------------------------------------------------------------

class LLMTransaction(BaseModel):
    date: str = Field(description="Transaction date in YYYY-MM-DD format")
    description: str = Field(description="Transaction description/merchant name")
    amount: float = Field(description="Transaction amount as a positive number")
    type: Literal["debit", "credit"]
    category: str = Field(description="Spending category from the allowed list")


class LLMCardInfo(BaseModel):
    card_last4: Optional[str] = Field(default=None, description="Last 4 digits of the credit card number")
    card_network: Optional[str] = Field(default=None, description="Card network: Visa, Mastercard, American Express, or RuPay")
    credit_limit: Optional[float] = Field(default=None, description="Total credit limit on the card")
    total_amount_due: Optional[float] = Field(default=None, description="Total amount due for this billing cycle")
    minimum_amount_due: Optional[float] = Field(default=None, description="Minimum amount due for this billing cycle")
    payment_due_date: Optional[str] = Field(default=None, description="Payment due date in YYYY-MM-DD format")
    currency: Optional[str] = Field(default=None, description="ISO 4217 currency code: INR, USD, EUR, GBP")


class LLMExtractionResult(BaseModel):
    transactions: list[LLMTransaction]
    statement_period_from: Optional[str] = Field(
        default=None,
        description="Statement period start date in YYYY-MM-DD format",
    )
    statement_period_to: Optional[str] = Field(
        default=None,
        description="Statement period end date in YYYY-MM-DD format",
    )
    card_info: LLMCardInfo = Field(default_factory=LLMCardInfo)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def llm_parse_transactions(text: str, bank_hint: str = "generic", region: str = "IN") -> Optional[dict]:
    """
    Parse transactions from PDF text using OpenAI structured output.

    Returns dict with keys: transactions, statement_period, card_info.
    Returns None if the LLM path is unavailable or fails.
    """
    if not settings.llm_enabled:
        logger.debug("OPENAI_API_KEY not set — skipping LLM parser")
        return None

    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai package not installed — skipping LLM parser")
        return None

    truncated_text = text[:MAX_TEXT_LENGTH]
    user_message = f"Region: {region}\nBank detected: {bank_hint}\n\n--- STATEMENT TEXT ---\n{truncated_text}"

    system_prompt = get_system_prompt(region)
    logger.info("LLM parse: model=%s, bank=%s, region=%s, text_len=%d", settings.OPENAI_MODEL, bank_hint, region, len(user_message))

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT)

        completion = client.beta.chat.completions.parse(
            model=settings.OPENAI_MODEL,
            temperature=0.0,
            messages=messages,
            response_format=LLMExtractionResult,
        )

        result = completion.choices[0].message.parsed

        if result is None or not result.transactions:
            logger.warning("LLM returned no transactions")
            return None

        return _format_result(result)

    except Exception:
        logger.warning("LLM parsing failed — falling back to regex", exc_info=True)
        return None


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _format_result(result: LLMExtractionResult) -> dict:
    """Convert the Pydantic result into the dict format expected downstream."""
    transactions: list[dict] = []
    for tx in result.transactions:
        meta = CATEGORY_META.get(tx.category, CATEGORY_META["Other"])
        transactions.append({
            "date": tx.date,
            "description": tx.description,
            "amount": tx.amount,
            "type": tx.type,
            "category": tx.category if tx.category in CATEGORY_META else "Other",
            "category_color": meta["color"],
            "category_icon": meta["icon"],
        })

    logger.info("LLM extracted %d transactions", len(transactions))
    for i, tx in enumerate(transactions):
        logger.debug(
            "  [%d] %s | %s | %s | %.2f | %s",
            i + 1, tx["date"], tx["type"], tx["description"], tx["amount"], tx["category"],
        )

    card_info = {
        "card_last4": result.card_info.card_last4,
        "card_network": result.card_info.card_network,
        "credit_limit": result.card_info.credit_limit,
        "total_amount_due": result.card_info.total_amount_due,
        "minimum_amount_due": result.card_info.minimum_amount_due,
        "payment_due_date": result.card_info.payment_due_date,
        "currency": result.card_info.currency,
    }

    statement_period = {
        "from": result.statement_period_from,
        "to": result.statement_period_to,
    }

    logger.info("Statement period: %s", json.dumps(statement_period))
    logger.info("Card info: %s", json.dumps(card_info))

    return {
        "transactions": transactions,
        "statement_period": statement_period,
        "card_info": card_info,
    }

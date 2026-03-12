"""
LLM-powered transaction extraction using OpenAI structured output.

Supports both synchronous single-LLM parsing and async multi-provider
parallel parsing for the consensus pipeline.

Falls back gracefully when the API key is missing, the openai package
isn't installed, or the LLM call fails.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.categories import CATEGORY_META
from app.config import settings
from app.prompts import get_system_prompt

logger = logging.getLogger(__name__)

MAX_TEXT_LENGTH = 100_000


# ---------------------------------------------------------------------------
# User message builder (enriched with Stage 1 intelligence)
# ---------------------------------------------------------------------------

def _build_user_message(
    text: str,
    bank_hint: str,
    region: str,
    country: str = "",
    currency: str = "",
    date_format: str = "",
    statement_type: str = "",
) -> str:
    """Build the user message with optional Stage 1 intelligence context."""
    header = f"Region: {region}\nBank detected: {bank_hint}"
    if country:
        header += f"\nCountry: {country}"
    if currency:
        header += f"\nCurrency detected: {currency}"
    if date_format:
        fmt_desc = {"DMY": "day first", "MDY": "month first", "YMD": "year first"}.get(date_format, date_format)
        header += f"\nDate format convention: {date_format} ({fmt_desc})"
    if statement_type:
        header += f"\nStatement type: {statement_type}"
    return f"{header}\n\n--- STATEMENT TEXT ---\n{text[:MAX_TEXT_LENGTH]}"


# ---------------------------------------------------------------------------
# Pydantic models for structured output
# ---------------------------------------------------------------------------

TransactionType = Literal[
    "purchase", "payment", "refund", "reversal", "cashback",
    "emi", "fee", "tax", "interest", "adjustment", "transfer",
]


class LLMTransaction(BaseModel):
    date: str = Field(description="Transaction date in YYYY-MM-DD format")
    description: str = Field(description="Transaction description/merchant name")
    amount: float = Field(description="Transaction amount as a positive number")
    type: Literal["debit", "credit"]
    category: str = Field(description="Spending category from the allowed list")
    transaction_type: TransactionType = Field(
        default="purchase",
        description="Nature of the transaction: purchase, payment, refund, reversal, cashback, emi, fee, tax, interest, adjustment, transfer",
    )


class LLMCardInfo(BaseModel):
    card_last4: Optional[str] = Field(default=None, description="Last 4 digits of the credit card number")
    card_network: Optional[str] = Field(default=None, description="Card network: Visa, Mastercard, American Express, or RuPay")
    credit_limit: Optional[float] = Field(default=None, description="Total credit limit on the card")
    total_amount_due: Optional[float] = Field(default=None, description="Total amount due for this billing cycle")
    minimum_amount_due: Optional[float] = Field(default=None, description="Minimum amount due for this billing cycle")
    payment_due_date: Optional[str] = Field(default=None, description="Payment due date in YYYY-MM-DD format")
    currency: Optional[str] = Field(default=None, description="ISO 4217 currency code: INR, USD, EUR, GBP")

    @model_validator(mode="after")
    def _check_consistency(self) -> "LLMCardInfo":
        """Catch self-contradictions at parse time before data leaves the LLM layer."""
        total = self.total_amount_due
        minimum = self.minimum_amount_due

        # Negative values are nonsensical for dues
        if total is not None and total < 0:
            logger.warning("[LLMCardInfo] total_amount_due is negative (%.2f) — nulling", total)
            self.total_amount_due = None
            total = None
        if minimum is not None and minimum < 0:
            logger.warning("[LLMCardInfo] minimum_amount_due is negative (%.2f) — nulling", minimum)
            self.minimum_amount_due = None
            minimum = None

        # total == minimum → null out total (minimum is more distinctive/reliable)
        if total is not None and minimum is not None and total == minimum:
            logger.warning("[LLMCardInfo] total == minimum (%.2f) — nulling total", total)
            self.total_amount_due = None

        # total < minimum → swap (unambiguous error)
        elif total is not None and minimum is not None and total < minimum:
            logger.warning("[LLMCardInfo] total (%.2f) < minimum (%.2f) — swapping", total, minimum)
            self.total_amount_due = minimum
            self.minimum_amount_due = total

        return self


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

def llm_parse_transactions(text: str, bank_hint: str = "generic", region: str = "IN", **intel_kwargs) -> Optional[dict]:
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

    user_message = _build_user_message(text, bank_hint, region, **intel_kwargs)

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
            "transaction_type": tx.transaction_type,
        })

    logger.info("LLM extracted %d transactions", len(transactions))
    for i, tx in enumerate(transactions):
        logger.debug(
            "  [%d] %s | %s | %s | %.2f | %s | %s",
            i + 1, tx["date"], tx["type"], tx["description"], tx["amount"], tx["category"], tx["transaction_type"],
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


# ---------------------------------------------------------------------------
# Multi-provider async types
# ---------------------------------------------------------------------------

class LLMProvider(str, Enum):
    OPENAI = "openai"
    CLAUDE = "claude"
    GEMINI = "gemini"


@dataclass
class LLMResult:
    provider: LLMProvider
    provider_model: str
    transactions: list[dict]
    statement_period: dict | None
    card_info: dict | None
    success: bool
    error: str | None = None


# ---------------------------------------------------------------------------
# JSON schema for OpenRouter (no Pydantic structured output support)
# ---------------------------------------------------------------------------

def _build_json_schema_prompt() -> str:
    """Build a JSON schema instruction to append to the system prompt for OpenRouter models."""
    return """

IMPORTANT: You MUST respond with valid JSON matching this exact schema:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": 0.00,
      "type": "debit" | "credit",
      "category": "string",
      "transaction_type": "purchase" | "payment" | "refund" | "reversal" | "cashback" | "emi" | "fee" | "tax" | "interest" | "adjustment" | "transfer"
    }
  ],
  "statement_period_from": "YYYY-MM-DD" or null,
  "statement_period_to": "YYYY-MM-DD" or null,
  "card_info": {
    "card_last4": "string" or null,
    "card_network": "string" or null,
    "credit_limit": 0.00 or null,
    "total_amount_due": 0.00 or null,
    "minimum_amount_due": 0.00 or null,
    "payment_due_date": "YYYY-MM-DD" or null,
    "currency": "string" or null
  }
}

Respond ONLY with the JSON object, no markdown fences or extra text."""


def _llm_result_from_formatted(formatted: dict, provider: LLMProvider, model: str) -> LLMResult:
    """Convert _format_result() output into an LLMResult."""
    return LLMResult(
        provider=provider,
        provider_model=model,
        transactions=formatted["transactions"],
        statement_period=formatted.get("statement_period"),
        card_info=formatted.get("card_info"),
        success=True,
    )


# ---------------------------------------------------------------------------
# Async OpenAI parser
# ---------------------------------------------------------------------------

async def async_llm_parse_openai(text: str, bank_hint: str = "generic", region: str = "IN", **intel_kwargs) -> LLMResult:
    """Parse using AsyncOpenAI with structured output (same as sync version)."""
    model = settings.OPENAI_MODEL
    provider = LLMProvider.OPENAI
    provider_model = f"openai/{model}"

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return LLMResult(provider=provider, provider_model=provider_model,
                         transactions=[], statement_period=None, card_info=None,
                         success=False, error="openai package not installed")

    user_message = _build_user_message(text, bank_hint, region, **intel_kwargs)
    system_prompt = get_system_prompt(region)

    logger.info("[async_openai] model=%s, bank=%s, region=%s, text_len=%d",
                model, bank_hint, region, len(user_message))

    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT)
        completion = await client.beta.chat.completions.parse(
            model=model,
            temperature=0.0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format=LLMExtractionResult,
        )

        result = completion.choices[0].message.parsed
        if result is None or not result.transactions:
            return LLMResult(provider=provider, provider_model=provider_model,
                             transactions=[], statement_period=None, card_info=None,
                             success=False, error="LLM returned no transactions")

        formatted = _format_result(result)
        logger.info("[async_openai] extracted %d transactions", len(formatted["transactions"]))
        return _llm_result_from_formatted(formatted, provider, provider_model)

    except Exception as e:
        logger.warning("[async_openai] failed: %s", e, exc_info=True)
        return LLMResult(provider=provider, provider_model=provider_model,
                         transactions=[], statement_period=None, card_info=None,
                         success=False, error=str(e))


# ---------------------------------------------------------------------------
# Async OpenRouter parser (Claude / Gemini)
# ---------------------------------------------------------------------------

async def async_llm_parse_openrouter(
    text: str,
    bank_hint: str = "generic",
    region: str = "IN",
    model: str = "",
    provider: LLMProvider = LLMProvider.CLAUDE,
    **intel_kwargs,
) -> LLMResult:
    """Parse using OpenRouter API (JSON mode, not Pydantic structured output)."""
    provider_model = model

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return LLMResult(provider=provider, provider_model=provider_model,
                         transactions=[], statement_period=None, card_info=None,
                         success=False, error="openai package not installed")

    user_message = _build_user_message(text, bank_hint, region, **intel_kwargs)
    system_prompt = get_system_prompt(region) + _build_json_schema_prompt()

    logger.info("[async_openrouter] model=%s, bank=%s, region=%s, text_len=%d",
                model, bank_hint, region, len(user_message))

    try:
        client = AsyncOpenAI(
            base_url=settings.OPENROUTER_BASE_URL,
            api_key=settings.OPENROUTER_API_KEY,
            timeout=settings.OPENROUTER_TIMEOUT,
        )

        completion = await client.chat.completions.create(
            model=model,
            temperature=0.0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
        )

        raw_content = completion.choices[0].message.content
        if not raw_content:
            return LLMResult(provider=provider, provider_model=provider_model,
                             transactions=[], statement_period=None, card_info=None,
                             success=False, error="Empty response from OpenRouter")

        # Parse raw JSON into Pydantic model for validation
        result = LLMExtractionResult.model_validate_json(raw_content)

        if not result.transactions:
            return LLMResult(provider=provider, provider_model=provider_model,
                             transactions=[], statement_period=None, card_info=None,
                             success=False, error="LLM returned no transactions")

        formatted = _format_result(result)
        logger.info("[async_openrouter/%s] extracted %d transactions",
                    provider.value, len(formatted["transactions"]))
        return _llm_result_from_formatted(formatted, provider, provider_model)

    except Exception as e:
        logger.warning("[async_openrouter/%s] failed: %s", provider.value, e, exc_info=True)
        return LLMResult(provider=provider, provider_model=provider_model,
                         transactions=[], statement_period=None, card_info=None,
                         success=False, error=str(e))


# ---------------------------------------------------------------------------
# Parallel multi-provider orchestrator
# ---------------------------------------------------------------------------

async def async_llm_parse_all(text: str, bank_hint: str = "generic", region: str = "IN", **intel_kwargs) -> list[LLMResult]:
    """
    Run all configured LLM providers in parallel.

    Returns list of successful LLMResults (may be empty if all fail).
    """
    tasks: list[asyncio.Task] = []

    if settings.llm_enabled:
        tasks.append(asyncio.create_task(
            async_llm_parse_openai(text, bank_hint, region, **intel_kwargs),
            name="llm-openai",
        ))

    if settings.openrouter_enabled:
        tasks.append(asyncio.create_task(
            async_llm_parse_openrouter(text, bank_hint, region,
                                       model=settings.LLM2_MODEL,
                                       provider=LLMProvider.CLAUDE,
                                       **intel_kwargs),
            name="llm-claude",
        ))
        tasks.append(asyncio.create_task(
            async_llm_parse_openrouter(text, bank_hint, region,
                                       model=settings.LLM3_MODEL,
                                       provider=LLMProvider.GEMINI,
                                       **intel_kwargs),
            name="llm-gemini",
        ))

    if not tasks:
        logger.warning("[async_llm_parse_all] No LLM providers configured")
        return []

    logger.info("[async_llm_parse_all] Launching %d LLM tasks in parallel", len(tasks))
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    successful: list[LLMResult] = []
    for i, result in enumerate(raw_results):
        if isinstance(result, Exception):
            logger.warning("[async_llm_parse_all] Task %d raised exception: %s", i, result)
        elif isinstance(result, LLMResult) and result.success:
            successful.append(result)
        elif isinstance(result, LLMResult):
            logger.warning("[async_llm_parse_all] %s failed: %s",
                           result.provider_model, result.error)

    logger.info("[async_llm_parse_all] %d/%d providers succeeded", len(successful), len(tasks))
    return successful

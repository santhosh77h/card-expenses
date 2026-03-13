"""
Shared fixtures and mock data for backend tests.

All tests use synthetic data — no API keys required.
"""

import pytest

from app.llm_parser import LLMProvider, LLMResult


# ---------------------------------------------------------------------------
# Sample transactions (realistic synthetic data)
# ---------------------------------------------------------------------------

SAMPLE_TX_SWIGGY = {
    "date": "2025-12-11",
    "description": "SWIGGY ORDER",
    "amount": 450.0,
    "type": "debit",
    "category": "Food & Dining",
    "category_color": "#FF6B6B",
    "category_icon": "fork-knife",
    "transaction_type": "purchase",
}

SAMPLE_TX_AMAZON = {
    "date": "2025-12-13",
    "description": "AMAZON.IN",
    "amount": 2999.0,
    "type": "debit",
    "category": "Shopping",
    "category_color": "#60A5FA",
    "category_icon": "shopping-bag",
    "transaction_type": "purchase",
}

SAMPLE_TX_EMI = {
    "date": "2025-12-15",
    "description": "EMI 3/12 LAPTOP PURCHASE",
    "amount": 5833.0,
    "type": "debit",
    "category": "Shopping",
    "category_color": "#60A5FA",
    "category_icon": "shopping-bag",
    "transaction_type": "emi",
}

SAMPLE_TX_PAYMENT = {
    "date": "2025-12-05",
    "description": "AUTOPAY PAYMENT RECEIVED",
    "amount": 25000.0,
    "type": "credit",
    "category": "Transfers",
    "category_color": "#94A3B8",
    "category_icon": "repeat",
    "transaction_type": "payment",
}

SAMPLE_TX_REFUND = {
    "date": "2025-12-20",
    "description": "FLIPKART REFUND",
    "amount": 1299.0,
    "type": "credit",
    "category": "Shopping",
    "category_color": "#60A5FA",
    "category_icon": "shopping-bag",
    "transaction_type": "refund",
}


# ---------------------------------------------------------------------------
# LLMResult fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def openai_result():
    """Successful OpenAI LLMResult with 3 transactions."""
    return LLMResult(
        provider=LLMProvider.OPENAI,
        provider_model="openai/gpt-4o-mini",
        transactions=[SAMPLE_TX_SWIGGY, SAMPLE_TX_AMAZON, SAMPLE_TX_EMI],
        statement_period={"from": "2025-12-01", "to": "2025-12-31"},
        card_info={
            "card_last4": "1234",
            "card_network": "Visa",
            "credit_limit": 500000.0,
            "total_amount_due": 45000.0,
            "minimum_amount_due": 4500.0,
            "payment_due_date": "2026-01-15",
            "currency": "INR",
        },
        success=True,
    )


@pytest.fixture
def claude_result():
    """Successful Claude LLMResult with same 3 transactions (minor desc difference)."""
    return LLMResult(
        provider=LLMProvider.CLAUDE,
        provider_model="anthropic/claude-3.5-haiku",
        transactions=[
            {**SAMPLE_TX_SWIGGY, "description": "Swiggy"},
            {**SAMPLE_TX_AMAZON, "description": "Amazon India"},
            {**SAMPLE_TX_EMI, "description": "EMI 3/12 LAPTOP"},
        ],
        statement_period={"from": "2025-12-01", "to": "2025-12-31"},
        card_info={
            "card_last4": "1234",
            "card_network": "Visa",
            "credit_limit": 500000.0,
            "total_amount_due": 45000.0,
            "minimum_amount_due": 4500.0,
            "payment_due_date": "2026-01-15",
            "currency": "INR",
        },
        success=True,
    )


@pytest.fixture
def gemini_result():
    """Successful Gemini LLMResult — agrees on 2/3, misses EMI."""
    return LLMResult(
        provider=LLMProvider.GEMINI,
        provider_model="google/gemini-2.0-flash-001",
        transactions=[
            {**SAMPLE_TX_SWIGGY, "description": "SWIGGY"},
            {**SAMPLE_TX_AMAZON, "description": "AMAZON.IN MARKETPLACE"},
        ],
        statement_period={"from": "2025-12-01", "to": "2025-12-31"},
        card_info={
            "card_last4": "1234",
            "card_network": "Visa",
            "credit_limit": 500000.0,
            "total_amount_due": 45000.0,
            "minimum_amount_due": 4500.0,
            "payment_due_date": "2026-01-15",
            "currency": "INR",
        },
        success=True,
    )


@pytest.fixture
def failed_result():
    """Failed LLMResult."""
    return LLMResult(
        provider=LLMProvider.GEMINI,
        provider_model="google/gemini-2.0-flash-001",
        transactions=[],
        statement_period=None,
        card_info=None,
        success=False,
        error="API timeout",
    )

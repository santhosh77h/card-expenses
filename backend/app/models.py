"""
LangChain model wrappers for all LLM providers.

Centralizes model creation so every LLM call automatically gets LangSmith
tracing when LANGCHAIN_TRACING_V2=true. Replaces scattered OpenAI() /
AsyncOpenAI() client creation throughout the codebase.
"""

from langchain_openai import ChatOpenAI

from app.config import settings


def get_openai_model() -> ChatOpenAI:
    """Primary LLM (OpenAI gpt-4o-mini) with structured output support."""
    return ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=0,
        timeout=settings.OPENAI_TIMEOUT,
    )


def get_probe_model() -> ChatOpenAI:
    """Stage 1 intelligence probe (fast, cheap)."""
    return ChatOpenAI(
        model=settings.PROBE_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=0,
        timeout=settings.PROBE_TIMEOUT,
    )


def get_openrouter_model(model_name: str) -> ChatOpenAI:
    """OpenRouter model (Claude/Gemini via OpenAI-compatible API)."""
    return ChatOpenAI(
        model=model_name,
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0,
        timeout=settings.OPENROUTER_TIMEOUT,
    )

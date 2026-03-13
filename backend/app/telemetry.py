"""
LLM call telemetry — captures prompts, raw responses, and timing
for the dashboard observability layer.

Uses contextvars so pipeline nodes can append records without
threading explicit parameters through LangGraph state.
"""

import contextvars
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class LLMCallRecord:
    """One LLM invocation with its prompt, response, and timing."""

    stage: str  # "intelligence" or "parsing"
    provider: str  # "openai", "claude", "gemini"
    provider_model: str  # e.g. "openai/gpt-4o-mini"
    system_prompt: str
    user_message: str
    raw_response: Optional[str] = None
    parsed_response: Optional[dict] = None
    success: bool = True
    error: Optional[str] = None
    latency_ms: Optional[int] = None


_call_records: contextvars.ContextVar[list[LLMCallRecord]] = contextvars.ContextVar(
    "llm_call_records"
)


def init_call_records() -> None:
    """Initialize a fresh record list for this request."""
    _call_records.set([])


def record_llm_call(record: LLMCallRecord) -> None:
    """Append an LLM call record to the current request context."""
    try:
        records = _call_records.get()
        records.append(record)
    except LookupError:
        pass  # Not in a pipeline context — silently skip


def get_call_records() -> list[LLMCallRecord]:
    """Retrieve all LLM call records for the current request."""
    try:
        return _call_records.get()
    except LookupError:
        return []


class Timer:
    """Context manager for measuring elapsed time in milliseconds."""

    def __init__(self):
        self.start = 0.0
        self.elapsed_ms = 0

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *args):
        self.elapsed_ms = int((time.perf_counter() - self.start) * 1000)

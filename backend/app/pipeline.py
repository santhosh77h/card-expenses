"""
Shared pipeline context that flows through all parsing stages.

Each stage reads what it needs from the context and writes its output back.
New stages can be added by extending PipelineContext with new fields.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from pydantic import BaseModel


class DocumentIntelligence(BaseModel):
    """Stage 1 output: document-level locale and type detection."""

    language: str = "en"
    country: str = "IN"  # ISO 3166-1 alpha-2
    region: str = "IN"  # Prompt selection key: IN, US, UK, AU, CA, EU, APAC
    currency: str = "INR"  # ISO 4217
    date_format: str = "DMY"  # DMY, MDY, YMD
    statement_type: str = "credit_card"  # credit_card, bank_account, investment, utility_bill
    bank: str = "generic"
    confidence: float = 0.0  # Overall confidence 0.0-1.0
    method: str = "fallback"  # "llm" or "fallback"


@dataclass
class PipelineContext:
    """Shared context that flows through all pipeline stages."""

    # Input (set once at start)
    text: str = ""
    file_bytes: bytes = b""
    password: Optional[str] = None

    # Stage 1: Document Intelligence
    intelligence: Optional[DocumentIntelligence] = None

    # Stage 2: Transaction Parsing
    transactions: Optional[list[dict]] = None
    statement_period: Optional[dict] = None
    card_info: Optional[dict] = None
    validation: Optional[dict] = None

    # Future stages add fields here

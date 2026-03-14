"""
Statement parsing orchestrator.

Delegates to the LangGraph pipeline (graph.py) which coordinates all stages:
Document Intelligence (Stage 1), LLM parsing with multi-LLM consensus
(Stage 2), regex fallback, validation, and response building.

This module remains the public API — routes.py still imports parse_pdf from here.
"""

from typing import Optional

from app.graph import run_pipeline


async def parse_pdf(
    file_bytes: bytes,
    password: Optional[str] = None,
    filename: str = "",
) -> dict:
    """
    Parse a PDF credit card statement end-to-end.

    Returns dict with keys:
      transactions, summary, csv, bank_detected, card_info,
      currency_detected, region_detected, validation,
      country_detected, date_format_detected, statement_type_detected,
      language_detected
    """
    return await run_pipeline(file_bytes, password, filename=filename)

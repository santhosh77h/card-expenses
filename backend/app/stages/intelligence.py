"""
Stage 1: Document Intelligence — LLM probe + heuristic fallback.

Analyzes the document header to determine locale, currency, date format,
statement type, and issuing bank before transaction parsing begins.
"""

import logging

from pydantic import BaseModel, Field

from app.config import settings
from app.detector import BANK_KEYWORDS, detect_bank, detect_currency, detect_region
from app.pipeline import DocumentIntelligence, PipelineContext

logger = logging.getLogger(__name__)

PROBE_TEXT_LENGTH = 3000

COUNTRY_TO_REGION: dict[str, str] = {
    "IN": "IN",
    "US": "US",
    "GB": "UK",
    "AU": "AU",
    "CA": "CA",
    "SG": "APAC",
    "HK": "APAC",
    "DE": "EU",
    "FR": "EU",
    "IE": "UK",
}

COUNTRY_TO_DATE_FORMAT: dict[str, str] = {
    "IN": "DMY",
    "US": "MDY",
    "GB": "DMY",
    "AU": "DMY",
    "CA": "MDY",
    "SG": "DMY",
    "HK": "DMY",
    "DE": "DMY",
    "FR": "DMY",
}

REGION_TO_COUNTRY: dict[str, str] = {
    "IN": "IN",
    "US": "US",
    "UK": "GB",
    "AU": "AU",
    "CA": "CA",
    "EU": "DE",
    "APAC": "SG",
}

INTELLIGENCE_SYSTEM_PROMPT = """You are a document analyzer. Examine the header/summary section of this financial document and determine:

1. **language**: What language is this document written in? (ISO 639-1 code)
2. **country**: What country is this from? Use these signals:
   - Bank name and branding
   - Currency symbols: ₹=India, £=UK, €=Europe, A$=Australia, C$=Canada, S$=Singapore, HK$=Hong Kong
   - IMPORTANT: bare "$" is ambiguous — determine country from bank name, address, phone numbers, regulatory IDs (IFSC=India, IBAN=Europe/UK, Sort Code=UK, BSB=Australia, Routing Number=US)
   - Phone number prefixes: +91=India, +1=US/Canada, +44=UK, +61=Australia, +65=Singapore
   - Address patterns: PIN codes=India, ZIP codes=US, postcodes=UK/AU
3. **currency**: The primary currency. Must match the country (e.g., Australia uses AUD even if "$" symbol)
4. **date_format**: How dates are written:
   - DMY = day first (15/03/2024) — India, UK, Australia, Europe, Singapore
   - MDY = month first (03/15/2024) — US, Canada
   - YMD = year first (2024-03-15) — rare in statements
   Look for unambiguous dates (day > 12) to confirm.
5. **statement_type**: What kind of document:
   - credit_card: has credit limit, minimum due, payment due date
   - bank_account: has account balance, deposits, withdrawals
   - investment: has NAV, units, portfolio, holdings
   - utility_bill: has meter reading, consumption, tariff
6. **bank_name**: The issuing bank/institution name exactly as shown.

Respond with JSON only."""


class DocumentIntelligenceResponse(BaseModel):
    """LLM structured output for document intelligence."""

    language: str = Field(description="ISO 639-1 language code: en, hi, fr, de, etc.")
    country: str = Field(
        description="ISO 3166-1 alpha-2 country code: IN, US, GB, AU, CA, SG, HK, DE, FR"
    )
    currency: str = Field(
        description="ISO 4217 currency code: INR, USD, GBP, EUR, AUD, CAD, SGD, HKD"
    )
    date_format: str = Field(description="Date format convention: DMY, MDY, or YMD")
    statement_type: str = Field(
        description="Document type: credit_card, bank_account, investment, utility_bill"
    )
    bank_name: str = Field(
        description="Bank/institution name as written, or 'unknown'"
    )


async def run_intelligence_stage(ctx: PipelineContext) -> None:
    """Stage 1: Detect document locale via LLM probe, fallback to heuristics."""
    if settings.llm_enabled:
        try:
            intel = await _llm_probe(ctx.text)
            if intel:
                ctx.intelligence = intel
                return
        except Exception:
            logger.warning(
                "[stage1] LLM probe failed, falling back to heuristics",
                exc_info=True,
            )

    ctx.intelligence = _heuristic_fallback(ctx.text)


async def _llm_probe(text: str) -> DocumentIntelligence | None:
    """Run LLM probe on document header to detect locale."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.PROBE_TIMEOUT)
    sample = text[:PROBE_TEXT_LENGTH]

    logger.info(
        "[stage1] LLM probe: model=%s, sample_len=%d", settings.PROBE_MODEL, len(sample)
    )

    completion = await client.beta.chat.completions.parse(
        model=settings.PROBE_MODEL,
        temperature=0.0,
        messages=[
            {"role": "system", "content": INTELLIGENCE_SYSTEM_PROMPT},
            {"role": "user", "content": sample},
        ],
        response_format=DocumentIntelligenceResponse,
    )

    result = completion.choices[0].message.parsed
    if not result:
        return None

    region = COUNTRY_TO_REGION.get(result.country, "IN")
    bank_key = _resolve_bank_key(result.bank_name)

    return DocumentIntelligence(
        language=result.language,
        country=result.country,
        region=region,
        currency=result.currency,
        date_format=result.date_format,
        statement_type=result.statement_type,
        bank=bank_key,
        confidence=0.95,
        method="llm",
    )


def _heuristic_fallback(text: str) -> DocumentIntelligence:
    """Fallback when LLM is unavailable. Uses existing detector.py logic."""
    bank = detect_bank(text)
    currency = detect_currency(text, bank)
    region = detect_region(text, bank, currency)
    country = REGION_TO_COUNTRY.get(region, "IN")

    return DocumentIntelligence(
        language="en",
        country=country,
        region=region,
        currency=currency,
        date_format=COUNTRY_TO_DATE_FORMAT.get(country, "DMY"),
        statement_type="credit_card",
        bank=bank,
        confidence=0.4,
        method="fallback",
    )


def _resolve_bank_key(bank_name: str) -> str:
    """Map LLM-returned bank name to existing bank key."""
    name_lower = bank_name.lower()
    for key, keywords in BANK_KEYWORDS.items():
        for kw in keywords:
            if kw in name_lower or name_lower in kw:
                return key
    return "generic"

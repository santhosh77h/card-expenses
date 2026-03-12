"""
Composable LLM prompt system for region-specific statement parsing.

Composes a full system prompt from shared base rules + country-specific sections.
"""

from app.prompts.base import (
    PREAMBLE,
    BASE_RULES,
    CATEGORY_RULES,
    CARD_METADATA_RULES,
    FOOTER,
    STATEMENT_PERIOD_RULES,
    TRANSACTION_TYPE_RULES,
)
from app.prompts.india import INDIA_RULES
from app.prompts.us import US_RULES
from app.prompts.uk import UK_RULES

REGION_PROMPTS: dict[str, str] = {
    "IN": INDIA_RULES,
    "US": US_RULES,
    "UK": UK_RULES,
    "AU": UK_RULES,    # DMY, similar to UK
    "CA": US_RULES,    # MDY, similar to US
    "EU": UK_RULES,    # DMY
    "APAC": UK_RULES,  # DMY (SG, HK)
}


def get_system_prompt(region: str = "IN") -> str:
    """Compose full system prompt from base + country-specific rules."""
    region_rules = REGION_PROMPTS.get(region, INDIA_RULES)
    return (
        PREAMBLE
        + BASE_RULES
        + TRANSACTION_TYPE_RULES
        + region_rules
        + CATEGORY_RULES
        + STATEMENT_PERIOD_RULES
        + CARD_METADATA_RULES
        + FOOTER
    )

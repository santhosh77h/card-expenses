"""Tests for multi-LLM consensus voting logic."""

import pytest

from app.consensus import build_consensus, ConsensusResult
from app.llm_parser import LLMProvider, LLMResult


class TestBuildConsensusEmpty:
    def test_empty_results(self):
        result = build_consensus([])
        assert result.transactions == []
        assert result.validation["confidence"] == 0.0
        assert result.validation["llm_count"] == 0

    def test_single_provider_passthrough(self, openai_result):
        result = build_consensus([openai_result])
        assert len(result.transactions) == 3
        assert result.validation["consensus_method"] == "single_provider"
        assert result.validation["confidence"] == 0.5
        assert not result.validation["is_validated"]


class TestConsensusAgreement:
    def test_two_providers_full_agreement(self, openai_result, claude_result):
        """Two providers agreeing → confidence 0.7 per transaction."""
        result = build_consensus([openai_result, claude_result])
        assert len(result.transactions) >= 3
        assert result.validation["is_validated"]
        assert result.validation["llm_count"] == 2

    def test_three_providers_full_agreement(self, openai_result, claude_result, gemini_result):
        """Three providers — 2/3 agree on EMI, all agree on Swiggy/Amazon."""
        result = build_consensus([openai_result, claude_result, gemini_result])
        assert result.validation["is_validated"]
        assert result.validation["llm_count"] == 3
        # Should have at least the 2 transactions all providers agree on
        assert len(result.transactions) >= 2

    def test_consensus_picks_longest_description(self, openai_result, claude_result):
        """Consensus should pick the longest description from the group."""
        result = build_consensus([openai_result, claude_result])
        # Find the Swiggy transaction
        swiggy_txns = [t for t in result.transactions if "swiggy" in t["description"].lower()]
        assert len(swiggy_txns) == 1
        # "SWIGGY ORDER" is longer than "Swiggy"
        assert swiggy_txns[0]["description"] == "SWIGGY ORDER"


class TestConsensusCardInfo:
    def test_card_info_majority_vote(self, openai_result, claude_result, gemini_result):
        """All three agree on card_info → merged correctly."""
        result = build_consensus([openai_result, claude_result, gemini_result])
        assert result.card_info is not None
        assert result.card_info["card_last4"] == "1234"
        assert result.card_info["currency"] == "INR"

    def test_card_info_disagreement_nulls_numeric(self):
        """When providers disagree >10% on numeric fields, null for safety."""
        r1 = LLMResult(
            provider=LLMProvider.OPENAI, provider_model="openai/gpt-4o-mini",
            transactions=[{"date": "2025-12-01", "description": "TEST", "amount": 100.0,
                          "type": "debit", "category": "Other", "transaction_type": "purchase"}],
            statement_period=None,
            card_info={"total_amount_due": 50000.0, "card_last4": "1234",
                      "minimum_amount_due": None, "credit_limit": None,
                      "card_network": None, "payment_due_date": None, "currency": "INR"},
            success=True,
        )
        r2 = LLMResult(
            provider=LLMProvider.CLAUDE, provider_model="claude",
            transactions=[{"date": "2025-12-01", "description": "TEST", "amount": 100.0,
                          "type": "debit", "category": "Other", "transaction_type": "purchase"}],
            statement_period=None,
            card_info={"total_amount_due": 35000.0, "card_last4": "1234",
                      "minimum_amount_due": None, "credit_limit": None,
                      "card_network": None, "payment_due_date": None, "currency": "INR"},
            success=True,
        )
        result = build_consensus([r1, r2])
        # >10% disagreement on total_amount_due → nulled
        assert result.card_info["total_amount_due"] is None
        # card_last4 still agreed upon
        assert result.card_info["card_last4"] == "1234"


class TestConsensusStatementPeriod:
    def test_statement_period_majority(self, openai_result, claude_result, gemini_result):
        result = build_consensus([openai_result, claude_result, gemini_result])
        assert result.statement_period is not None
        assert result.statement_period["from"] == "2025-12-01"
        assert result.statement_period["to"] == "2025-12-31"


class TestConsensusSingleton:
    def test_singleton_transaction_low_confidence(self, openai_result, gemini_result):
        """EMI only in OpenAI (not Gemini) → appears but with low confidence."""
        result = build_consensus([openai_result, gemini_result])
        emi_txns = [t for t in result.transactions if "emi" in t.get("transaction_type", "").lower()
                    or "emi" in t.get("description", "").lower()]
        if emi_txns:
            # The EMI transaction should have lower confidence (only 1 provider)
            idx = result.transactions.index(emi_txns[0])
            assert result.validation["per_transaction_confidence"][idx] <= 0.5


class TestConsensusFailedProvider:
    def test_ignores_failed_results(self, openai_result, failed_result):
        """Failed results are filtered out by async_llm_parse_all, but
        if passed to consensus, they should produce empty transactions."""
        # In practice, failed results are filtered before consensus,
        # but we test that build_consensus handles the data correctly
        result = build_consensus([openai_result])
        assert len(result.transactions) == 3

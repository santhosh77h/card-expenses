"""Tests for LangGraph pipeline compilation and node functions."""

import pytest

from app.graph import build_pipeline_graph, _build_summary, _generate_csv


class TestGraphCompilation:
    def test_graph_compiles(self):
        """The pipeline graph should compile without errors."""
        graph = build_pipeline_graph()
        assert graph is not None

    def test_graph_has_correct_nodes(self):
        """The graph should have 5 nodes matching our pipeline stages."""
        graph = build_pipeline_graph()
        mermaid = graph.get_graph().draw_mermaid()
        assert "extract_text" in mermaid
        assert "intelligence" in mermaid
        assert "parse_transactions" in mermaid
        assert "validate" in mermaid
        assert "build_response" in mermaid


class TestBuildSummary:
    def test_basic_summary(self):
        transactions = [
            {"date": "2025-12-01", "amount": 100.0, "type": "debit", "category": "Food & Dining", "transaction_type": "purchase"},
            {"date": "2025-12-15", "amount": 200.0, "type": "debit", "category": "Shopping", "transaction_type": "purchase"},
            {"date": "2025-12-20", "amount": 50.0, "type": "credit", "category": "Shopping", "transaction_type": "refund"},
        ]
        summary = _build_summary(transactions)
        assert summary["total_transactions"] == 3
        assert summary["total_debits"] == 300.0
        assert summary["total_credits"] == 50.0
        assert summary["net"] == 250.0
        assert summary["statement_period"]["from"] == "2025-12-01"
        assert summary["statement_period"]["to"] == "2025-12-20"

    def test_categories_breakdown(self):
        transactions = [
            {"date": "2025-12-01", "amount": 100.0, "type": "debit", "category": "Food & Dining", "transaction_type": "purchase"},
            {"date": "2025-12-02", "amount": 200.0, "type": "debit", "category": "Food & Dining", "transaction_type": "purchase"},
            {"date": "2025-12-03", "amount": 500.0, "type": "debit", "category": "Shopping", "transaction_type": "purchase"},
        ]
        summary = _build_summary(transactions)
        assert summary["categories"]["Food & Dining"]["total"] == 300.0
        assert summary["categories"]["Food & Dining"]["count"] == 2
        assert summary["categories"]["Shopping"]["total"] == 500.0
        assert summary["categories"]["Shopping"]["count"] == 1

    def test_transaction_types_count(self):
        transactions = [
            {"date": "2025-12-01", "amount": 100.0, "type": "debit", "category": "Other", "transaction_type": "purchase"},
            {"date": "2025-12-02", "amount": 50.0, "type": "credit", "category": "Other", "transaction_type": "refund"},
            {"date": "2025-12-03", "amount": 200.0, "type": "debit", "category": "Other", "transaction_type": "purchase"},
        ]
        summary = _build_summary(transactions)
        assert summary["transaction_types"]["purchase"] == 2
        assert summary["transaction_types"]["refund"] == 1

    def test_empty_transactions(self):
        summary = _build_summary([])
        assert summary["total_transactions"] == 0
        assert summary["total_debits"] == 0.0
        assert summary["total_credits"] == 0.0
        assert summary["statement_period"]["from"] is None


class TestGenerateCSV:
    def test_csv_has_header_and_rows(self):
        transactions = [
            {"date": "2025-12-01", "description": "SWIGGY", "amount": 450.0,
             "type": "debit", "category": "Food & Dining", "transaction_type": "purchase"},
        ]
        csv_str = _generate_csv(transactions)
        lines = csv_str.strip().split("\n")
        assert len(lines) == 2  # header + 1 row
        assert "date,description,amount,category,type,transaction_type" in lines[0]
        assert "SWIGGY" in lines[1]

    def test_csv_handles_empty(self):
        csv_str = _generate_csv([])
        lines = csv_str.strip().split("\n")
        assert len(lines) == 1  # header only

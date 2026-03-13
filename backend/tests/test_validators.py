"""Tests for card_info validation rules."""

from app.validators import validate_card_info


class TestValidateCardInfo:
    """Test the 5 validation rules against known edge cases."""

    def _summary(self, debits=10000.0, credits=2000.0):
        return {
            "total_transactions": 10,
            "total_debits": debits,
            "total_credits": credits,
            "net": debits - credits,
        }

    def test_none_card_info_passes_through(self):
        assert validate_card_info(None, self._summary()) is None

    def test_valid_card_info_unchanged(self):
        card = {
            "total_amount_due": 45000.0,
            "minimum_amount_due": 4500.0,
            "card_last4": "1234",
        }
        result = validate_card_info(card, self._summary())
        assert result["total_amount_due"] == 45000.0
        assert result["minimum_amount_due"] == 4500.0

    def test_rule1_total_equals_credits_nulls_total(self):
        """Rule 1: total ≈ total_credits → null total (no corroborating minimum)."""
        card = {"total_amount_due": 2000.0, "minimum_amount_due": None}
        result = validate_card_info(card, self._summary(credits=2000.0))
        assert result["total_amount_due"] is None

    def test_rule1_skipped_with_corroborating_minimum(self):
        """Rule 1 skipped when minimum corroborates total."""
        card = {"total_amount_due": 2000.0, "minimum_amount_due": 200.0}
        result = validate_card_info(card, self._summary(credits=2000.0))
        assert result["total_amount_due"] == 2000.0  # Kept, not nulled

    def test_rule2_total_equals_debits_nulls_total(self):
        """Rule 2: total ≈ total_debits → null total."""
        card = {"total_amount_due": 10000.0, "minimum_amount_due": None}
        result = validate_card_info(card, self._summary(debits=10000.0))
        assert result["total_amount_due"] is None

    def test_rule2_skipped_with_corroborating_minimum(self):
        """Rule 2 skipped when minimum corroborates total."""
        card = {"total_amount_due": 10000.0, "minimum_amount_due": 1000.0}
        result = validate_card_info(card, self._summary(debits=10000.0))
        assert result["total_amount_due"] == 10000.0

    def test_rule3_total_equals_minimum_nulls_total(self):
        """Rule 3: total ≈ minimum → null total."""
        card = {"total_amount_due": 5000.0, "minimum_amount_due": 5000.0}
        result = validate_card_info(card, self._summary())
        assert result["total_amount_due"] is None
        assert result["minimum_amount_due"] == 5000.0

    def test_rule4_total_less_than_minimum_swaps(self):
        """Rule 4: total < minimum → swap."""
        card = {"total_amount_due": 500.0, "minimum_amount_due": 5000.0}
        result = validate_card_info(card, self._summary())
        assert result["total_amount_due"] == 5000.0
        assert result["minimum_amount_due"] == 500.0

    def test_rule5_minimum_equals_credits_nulls_minimum(self):
        """Rule 5a: minimum ≈ total_credits → null minimum."""
        card = {"total_amount_due": 45000.0, "minimum_amount_due": 2000.0}
        result = validate_card_info(card, self._summary(credits=2000.0))
        assert result["minimum_amount_due"] is None
        assert result["total_amount_due"] == 45000.0

    def test_rule5_minimum_equals_debits_nulls_minimum(self):
        """Rule 5b: minimum ≈ total_debits → null minimum."""
        card = {"total_amount_due": 45000.0, "minimum_amount_due": 10000.0}
        result = validate_card_info(card, self._summary(debits=10000.0))
        assert result["minimum_amount_due"] is None

    def test_does_not_mutate_original(self):
        """Validate returns a new dict, not the original."""
        card = {"total_amount_due": 500.0, "minimum_amount_due": 5000.0}
        result = validate_card_info(card, self._summary())
        assert card["total_amount_due"] == 500.0  # Original unchanged
        assert result["total_amount_due"] == 5000.0  # Result swapped

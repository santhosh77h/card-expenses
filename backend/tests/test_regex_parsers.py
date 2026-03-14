"""Tests for regex-based transaction parsing and transaction type inference."""

from app.regex_parsers import infer_transaction_type


class TestInferTransactionType:
    """Test keyword-based transaction type inference."""

    def test_emi_detection(self):
        assert infer_transaction_type("EMI 3/12 LAPTOP PURCHASE", "debit") == "emi"
        assert infer_transaction_type("EMI 1/6 PHONE", "debit") == "emi"

    def test_payment_detection(self):
        assert infer_transaction_type("AUTOPAY PAYMENT", "credit") == "payment"
        assert infer_transaction_type("ONLINE PAYMENT RECEIVED", "credit") == "payment"

    def test_refund_detection(self):
        assert infer_transaction_type("AMAZON REFUND", "credit") == "refund"
        assert infer_transaction_type("FLIPKART REFUND #123", "credit") == "refund"

    def test_reversal_detection(self):
        assert infer_transaction_type("TRANSACTION REVERSAL", "credit") == "reversal"

    def test_cashback_detection(self):
        assert infer_transaction_type("CASHBACK REWARD", "credit") == "cashback"

    def test_fee_detection(self):
        assert infer_transaction_type("LATE PAYMENT FEE", "debit") == "fee"
        assert infer_transaction_type("ANNUAL FEE", "debit") == "fee"

    def test_tax_detection(self):
        assert infer_transaction_type("GST ON FEE", "debit") == "tax"
        assert infer_transaction_type("SERVICE TAX", "debit") == "tax"

    def test_interest_detection(self):
        assert infer_transaction_type("INTEREST CHARGE", "debit") == "interest"
        assert infer_transaction_type("FINANCE CHARGE", "debit") == "interest"

    def test_transfer_detection(self):
        assert infer_transaction_type("FUND TRANSFER", "debit") == "transfer"
        assert infer_transaction_type("BALANCE TRANSFER", "debit") == "transfer"

    def test_default_is_purchase(self):
        assert infer_transaction_type("STARBUCKS COFFEE", "debit") == "purchase"
        assert infer_transaction_type("UBER TRIP", "debit") == "purchase"

    def test_case_insensitive(self):
        assert infer_transaction_type("emi 3/12 laptop", "debit") == "emi"
        assert infer_transaction_type("Cashback Reward", "credit") == "cashback"

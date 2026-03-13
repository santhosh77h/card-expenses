"""Tests for keyword-based categorization."""

from app.categories import categorize, get_all_categories, CATEGORY_META


class TestCategorize:
    def test_swiggy_is_food(self):
        result = categorize("SWIGGY ORDER #12345")
        assert result["name"] == "Food & Dining"

    def test_amazon_is_shopping(self):
        result = categorize("AMAZON.IN MARKETPLACE")
        assert result["name"] == "Shopping"

    def test_uber_is_transportation(self):
        result = categorize("UBER TRIP BLR-MG ROAD")
        assert result["name"] == "Transportation"

    def test_spotify_is_entertainment(self):
        result = categorize("SPOTIFY PREMIUM")
        assert result["name"] == "Entertainment"

    def test_bigbasket_is_groceries(self):
        result = categorize("BIGBASKET ORDER")
        assert result["name"] == "Groceries"

    def test_unknown_is_other(self):
        result = categorize("RANDOM UNKNOWN MERCHANT XYZ")
        assert result["name"] == "Other"

    def test_empty_is_other(self):
        result = categorize("")
        assert result["name"] == "Other"

    def test_none_input(self):
        result = categorize(None)
        assert result["name"] == "Other"

    def test_case_insensitive(self):
        result = categorize("swiggy order")
        assert result["name"] == "Food & Dining"

    def test_result_has_color_and_icon(self):
        result = categorize("NETFLIX")
        assert "color" in result
        assert "icon" in result
        assert result["color"].startswith("#")

    def test_us_merchants(self):
        assert categorize("DOORDASH")["name"] == "Food & Dining"
        assert categorize("TARGET STORE")["name"] == "Shopping"
        assert categorize("LYFT RIDE")["name"] == "Transportation"

    def test_uk_merchants(self):
        assert categorize("DELIVEROO")["name"] == "Food & Dining"
        assert categorize("PRIMARK")["name"] == "Shopping"
        assert categorize("TFL CONTACTLESS")["name"] == "Transportation"

    def test_finance_category(self):
        assert categorize("ZERODHA COIN SIP")["name"] == "Finance & Investment"
        assert categorize("GROWW MUTUAL FUND")["name"] == "Finance & Investment"

    def test_transfer_category(self):
        assert categorize("UPI TRANSFER")["name"] == "Transfers"
        assert categorize("GOOGLE PAY TRANSFER")["name"] == "Transfers"


class TestGetAllCategories:
    def test_returns_12_categories(self):
        cats = get_all_categories()
        assert len(cats) == 12  # 11 + Other

    def test_includes_other(self):
        cats = get_all_categories()
        names = [c["name"] for c in cats]
        assert "Other" in names

    def test_each_has_required_keys(self):
        for cat in get_all_categories():
            assert "name" in cat
            assert "color" in cat
            assert "icon" in cat


class TestCategoryMeta:
    def test_meta_has_all_categories(self):
        assert "Groceries" in CATEGORY_META
        assert "Food & Dining" in CATEGORY_META
        assert "Shopping" in CATEGORY_META
        assert "Other" in CATEGORY_META

    def test_meta_has_color_and_icon(self):
        for name, meta in CATEGORY_META.items():
            assert "color" in meta, f"Missing color for {name}"
            assert "icon" in meta, f"Missing icon for {name}"

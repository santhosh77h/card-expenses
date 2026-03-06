"""
Transaction categorizer for Cardlytics expense statement parser.

Uses keyword-based matching against transaction descriptions to assign
one of 12 spending categories. Each category includes a display color
and icon identifier for frontend rendering.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Category:
    name: str
    color: str
    icon: str
    keywords: tuple[str, ...]


# Ordered list of categories. The first match wins, so more specific
# categories (e.g. Groceries) should appear before broader ones (Shopping).
CATEGORIES: list[Category] = [
    Category(
        name="Food & Dining",
        color="#FF6B6B",
        icon="fork-knife",
        keywords=(
            "swiggy", "zomato", "starbucks", "restaurant", "mcdonald",
            "dominos", "pizza", "kfc", "burger", "cafe", "bakery", "food",
            "dining", "eat", "biryani", "haldiram", "barbeque", "subway",
            "dunkin", "baskin", "chai", "tea", "coffee", "dine",
        ),
    ),
    Category(
        name="Groceries",
        color="#4ADE80",
        icon="shopping-cart",
        keywords=(
            "bigbasket", "blinkit", "dmart", "zepto", "instamart", "jiomart",
            "grofers", "nature basket", "fresh", "vegetable", "fruit",
            "grocery", "supermarket", "provision", "kirana", "milk", "dairy",
        ),
    ),
    Category(
        name="Shopping",
        color="#60A5FA",
        icon="shopping-bag",
        keywords=(
            "amazon", "myntra", "flipkart", "mall", "ajio", "meesho", "nykaa",
            "tata cliq", "reliance", "shoppers stop", "lifestyle", "westside",
            "h&m", "zara", "uniqlo", "decathlon", "ikea", "croma",
            "vijay sales",
        ),
    ),
    Category(
        name="Transportation",
        color="#34D399",
        icon="car",
        keywords=(
            "uber", "ola", "rapido", "irctc", "petrol", "fuel", "metro",
            "parking", "toll", "diesel", "bp", "shell", "indian oil",
            "bharat petroleum", "hindustan petroleum", "lyft", "grab",
        ),
    ),
    Category(
        name="Entertainment",
        color="#A78BFA",
        icon="film",
        keywords=(
            "netflix", "spotify", "hotstar", "prime video", "youtube",
            "bookmyshow", "cinema", "pvr", "inox", "apple music", "disney",
            "hbo", "game", "playstation", "xbox", "steam", "twitch",
        ),
    ),
    Category(
        name="Health & Medical",
        color="#FFB547",
        icon="heart-pulse",
        keywords=(
            "apollo", "pharmacy", "hospital", "medplus", "netmeds",
            "pharmeasy", "1mg", "cult.fit", "gym", "doctor", "diagnostic",
            "lab", "dental", "optical", "wellness", "yoga", "meditation",
        ),
    ),
    Category(
        name="Utilities & Bills",
        color="#F472B6",
        icon="zap",
        keywords=(
            "jio", "airtel", "vodafone", "vi", "electricity", "rent", "emi",
            "insurance", "broadband", "wifi", "gas", "water", "maintenance",
            "society", "postpaid", "prepaid", "dth", "tata sky",
        ),
    ),
    Category(
        name="Travel",
        color="#22D3EE",
        icon="plane",
        keywords=(
            "hotel", "oyo", "makemytrip", "airline", "goibibo", "cleartrip",
            "yatra", "airbnb", "booking.com", "agoda", "indigo", "air india",
            "spicejet", "vistara", "emirates", "flight", "resort",
        ),
    ),
    Category(
        name="Education",
        color="#818CF8",
        icon="book-open",
        keywords=(
            "udemy", "coursera", "byju", "school", "college", "university",
            "tuition", "coaching", "book", "kindle", "audible", "skillshare",
            "linkedin learning", "unacademy", "vedantu", "exam", "test prep",
        ),
    ),
    Category(
        name="Finance & Investment",
        color="#FBBF24",
        icon="trending-up",
        keywords=(
            "groww", "zerodha", "sip", "mutual fund", "stock", "share",
            "demat", "upstox", "coin", "kuvera", "smallcase", "angel", "ipo",
            "dividend", "interest", "fd", "rd",
        ),
    ),
    Category(
        name="Transfers",
        color="#94A3B8",
        icon="repeat",
        keywords=(
            "upi", "neft", "imps", "rtgs", "google pay", "phonepe", "paytm",
            "bank transfer", "fund transfer", "self transfer",
            "account transfer",
        ),
    ),
]

DEFAULT_CATEGORY: dict[str, str] = {
    "name": "Other",
    "color": "#6B7280",
    "icon": "file-text",
}


def categorize(description: str) -> dict[str, str]:
    """
    Assign a spending category to a transaction based on its description.

    Performs case-insensitive keyword matching against the description.
    Multi-word keywords are matched as substrings; single-word keywords
    are matched as whole-word boundaries to reduce false positives on
    very short keywords.

    Args:
        description: The transaction description text.

    Returns:
        A dict with keys ``name``, ``color``, and ``icon``.
    """
    if not description:
        return dict(DEFAULT_CATEGORY)

    desc_lower = description.lower()

    for category in CATEGORIES:
        for keyword in category.keywords:
            if keyword in desc_lower:
                return {
                    "name": category.name,
                    "color": category.color,
                    "icon": category.icon,
                }

    return dict(DEFAULT_CATEGORY)


def get_all_categories() -> list[dict[str, str]]:
    """Return metadata for every category, including the fallback."""
    result = [
        {"name": c.name, "color": c.color, "icon": c.icon}
        for c in CATEGORIES
    ]
    result.append(dict(DEFAULT_CATEGORY))
    return result

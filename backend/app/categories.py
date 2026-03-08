"""
Single source of truth for spending categories.

Used by both the regex-based categorizer and the LLM parser.
Provides keyword-based matching, metadata lookup, and the canonical
list of allowed category names.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    name: str
    color: str
    icon: str
    keywords: tuple[str, ...]


# Ordered: first match wins. More specific categories before broader ones.
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

DEFAULT_CATEGORY = Category(
    name="Other", color="#6B7280", icon="file-text", keywords=()
)

# Pre-built lookup used by the LLM parser to attach color/icon metadata.
CATEGORY_META: dict[str, dict[str, str]] = {
    c.name: {"color": c.color, "icon": c.icon}
    for c in [*CATEGORIES, DEFAULT_CATEGORY]
}

ALLOWED_CATEGORIES = list(CATEGORY_META.keys())


def categorize(description: str) -> dict[str, str]:
    """
    Assign a spending category via case-insensitive keyword matching.

    Returns dict with keys: name, color, icon.
    """
    if not description:
        return _category_dict(DEFAULT_CATEGORY)

    desc_lower = description.lower()
    for category in CATEGORIES:
        for keyword in category.keywords:
            if keyword in desc_lower:
                return _category_dict(category)

    return _category_dict(DEFAULT_CATEGORY)


def get_all_categories() -> list[dict[str, str]]:
    """Return metadata for every category including the fallback."""
    result = [_category_dict(c) for c in CATEGORIES]
    result.append(_category_dict(DEFAULT_CATEGORY))
    return result


def _category_dict(cat: Category) -> dict[str, str]:
    return {"name": cat.name, "color": cat.color, "icon": cat.icon}

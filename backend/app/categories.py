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
        name="Groceries",
        color="#4ADE80",
        icon="shopping-cart",
        keywords=(
            # Generic
            "fresh", "vegetable", "fruit", "grocery", "supermarket", "milk",
            "dairy",
            # India
            "bigbasket", "blinkit", "dmart", "zepto", "instamart", "jiomart",
            "grofers", "nature basket", "provision", "kirana",
            # US
            "walmart grocery", "kroger", "whole foods", "trader joe",
            "safeway", "publix", "aldi", "instacart",
            # UK
            "tesco", "sainsbury", "asda", "waitrose", "ocado", "lidl",
            "morrisons", "co-op", "iceland",
        ),
    ),
    Category(
        name="Food & Dining",
        color="#FF6B6B",
        icon="fork-knife",
        keywords=(
            # Generic
            "starbucks", "restaurant", "mcdonald", "dominos", "pizza", "kfc",
            "burger", "cafe", "bakery", "food", "dining", "eat", "subway",
            "dunkin", "baskin", "chai", "tea", "coffee", "dine",
            # India
            "swiggy", "zomato", "biryani", "haldiram", "barbeque",
            # US
            "doordash", "grubhub", "chipotle", "chick-fil-a", "taco bell",
            "wendys", "panera", "shake shack", "panda express", "chilis",
            "applebees", "ihop", "uber eats",
            # UK
            "deliveroo", "just eat", "nandos", "greggs", "pret",
            "wagamama", "costa", "wetherspoon",
        ),
    ),
    Category(
        name="Shopping",
        color="#60A5FA",
        icon="shopping-bag",
        keywords=(
            # Generic
            "amazon", "mall", "h&m", "zara", "uniqlo", "decathlon", "ikea",
            # India
            "myntra", "flipkart", "ajio", "meesho", "nykaa", "tata cliq",
            "reliance", "shoppers stop", "lifestyle", "westside", "croma",
            "vijay sales",
            # US
            "target", "best buy", "home depot", "lowes", "macys",
            "nordstrom", "tj maxx", "marshalls", "etsy", "wayfair",
            # UK
            "primark", "john lewis", "argos", "next", "asos", "tk maxx",
            "selfridges", "currys",
        ),
    ),
    Category(
        name="Transportation",
        color="#34D399",
        icon="car",
        keywords=(
            # Generic
            "uber", "petrol", "fuel", "metro", "parking", "toll", "diesel",
            "bp", "shell",
            # India
            "ola", "rapido", "irctc", "indian oil", "bharat petroleum",
            "hindustan petroleum", "fasttag",
            # US
            "lyft", "exxon", "chevron", "sunoco", "ez pass", "fastrak",
            # UK
            "tfl", "oyster", "trainline", "national rail", "bolt",
            "addison lee", "esso", "dart charge",
        ),
    ),
    Category(
        name="Entertainment",
        color="#A78BFA",
        icon="film",
        keywords=(
            # Generic
            "netflix", "spotify", "youtube", "apple music", "disney", "hbo",
            "game", "playstation", "xbox", "steam", "twitch", "prime video",
            # India
            "hotstar", "bookmyshow", "cinema", "pvr", "inox",
            # US
            "hulu", "peacock", "paramount", "hbo max", "amc", "fandango",
            # UK
            "sky tv", "now tv", "britbox", "odeon", "cineworld", "vue",
        ),
    ),
    Category(
        name="Health & Medical",
        color="#FFB547",
        icon="heart-pulse",
        keywords=(
            # Generic
            "pharmacy", "hospital", "gym", "doctor", "diagnostic", "lab",
            "dental", "optical", "wellness", "yoga", "meditation",
            # India
            "apollo", "medplus", "netmeds", "pharmeasy", "1mg", "cult.fit",
            # US
            "cvs", "walgreens", "rite aid", "kaiser", "planet fitness",
            "peloton",
            # UK
            "boots", "superdrug", "lloyds pharmacy", "bupa", "puregym",
            "specsavers",
        ),
    ),
    Category(
        name="Utilities & Bills",
        color="#F472B6",
        icon="zap",
        keywords=(
            # Generic
            "electricity", "rent", "emi", "insurance", "broadband", "wifi",
            "gas", "water", "maintenance", "postpaid", "prepaid",
            # India
            "jio", "airtel", "vodafone", "vi", "society", "dth", "tata sky",
            # US
            "comcast", "xfinity", "verizon", "t-mobile", "spectrum", "at&t",
            "duke energy", "geico", "state farm",
            # UK
            "bt", "virgin media", "three", "ee", "british gas",
            "octopus energy", "thames water", "council tax", "tv licence",
        ),
    ),
    Category(
        name="Travel",
        color="#22D3EE",
        icon="plane",
        keywords=(
            # Generic
            "hotel", "airbnb", "booking.com", "agoda", "emirates", "flight",
            "resort", "airline",
            # India
            "oyo", "makemytrip", "goibibo", "cleartrip", "yatra", "indigo",
            "air india", "spicejet", "vistara",
            # US
            "delta", "united", "american airlines", "southwest", "jetblue",
            "marriott", "hilton", "expedia", "hertz",
            # UK
            "british airways", "easyjet", "ryanair", "jet2", "premier inn",
            "travelodge", "eurostar", "national express",
        ),
    ),
    Category(
        name="Education",
        color="#818CF8",
        icon="book-open",
        keywords=(
            # Generic
            "udemy", "coursera", "school", "college", "university", "tuition",
            "coaching", "book", "kindle", "audible", "skillshare",
            "linkedin learning", "exam", "test prep",
            # India
            "byju", "unacademy", "vedantu",
            # US
            "khan academy", "pluralsight", "masterclass", "brilliant", "chegg",
            # UK
            "open university", "futurelearn",
        ),
    ),
    Category(
        name="Finance & Investment",
        color="#FBBF24",
        icon="trending-up",
        keywords=(
            # Generic
            "mutual fund", "stock", "share", "dividend", "interest",
            # India
            "groww", "zerodha", "sip", "demat", "upstox", "coin", "kuvera",
            "smallcase", "angel", "ipo", "fd", "rd",
            # US
            "robinhood", "fidelity", "schwab", "vanguard", "coinbase",
            "sofi", "wealthfront",
            # UK
            "hargreaves lansdown", "trading 212", "freetrade", "nutmeg",
            "moneybox",
        ),
    ),
    Category(
        name="Transfers",
        color="#94A3B8",
        icon="repeat",
        keywords=(
            # Generic
            "bank transfer", "fund transfer", "self transfer",
            "account transfer", "wire transfer",
            # India
            "upi", "neft", "imps", "rtgs", "google pay", "phonepe", "paytm",
            # US
            "venmo", "zelle", "cash app", "apple cash",
            # UK
            "faster payment", "bacs", "chaps", "standing order", "wise",
            "revolut",
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

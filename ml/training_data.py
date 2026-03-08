"""
Training data for Vector expense app NLU models.
Intents + entity-annotated examples tailored to the app's 12 categories
and transaction schema (description, amount, category, date, type, cardId).
"""

# ---------------------------------------------------------------------------
# Intent definitions with example utterances
# ---------------------------------------------------------------------------

INTENT_EXAMPLES = {
    # --- count_transactions: "how many X?" ---
    "count_transactions": [
        "how many transactions do I have",
        "how many swiggy transactions",
        "how many times did I order from zomato",
        "count amazon orders",
        "number of uber rides",
        "how many payments to netflix",
        "total number of transactions",
        "how many food transactions",
        "how many shopping transactions this month",
        "how many debit transactions",
        "how many credit transactions",
        "count my grocery purchases",
        "how many times did I pay rent",
        "number of swiggy orders last month",
        "how many flipkart orders",
        "count my entertainment expenses",
        "how many fuel payments",
        "how many ola rides this week",
        "how many transactions in january",
        "count transactions above 500",
        "how many transactions below 100",
        "how many transactions on my hdfc card",
        "count transactions for this card",
        "how many times I ordered from starbucks",
        "number of dining transactions",
        "how many transfers did I make",
        "count my upi payments",
        "how many times did I pay electricity bill",
        "number of medical expenses",
        "how many travel bookings",
    ],

    # --- total_spent: "how much did I spend on X?" ---
    "total_spent": [
        "how much did I spend",
        "how much did I spend on swiggy",
        "total spent on food",
        "how much money spent on shopping",
        "what is my total spending",
        "how much spent on zomato this month",
        "total amount spent on groceries",
        "how much did I spend on uber",
        "total food expenses",
        "how much on entertainment",
        "total transportation cost",
        "how much did I spend last month",
        "what is my total expenditure",
        "how much money did I spend on travel",
        "total spent on amazon",
        "how much on bills and utilities",
        "total education expenses",
        "sum of all my transactions",
        "what did I spend on health",
        "how much spent on netflix subscription",
        "total shopping spend this month",
        "total debits this month",
        "how much went to investments",
        "how much did I spend on fuel",
        "total restaurant expenses",
        "how much spent on coffee",
        "total amount on flipkart",
        "how much did I pay for insurance",
        "sum of grocery purchases",
        "total spending on my sbi card",
    ],

    # --- transactions_on_date: "what did I spend on X date?" ---
    "transactions_on_date": [
        "what did I spend yesterday",
        "show transactions from today",
        "what did I buy today",
        "transactions on march 5",
        "what did I spend on monday",
        "show me yesterday's expenses",
        "what happened on february 14",
        "list transactions from last friday",
        "show my spending for today",
        "what purchases did I make on 1st march",
        "transactions from the 15th",
        "what did I buy on january 26",
        "spending on christmas day",
        "show me december 31 transactions",
        "what did I spend 3 days ago",
        "transactions from last saturday",
        "show purchases from feb 28",
        "what did I buy this morning",
        "expenses on diwali",
        "transactions for march 1st",
    ],

    # --- category_spend: "how much on category X?" ---
    "category_spend": [
        "how much did I spend on food and dining",
        "show my grocery spending",
        "what is my shopping expense",
        "transportation costs breakdown",
        "entertainment spending",
        "health and medical expenses",
        "utility bill total",
        "travel expenses this month",
        "education costs",
        "finance and investment outflow",
        "transfer amounts",
        "break down my food spending",
        "category wise spending",
        "which category did I spend most on",
        "top spending category",
        "show spending by category",
        "food vs shopping comparison",
        "monthly category breakdown",
        "what percentage is food",
        "dining expenses this month",
    ],

    # --- list_transactions: "show me / list transactions" ---
    "list_transactions": [
        "show my transactions",
        "list all transactions",
        "show recent transactions",
        "what are my latest expenses",
        "show me all swiggy orders",
        "list zomato transactions",
        "show shopping transactions",
        "list food expenses",
        "show all debits",
        "list credits",
        "show transactions above 1000",
        "list transactions below 200",
        "show last 10 transactions",
        "recent purchases",
        "show my expenses",
        "list all payments",
        "display my transactions",
        "show everything I bought",
        "list all orders from amazon",
        "show uber transactions",
    ],

    # --- highest_transaction: "what was my biggest expense?" ---
    "highest_transaction": [
        "what was my biggest expense",
        "largest transaction",
        "most expensive purchase",
        "highest amount spent",
        "what is the biggest payment",
        "show my largest spending",
        "max transaction amount",
        "biggest food expense",
        "highest shopping purchase",
        "most expensive order",
        "largest debit",
        "what was my highest spend this month",
        "biggest transaction last month",
        "maximum amount I paid",
        "top transaction",
    ],

    # --- lowest_transaction: "what was my smallest expense?" ---
    "lowest_transaction": [
        "what was my smallest expense",
        "lowest transaction",
        "cheapest purchase",
        "minimum amount spent",
        "smallest payment",
        "least expensive transaction",
        "minimum spending",
        "smallest debit",
        "what is the lowest amount I spent",
        "cheapest order",
    ],

    # --- average_spend: "what is my average spending?" ---
    "average_spend": [
        "what is my average spending",
        "average transaction amount",
        "mean spending per transaction",
        "average food expense",
        "what do I usually spend",
        "average daily spending",
        "average monthly expenditure",
        "mean amount per order",
        "average grocery bill",
        "what is my typical spend",
        "average shopping expense",
        "per transaction average",
        "average uber ride cost",
        "mean expense amount",
        "average spending on swiggy",
    ],

    # --- monthly_summary: "how was my spending this month?" ---
    "monthly_summary": [
        "how was my spending this month",
        "monthly summary",
        "this month overview",
        "show me this month's report",
        "monthly spending report",
        "how did I spend in february",
        "january spending summary",
        "give me a monthly breakdown",
        "this month's expenses summary",
        "spending overview for march",
        "last month summary",
        "month to date spending",
        "compare this month vs last month",
        "how is my spending trend",
        "monthly expense report",
    ],
}

# ---------------------------------------------------------------------------
# Entity-annotated training data for NER
# Format: (text, [(start, end, entity_type), ...])
# ---------------------------------------------------------------------------

ENTITY_EXAMPLES = [
    # merchant entities
    ("how many swiggy transactions", [(9, 15, "MERCHANT")]),
    ("total spent on zomato", [(15, 21, "MERCHANT")]),
    ("count amazon orders", [(6, 12, "MERCHANT")]),
    ("show uber transactions", [(5, 9, "MERCHANT")]),
    ("how much on netflix", [(12, 19, "MERCHANT")]),
    ("list flipkart purchases", [(5, 13, "MERCHANT")]),
    ("how many ola rides", [(9, 12, "MERCHANT")]),
    ("starbucks expenses", [(0, 9, "MERCHANT")]),
    ("total myntra spending", [(6, 12, "MERCHANT")]),
    ("bigbasket orders this month", [(0, 9, "MERCHANT")]),
    ("how much did I spend on spotify", [(24, 31, "MERCHANT")]),
    ("payments to airtel", [(12, 18, "MERCHANT")]),
    ("blinkit delivery charges", [(0, 7, "MERCHANT")]),
    ("makemytrip bookings", [(0, 10, "MERCHANT")]),
    ("zerodha transactions", [(0, 7, "MERCHANT")]),
    ("rapido ride expenses", [(0, 6, "MERCHANT")]),
    ("irctc ticket bookings", [(0, 5, "MERCHANT")]),
    ("hotstar subscription", [(0, 7, "MERCHANT")]),
    ("pharmeasy orders", [(0, 9, "MERCHANT")]),
    ("jio recharge payments", [(0, 3, "MERCHANT")]),

    # category entities
    ("how much on food and dining", [(12, 27, "CATEGORY")]),
    ("total grocery spending", [(6, 13, "CATEGORY")]),
    ("shopping expenses", [(0, 8, "CATEGORY")]),
    ("transportation costs", [(0, 14, "CATEGORY")]),
    ("entertainment spending", [(0, 13, "CATEGORY")]),
    ("health and medical bills", [(0, 18, "CATEGORY")]),
    ("utility expenses", [(0, 7, "CATEGORY")]),
    ("travel costs this month", [(0, 6, "CATEGORY")]),
    ("education fees", [(0, 9, "CATEGORY")]),
    ("investment outflow", [(0, 10, "CATEGORY")]),
    ("how much on groceries", [(12, 21, "CATEGORY")]),
    ("total food expenses", [(6, 10, "CATEGORY")]),
    ("show dining transactions", [(5, 11, "CATEGORY")]),
    ("medical bill total", [(0, 7, "CATEGORY")]),
    ("fuel expenses", [(0, 4, "CATEGORY")]),

    # date entities
    ("transactions from yesterday", [(18, 27, "DATE")]),
    ("what did I spend today", [(16, 21, "DATE")]),
    ("show expenses last month", [(14, 24, "DATE")]),
    ("spending this month", [(9, 19, "DATE")]),
    ("transactions in january", [(16, 23, "DATE")]),
    ("february expenses", [(0, 8, "DATE")]),
    ("last week spending", [(0, 9, "DATE")]),
    ("expenses this week", [(9, 18, "DATE")]),
    ("transactions from march 5", [(18, 25, "DATE")]),
    ("spending on monday", [(12, 18, "DATE")]),
    ("purchases 3 days ago", [(10, 20, "DATE")]),
    ("transactions last friday", [(13, 24, "DATE")]),
    ("this year expenses", [(0, 9, "DATE")]),
    ("last year spending", [(0, 9, "DATE")]),
    ("december 31 transactions", [(0, 11, "DATE")]),

    # amount entities
    ("transactions above 500", [(14, 22, "AMOUNT")]),
    ("spending below 100", [(9, 18, "AMOUNT")]),
    ("purchases over 1000", [(10, 19, "AMOUNT")]),
    ("expenses more than 2000", [(9, 23, "AMOUNT")]),
    ("transactions under 50", [(13, 21, "AMOUNT")]),
    ("orders above 300 rupees", [(7, 23, "AMOUNT")]),
    ("less than 200 spent", [(0, 13, "AMOUNT")]),
    ("greater than 5000", [(0, 17, "AMOUNT")]),

    # combined entities
    ("how many swiggy transactions last month", [(9, 15, "MERCHANT"), (29, 39, "DATE")]),
    ("total spent on zomato this month", [(15, 21, "MERCHANT"), (22, 32, "DATE")]),
    ("amazon orders above 500", [(0, 6, "MERCHANT"), (14, 23, "AMOUNT")]),
    ("food expenses last month", [(0, 4, "CATEGORY"), (14, 24, "DATE")]),
    ("show uber rides yesterday", [(5, 9, "MERCHANT"), (16, 25, "DATE")]),
    ("grocery spending this week", [(0, 7, "CATEGORY"), (17, 26, "DATE")]),
    ("shopping transactions above 1000 last month", [(0, 8, "CATEGORY"), (22, 32, "AMOUNT"), (33, 43, "DATE")]),
    ("netflix payments this year", [(0, 7, "MERCHANT"), (17, 26, "DATE")]),
    ("swiggy orders above 200 this month", [(0, 6, "MERCHANT"), (14, 23, "AMOUNT"), (24, 34, "DATE")]),
    ("food and dining expenses in february", [(0, 15, "CATEGORY"), (28, 36, "DATE")]),
]

# ---------------------------------------------------------------------------
# Known merchants (from categories.py keywords) for entity dictionary
# ---------------------------------------------------------------------------

KNOWN_MERCHANTS = [
    # Food & Dining
    "swiggy", "zomato", "starbucks", "mcdonald", "dominos", "pizza hut",
    "kfc", "burger king", "subway", "dunkin", "baskin robbins", "haldiram",
    # Groceries
    "bigbasket", "blinkit", "dmart", "zepto", "instamart", "jiomart",
    "grofers", "nature basket",
    # Shopping
    "amazon", "myntra", "flipkart", "ajio", "meesho", "nykaa",
    "tata cliq", "shoppers stop", "h&m", "zara", "uniqlo",
    "decathlon", "ikea", "croma", "vijay sales",
    # Transportation
    "uber", "ola", "rapido", "irctc", "metro",
    # Entertainment
    "netflix", "spotify", "hotstar", "youtube", "bookmyshow",
    "pvr", "inox", "apple music", "disney",
    # Health & Medical
    "apollo", "medplus", "netmeds", "pharmeasy", "1mg", "cult.fit",
    # Utilities
    "jio", "airtel", "vodafone",
    # Travel
    "oyo", "makemytrip", "goibibo", "cleartrip", "yatra",
    "airbnb", "booking.com", "indigo", "air india", "spicejet", "vistara",
    # Education
    "udemy", "coursera", "byju", "kindle", "audible", "skillshare",
    # Finance
    "groww", "zerodha", "upstox", "paytm", "google pay", "phonepe",
]

# ---------------------------------------------------------------------------
# Known categories (matching the 12 in the app)
# ---------------------------------------------------------------------------

KNOWN_CATEGORIES = [
    "food and dining", "food", "dining", "restaurant",
    "groceries", "grocery",
    "shopping",
    "transportation", "transport", "fuel",
    "entertainment",
    "health and medical", "health", "medical",
    "utilities and bills", "utilities", "bills",
    "travel",
    "education",
    "finance and investment", "finance", "investment",
    "transfers", "transfer",
    "other",
]

# Map short forms to canonical category names
CATEGORY_CANONICAL = {
    "food": "Food & Dining",
    "dining": "Food & Dining",
    "restaurant": "Food & Dining",
    "food and dining": "Food & Dining",
    "grocery": "Groceries",
    "groceries": "Groceries",
    "shopping": "Shopping",
    "transportation": "Transportation",
    "transport": "Transportation",
    "fuel": "Transportation",
    "entertainment": "Entertainment",
    "health": "Health & Medical",
    "medical": "Health & Medical",
    "health and medical": "Health & Medical",
    "utilities": "Utilities & Bills",
    "bills": "Utilities & Bills",
    "utilities and bills": "Utilities & Bills",
    "travel": "Travel",
    "education": "Education",
    "finance": "Finance & Investment",
    "investment": "Finance & Investment",
    "finance and investment": "Finance & Investment",
    "transfers": "Transfers",
    "transfer": "Transfers",
    "other": "Other",
}

"""
Blog MongoDB storage — persists blog posts for the Vector landing page.

Uses pymongo with the shared MongoClient from ``app.mongo``.
All function signatures are identical to the previous SQLite implementation
so callers (blog_routes.py) require zero changes.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.mongo import doc_to_dict, get_db, nanoid

logger = logging.getLogger(__name__)

_COLLECTION = "blog_posts"


def _col():
    """Shorthand for the blog_posts collection."""
    return get_db()[_COLLECTION]


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def init_blog_db() -> None:
    """Create indexes and seed initial data if the collection is empty."""
    col = _col()
    col.create_index("slug", unique=True)
    col.create_index("status")
    col.create_index("published_at")

    if col.count_documents({}) == 0:
        _seed_posts()

    logger.info("[blog_db] Initialized (MongoDB collection: %s)", _COLLECTION)


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_posts(
    limit: int = 10,
    offset: int = 0,
    category: str = "",
    status: str = "published",
) -> dict:
    """List posts with optional category filter."""
    col = _col()
    query: dict = {}

    if status:
        query["status"] = status
    if category:
        query["category"] = category

    total = col.count_documents(query)

    cursor = (
        col.find(query)
        .sort([("published_at", -1), ("created_at", -1)])
        .skip(offset)
        .limit(limit)
    )

    posts = []
    for doc in cursor:
        post = doc_to_dict(doc)
        # Ensure tags/faq are lists (handles legacy JSON-string values)
        for field in ("tags", "faq"):
            val = post.get(field)
            if isinstance(val, str):
                try:
                    post[field] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    pass
        posts.append(post)

    return {
        "posts": posts,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def get_post_by_slug(slug: str) -> Optional[dict]:
    """Get a single post by slug."""
    doc = _col().find_one({"slug": slug})
    if not doc:
        return None

    post = doc_to_dict(doc)
    for field in ("tags", "faq"):
        val = post.get(field)
        if isinstance(val, str):
            try:
                post[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                pass
    return post


def get_categories() -> list[dict]:
    """Get distinct categories with counts (published posts only)."""
    pipeline = [
        {"$match": {"status": "published"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    return [
        {"category": r["_id"], "count": r["count"]}
        for r in _col().aggregate(pipeline)
    ]


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def create_post(data: dict) -> dict:
    """Insert a new blog post."""
    now = datetime.now(timezone.utc).isoformat()
    post_id = nanoid()

    doc = {
        "_id": post_id,
        "slug": data.get("slug", ""),
        "title": data.get("title", ""),
        "excerpt": data.get("excerpt", ""),
        "content": data.get("content", ""),
        "cover_image": data.get("cover_image", ""),
        "category": data.get("category", "General"),
        "tags": data.get("tags", []),
        "author": data.get("author", "Vector Team"),
        "status": data.get("status", "draft"),
        "read_time": data.get("read_time", 5),
        "published_at": now if data.get("status") == "published" else data.get("published_at"),
        "created_at": now,
        "updated_at": now,
        "faq": data.get("faq", []),
    }

    _col().insert_one(doc)
    logger.info("[blog_db] Created post %s (%s)", post_id, data.get("slug"))
    return get_post_by_slug(data.get("slug", "")) or {"id": post_id}


def update_post(post_id: str, data: dict) -> Optional[dict]:
    """Update an existing blog post."""
    now = datetime.now(timezone.utc).isoformat()
    col = _col()

    existing = col.find_one({"_id": post_id})
    if not existing:
        return None

    slug = data.get("slug", existing["slug"])
    title = data.get("title", existing["title"])
    excerpt = data.get("excerpt", existing["excerpt"])
    content = data.get("content", existing["content"])
    cover_image = data.get("cover_image", existing["cover_image"])
    category = data.get("category", existing["category"])
    tags = data.get("tags", existing.get("tags", []))
    faq = data.get("faq", existing.get("faq", []))
    author = data.get("author", existing["author"])
    status = data.get("status", existing["status"])
    read_time = data.get("read_time", existing["read_time"])
    published_at = existing.get("published_at")

    # Set published_at when transitioning to published
    if status == "published" and existing.get("status") != "published":
        published_at = now
    if "published_at" in data:
        published_at = data["published_at"]

    col.update_one(
        {"_id": post_id},
        {"$set": {
            "slug": slug,
            "title": title,
            "excerpt": excerpt,
            "content": content,
            "cover_image": cover_image,
            "category": category,
            "tags": tags,
            "faq": faq,
            "author": author,
            "status": status,
            "read_time": read_time,
            "published_at": published_at,
            "updated_at": now,
        }},
    )
    logger.info("[blog_db] Updated post %s", post_id)
    return get_post_by_slug(slug)


def delete_post(post_id: str) -> bool:
    """Delete a blog post."""
    result = _col().delete_one({"_id": post_id})
    return result.deleted_count > 0


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def _seed_posts() -> None:
    """Seed 3 initial blog posts."""
    now = datetime.now(timezone.utc).isoformat()

    posts = [
        {
            "_id": nanoid(),
            "slug": "why-we-built-vector-privacy-first-finance",
            "title": "Why We Built Vector: Privacy-First Finance",
            "excerpt": "In a world where every fintech app wants your data, we chose a different path. Here's why Vector processes everything locally.",
            "category": "Privacy",
            "tags": ["privacy", "security", "philosophy"],
            "faq": [],
            "read_time": 6,
            "content": """# Why We Built Vector: Privacy-First Finance

Every fintech app on the market today follows the same playbook: sign up with your email, link your bank accounts, grant access to your transaction history, and trust that your most sensitive financial data is stored securely on someone else's servers. We looked at this model and asked a simple question: *why?*

## The Problem with Cloud-First Finance

Your credit card statement is one of the most revealing documents about your life. It shows where you shop, what you eat, where you travel, your subscriptions, your habits, and your vices. When you upload this data to a typical fintech platform, you are trusting that company to store it safely, never sell it, never get breached, and never change their privacy policy.

The reality is sobering. Financial data breaches have exposed hundreds of millions of records in recent years. Companies that promise to protect your data get acquired, pivot their business models, or simply fail to maintain adequate security. Your data becomes a liability sitting on someone else's server.

## Vector's Approach: Zero Data Retention

Vector takes a fundamentally different approach. When you upload a credit card statement, here is exactly what happens:

1. **Your PDF is sent to our parsing API** over an encrypted connection.
2. **Our AI extracts the transactions** — dates, descriptions, amounts, and categories.
3. **The structured data is returned to your device** immediately.
4. **Your PDF is discarded from server memory.** It is never written to disk. It is never stored in a database. It is never logged.

There is no account to create. There is no email to provide. There is no login. The server has no concept of "users" — it simply receives a PDF, parses it, and forgets it ever existed.

## Encrypted Local Storage

All of your parsed transactions, spending analysis, and statement history live on your device in an encrypted SQLite database. You own it completely. If you delete the app, the data is gone — because it only ever existed on your phone.

This is not a compromise. This is a feature. You get full spending analysis, category breakdowns, trend tracking, and CSV exports — all without ever surrendering your data to a third party.

## Why This Matters

Privacy in finance is not about having something to hide. It is about maintaining autonomy over your most personal information. Your spending patterns reveal your health conditions, your political donations, your relationship status, and countless other details that are nobody's business but yours.

We built Vector because we believe powerful financial tools and genuine privacy are not mutually exclusive. You should not have to choose between insight and security. With Vector, you get both.

**Your money. Directed. Your data. Protected.**""",
        },
        {
            "_id": nanoid(),
            "slug": "how-our-3-model-ai-consensus-engine-works",
            "title": "How Our 3-Model AI Consensus Engine Works",
            "excerpt": "Most AI apps use a single model. Vector uses three — and makes them vote. Here's the engineering behind our consensus system.",
            "category": "Engineering",
            "tags": ["ai", "engineering", "consensus", "llm"],
            "faq": [],
            "read_time": 8,
            "content": """# How Our 3-Model AI Consensus Engine Works

When we set out to build a credit card statement parser, we faced a fundamental challenge: LLMs are powerful but imperfect. A single model might misread a date format, confuse a credit for a debit, or hallucinate a transaction that does not exist. For financial data, "mostly accurate" is not good enough. So we built something better.

## The Single-Model Problem

Most AI-powered apps send your data to one model and trust the output. This works fine for casual use cases, but financial parsing demands precision. A single misread transaction amount can throw off your entire monthly analysis. We tested GPT-4o-mini, Claude 3.5 Haiku, and Gemini 2.0 Flash individually and found that each model had different strengths and blind spots:

- **GPT-4o-mini** excels at structured output and date parsing but occasionally struggles with non-standard statement layouts.
- **Claude 3.5 Haiku** is strong at understanding context and categorization but can sometimes merge adjacent transactions.
- **Gemini 2.0 Flash** handles multi-currency and international formats well but may misinterpret ambiguous line items.

No single model was reliable enough on its own. But together, they are remarkably accurate.

## The Consensus Architecture

Vector's parsing pipeline works in three stages:

### Stage 1: Document Intelligence

Before any parsing begins, we send a small probe request to understand the document. This detects the bank, country, currency, date format, and statement type. This metadata configures the main parsing stage so each model knows exactly what to expect.

### Stage 2: Parallel Parsing

We send the statement text to all three models simultaneously. Each model independently extracts every transaction with its date, description, amount, and type (debit or credit). Each model also identifies card metadata, statement periods, and summary totals. The three responses come back in parallel, typically within 3-5 seconds.

### Stage 3: Majority Voting

This is where the magic happens. Our consensus engine compares the three sets of extracted transactions and applies a voting algorithm:

- **Transaction matching**: We match transactions across models using fuzzy matching on dates, amounts, and descriptions. A transaction that appears in at least 2 of 3 models is accepted.
- **Amount reconciliation**: When models disagree on an amount, we take the majority value. If all three disagree, we flag the transaction for review.
- **Confidence scoring**: Each transaction gets a confidence score based on how many models agreed. Three-way agreement scores highest. Two-way agreement is still accepted. Single-model-only transactions are included but flagged.
- **Summary validation**: We cross-check extracted totals against the sum of individual transactions and against any summary section found in the statement.

### The Fallback Chain

If OpenRouter (which provides Claude and Gemini access) is unavailable, we gracefully degrade to single-model parsing with GPT-4o-mini. If all LLM providers fail, we fall back to our bank-specific regex parsers — hand-tuned pattern matchers for the seven most common bank statement formats. You always get results, even if the AI is having a bad day.

## Results

In our testing across hundreds of real statements from banks worldwide, the consensus approach achieves over 97% transaction-level accuracy, compared to roughly 89-93% for any single model alone. The flagging system catches most remaining edge cases, giving users clear visibility into which transactions might need manual review.

The tradeoff is cost and latency — three models cost three times as much, and we wait for the slowest model. But for financial data, accuracy is worth it. Your money deserves more than a best guess.

**Three models. One truth. Zero guesswork.**""",
        },
        {
            "_id": nanoid(),
            "slug": "getting-started-with-vector-a-quick-guide",
            "title": "Getting Started with Vector: A Quick Guide",
            "excerpt": "From download to your first spending insight in under 2 minutes. Here's how to get started with Vector.",
            "category": "Guide",
            "tags": ["guide", "getting-started", "tutorial"],
            "faq": [],
            "read_time": 4,
            "content": """# Getting Started with Vector: A Quick Guide

Vector is designed to get you from zero to actionable spending insights in under two minutes. No account creation, no bank linking, no setup wizard. Here is how to get started.

## Step 1: Download and Open

Download Vector from the App Store or Google Play. Open the app and you will land directly on the home screen. There is no sign-up flow because Vector does not need an account — everything stays on your device.

## Step 2: Try Demo Mode

Not ready to upload your own statement? Tap **"Try Demo"** on the home screen. Vector will parse a sample credit card statement and show you exactly what the full experience looks like — complete with transaction categorization, spending breakdowns, and trend analysis. This is a great way to explore the interface without committing any personal data.

## Step 3: Upload Your First Statement

When you are ready, tap the **upload button** and select a credit card statement PDF from your device. Vector supports statements from major banks worldwide including Chase, Amex, HDFC, ICICI, SBI, Citi, and many more.

If your statement is password-protected, Vector will prompt you to enter the password. The password is used only for that single parse and is never stored.

Once uploaded, Vector's AI engine goes to work. You will see a progress indicator as the statement is parsed — typically this takes 3-5 seconds. Behind the scenes, three AI models are analyzing your statement in parallel and voting on each transaction to ensure accuracy.

## Step 4: Explore Your Analysis

After parsing, you will see your transactions organized and categorized automatically into 12 spending categories: Food & Dining, Shopping, Travel, Entertainment, Utilities, Healthcare, Fuel, Education, Groceries, Personal Care, Subscriptions, and Other.

The **Analysis screen** gives you a visual breakdown of your spending with interactive charts. See where your money goes at a glance, identify your biggest expense categories, and spot trends over time as you upload more statements.

## Step 5: Export Your Data

Need your data in a spreadsheet? Tap the **export button** to generate a CSV file with all your parsed transactions. The CSV includes dates, descriptions, amounts, categories, and transaction types — ready for import into Excel, Google Sheets, or any budgeting tool.

## Managing Multiple Cards

Vector supports multiple credit cards. Tap the card selector at the top of the screen to add a new card or switch between existing ones. Each card maintains its own transaction history and analysis, so you can track spending across all your accounts independently.

## Tips for Best Results

- **Use official PDF statements** downloaded from your bank's website or app. Photos or scans of paper statements will not work.
- **Check flagged transactions.** Vector's AI is highly accurate, but occasionally a transaction may be flagged for review. Tap any flagged item to verify or correct it.
- **Upload monthly** to build a spending history. The more statements you upload, the richer your trend analysis becomes.

That is it. No tutorials, no onboarding sequences, no premium upsells. Just upload, analyze, and understand your spending. **Your money. Directed.**""",
        },
    ]

    for post in posts:
        post.update({
            "cover_image": "",
            "author": "Vector Team",
            "status": "published",
            "published_at": now,
            "created_at": now,
            "updated_at": now,
        })

    _col().insert_many(posts)
    logger.info("[blog_db] Seeded %d initial blog posts", len(posts))

"""
Blog SQLite storage — persists blog posts for the Vector landing page.

Uses Python's built-in sqlite3. Follows the same patterns as dashboard_db.py.
"""

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from app.config import settings

logger = logging.getLogger(__name__)

_DB_PATH: Path | None = None


def _get_db_path() -> Path:
    global _DB_PATH
    if _DB_PATH is None:
        _DB_PATH = Path(settings.DASHBOARD_DB_PATH).parent / "blog.db"
    return _DB_PATH


def _connect() -> sqlite3.Connection:
    db_path = _get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_blog_db() -> None:
    """Create tables if they don't exist. Called at app startup."""
    conn = _connect()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS blog_posts (
                id           TEXT PRIMARY KEY,
                slug         TEXT UNIQUE NOT NULL,
                title        TEXT NOT NULL,
                excerpt      TEXT NOT NULL DEFAULT '',
                content      TEXT NOT NULL DEFAULT '',
                cover_image  TEXT DEFAULT '',
                category     TEXT DEFAULT 'General',
                tags         TEXT DEFAULT '[]',
                author       TEXT DEFAULT 'Vector Team',
                status       TEXT DEFAULT 'draft',
                read_time    INTEGER DEFAULT 5,
                published_at TEXT,
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
            CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
            CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);
        """)
        conn.commit()

        # Add faq column if missing (idempotent migration)
        try:
            conn.execute("ALTER TABLE blog_posts ADD COLUMN faq TEXT DEFAULT '[]'")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Seed initial posts if table is empty
        count = conn.execute("SELECT COUNT(*) as cnt FROM blog_posts").fetchone()["cnt"]
        if count == 0:
            _seed_posts(conn)

        logger.info("[blog_db] Initialized at %s", _get_db_path())
    finally:
        conn.close()


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
    conn = _connect()
    try:
        conditions = []
        params: list = []

        if status:
            conditions.append("status = ?")
            params.append(status)
        if category:
            conditions.append("category = ?")
            params.append(category)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        total = conn.execute(
            f"SELECT COUNT(*) as cnt FROM blog_posts {where}", params
        ).fetchone()["cnt"]

        rows = conn.execute(
            f"""SELECT id, slug, title, excerpt, cover_image, category, tags,
                       author, status, read_time, published_at, created_at, updated_at, faq
                FROM blog_posts {where}
                ORDER BY published_at DESC, created_at DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset],
        ).fetchall()

        posts = []
        for r in rows:
            post = dict(r)
            for field in ("tags", "faq"):
                if post.get(field):
                    try:
                        post[field] = json.loads(post[field])
                    except (json.JSONDecodeError, TypeError):
                        pass
            posts.append(post)

        return {
            "posts": posts,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    finally:
        conn.close()


def get_post_by_slug(slug: str) -> Optional[dict]:
    """Get a single post by slug."""
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT * FROM blog_posts WHERE slug = ?", (slug,)
        ).fetchone()
        if not row:
            return None

        post = dict(row)
        for field in ("tags", "faq"):
            if post.get(field):
                try:
                    post[field] = json.loads(post[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        return post
    finally:
        conn.close()


def get_categories() -> list[dict]:
    """Get distinct categories with counts."""
    conn = _connect()
    try:
        rows = conn.execute(
            """SELECT category, COUNT(*) as count
               FROM blog_posts
               WHERE status = 'published'
               GROUP BY category
               ORDER BY count DESC"""
        ).fetchall()
        return [{"category": r["category"], "count": r["count"]} for r in rows]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def create_post(data: dict) -> dict:
    """Insert a new blog post."""
    now = datetime.now(timezone.utc).isoformat()
    post_id = uuid4().hex
    tags = json.dumps(data.get("tags", []))
    faq = json.dumps(data.get("faq", []))

    conn = _connect()
    try:
        conn.execute(
            """INSERT INTO blog_posts (
                id, slug, title, excerpt, content, cover_image,
                category, tags, author, status, read_time,
                published_at, created_at, updated_at, faq
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                post_id,
                data.get("slug", ""),
                data.get("title", ""),
                data.get("excerpt", ""),
                data.get("content", ""),
                data.get("cover_image", ""),
                data.get("category", "General"),
                tags,
                data.get("author", "Vector Team"),
                data.get("status", "draft"),
                data.get("read_time", 5),
                now if data.get("status") == "published" else data.get("published_at"),
                now,
                now,
                faq,
            ),
        )
        conn.commit()
        logger.info("[blog_db] Created post %s (%s)", post_id, data.get("slug"))
        return get_post_by_slug(data.get("slug", "")) or {"id": post_id}
    finally:
        conn.close()


def update_post(post_id: str, data: dict) -> Optional[dict]:
    """Update an existing blog post."""
    now = datetime.now(timezone.utc).isoformat()

    conn = _connect()
    try:
        existing = conn.execute(
            "SELECT * FROM blog_posts WHERE id = ?", (post_id,)
        ).fetchone()
        if not existing:
            return None

        existing = dict(existing)

        slug = data.get("slug", existing["slug"])
        title = data.get("title", existing["title"])
        excerpt = data.get("excerpt", existing["excerpt"])
        content = data.get("content", existing["content"])
        cover_image = data.get("cover_image", existing["cover_image"])
        category = data.get("category", existing["category"])
        tags = json.dumps(data["tags"]) if "tags" in data else existing["tags"]
        faq = json.dumps(data["faq"]) if "faq" in data else existing.get("faq", "[]")
        author = data.get("author", existing["author"])
        status = data.get("status", existing["status"])
        read_time = data.get("read_time", existing["read_time"])
        published_at = existing["published_at"]

        # Set published_at when transitioning to published
        if status == "published" and existing["status"] != "published":
            published_at = now
        if "published_at" in data:
            published_at = data["published_at"]

        conn.execute(
            """UPDATE blog_posts
               SET slug = ?, title = ?, excerpt = ?, content = ?,
                   cover_image = ?, category = ?, tags = ?, author = ?,
                   status = ?, read_time = ?, published_at = ?, updated_at = ?,
                   faq = ?
               WHERE id = ?""",
            (
                slug, title, excerpt, content,
                cover_image, category, tags, author,
                status, read_time, published_at, now,
                faq, post_id,
            ),
        )
        conn.commit()
        logger.info("[blog_db] Updated post %s", post_id)

        return get_post_by_slug(slug)
    finally:
        conn.close()


def delete_post(post_id: str) -> bool:
    """Delete a blog post."""
    conn = _connect()
    try:
        cursor = conn.execute("DELETE FROM blog_posts WHERE id = ?", (post_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def _seed_posts(conn: sqlite3.Connection) -> None:
    """Seed 3 initial blog posts."""
    now = datetime.now(timezone.utc).isoformat()

    posts = [
        {
            "slug": "why-we-built-vector-privacy-first-finance",
            "title": "Why We Built Vector: Privacy-First Finance",
            "excerpt": "In a world where every fintech app wants your data, we chose a different path. Here's why Vector processes everything locally.",
            "category": "Privacy",
            "tags": json.dumps(["privacy", "security", "philosophy"]),
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
            "slug": "how-our-3-model-ai-consensus-engine-works",
            "title": "How Our 3-Model AI Consensus Engine Works",
            "excerpt": "Most AI apps use a single model. Vector uses three — and makes them vote. Here's the engineering behind our consensus system.",
            "category": "Engineering",
            "tags": json.dumps(["ai", "engineering", "consensus", "llm"]),
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
            "slug": "getting-started-with-vector-a-quick-guide",
            "title": "Getting Started with Vector: A Quick Guide",
            "excerpt": "From download to your first spending insight in under 2 minutes. Here's how to get started with Vector.",
            "category": "Guide",
            "tags": json.dumps(["guide", "getting-started", "tutorial"]),
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
        post_id = uuid4().hex
        conn.execute(
            """INSERT INTO blog_posts (
                id, slug, title, excerpt, content, cover_image,
                category, tags, author, status, read_time,
                published_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                post_id,
                post["slug"],
                post["title"],
                post["excerpt"],
                post["content"],
                "",
                post["category"],
                post["tags"],
                "Vector Team",
                "published",
                post.get("read_time", 5),
                now,
                now,
                now,
            ),
        )

    conn.commit()
    logger.info("[blog_db] Seeded %d initial blog posts", len(posts))

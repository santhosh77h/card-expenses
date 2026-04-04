# Backend MongoDB — Entity Relationships

> Database: **`vector`** (configurable via `MONGO_DB_NAME`)
> Driver: **PyMongo** (no ODM) — all `_id` fields use 21-char nanoid strings
> Helper: `doc_to_dict()` renames `_id` → `id` for API responses

---

## Collections at a Glance

| Domain | Collections | Module |
|--------|------------|--------|
| **Auth & Billing** | users, subscriptions, usage, credits, refresh_tokens | `app/user_db.py` |
| **Dashboard / Analytics** | statements, llm_calls, responses | `app/dashboard_db.py` |
| **Blog CMS** | blog_posts, blog_post_versions | `app/blog_db.py` |
| **Contact** | contact_submissions | `app/contact.py` |

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUTH & BILLING DOMAIN                            │
│                                                                         │
│                        ┌──────────────────────┐                         │
│                        │       users           │                         │
│                        │──────────────────────│                         │
│                        │ _id        (nanoid)   │                         │
│                        │ apple_user_id  (UQ)   │                         │
│                        │ email?                │                         │
│                        │ email_verified        │                         │
│                        │ created_at            │                         │
│                        │ updated_at            │                         │
│                        └──────────┬───────────┘                         │
│                                   │                                      │
│            ┌──────────┬───────────┼──────────┬──────────┐               │
│            │ 1:1      │ 1:1       │ 1:N      │ 1:N      │               │
│            ▼          ▼           ▼          ▼          │               │
│  ┌──────────────┐ ┌─────────┐ ┌────────┐ ┌──────────────┐              │
│  │subscriptions │ │ credits │ │ usage  │ │refresh_tokens│              │
│  │──────────────│ │─────────│ │────────│ │──────────────│              │
│  │ _id          │ │ _id     │ │ _id    │ │ _id (hash)   │              │
│  │ apple_user_id│ │ apple_  │ │ apple_ │ │ apple_user_id│              │
│  │   (UQ)      │ │ user_id │ │ user_id│ │ expires_at   │              │
│  │ plan        │ │   (UQ)  │ │ month  │ │   (TTL)      │              │
│  │ product_id  │ │ balance │ │  (UQ   │ │ created_at   │              │
│  │ status      │ │ history │ │  comp.)│ └──────────────┘              │
│  │ max_parses  │ │   []    │ │ parses_│                                │
│  │ current_    │ │ created │ │  used  │                                │
│  │  period_*   │ │ updated │ │ updated│                                │
│  └──────────────┘ └─────────┘ └────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                     DASHBOARD / ANALYTICS DOMAIN                        │
│                                                                         │
│                    ┌───────────────────────────┐                        │
│                    │       statements           │                        │
│                    │───────────────────────────│                        │
│                    │ _id          (nanoid)      │                        │
│                    │ filename                   │                        │
│                    │ file_size_bytes            │                        │
│                    │ bank_detected              │                        │
│                    │ currency_detected          │                        │
│                    │ country_detected           │                        │
│                    │ region_detected            │                        │
│                    │ date_format_detected       │                        │
│                    │ statement_type_detected    │                        │
│                    │ language_detected          │                        │
│                    │ transaction_count          │                        │
│                    │ total_debits / credits     │                        │
│                    │ net                        │                        │
│                    │ confidence (0.0–1.0)       │                        │
│                    │ consensus_method           │                        │
│                    │ llm_count / llm_sources[]  │                        │
│                    │ transactions_flagged       │                        │
│                    │ parsing_method             │                        │
│                    │ label / notes              │                        │
│                    │ statement_period_from/to   │                        │
│                    │ card_last4 / card_network  │                        │
│                    │ pdf_password?              │                        │
│                    │ created_at / updated_at    │                        │
│                    └─────────┬─────────────────┘                        │
│                              │                                           │
│                    ┌─────────┼──────────┐                               │
│                    │ 1:N     │          │ 1:1                            │
│                    ▼         │          ▼                                │
│         ┌─────────────────┐ │ ┌─────────────────┐                      │
│         │   llm_calls     │ │ │   responses      │                      │
│         │─────────────────│ │ │─────────────────│                      │
│         │ _id             │ │ │ _id              │                      │
│         │ statement_id    │ │ │ statement_id(UQ) │                      │
│         │ stage           │ │ │ response_json    │                      │
│         │ provider        │ │ │ created_at       │                      │
│         │ provider_model  │ │ └─────────────────┘                      │
│         │ system_prompt   │ │                                           │
│         │ user_message    │ │                                           │
│         │ raw_response?   │ │                                           │
│         │ parsed_response?│ │                                           │
│         │ success         │ │                                           │
│         │ error?          │ │                                           │
│         │ latency_ms?     │ │                                           │
│         │ created_at      │ │                                           │
│         └─────────────────┘ │                                           │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │

┌─────────────────────────────────────────────────────────────────────────┐
│                          BLOG CMS DOMAIN                                │
│                                                                         │
│           ┌──────────────────────────┐                                  │
│           │      blog_posts          │                                  │
│           │──────────────────────────│                                  │
│           │ _id           (nanoid)   │                                  │
│           │ slug            (UQ)     │                                  │
│           │ title                    │                                  │
│           │ excerpt                  │                                  │
│           │ content (markdown)       │                                  │
│           │ cover_image              │                                  │
│           │ category                 │                                  │
│           │ tags []                  │                                  │
│           │ author                   │                                  │
│           │ status                   │                                  │
│           │   (draft/scheduled/      │                                  │
│           │    published)            │                                  │
│           │ read_time                │                                  │
│           │ published_at?            │                                  │
│           │ scheduled_at?            │                                  │
│           │ faq []                   │                                  │
│           │ created_at / updated_at  │                                  │
│           └────────────┬─────────────┘                                  │
│                        │ 1:N (max 3 kept)                               │
│                        ▼                                                │
│           ┌──────────────────────────┐                                  │
│           │  blog_post_versions      │                                  │
│           │──────────────────────────│                                  │
│           │ _id           (nanoid)   │                                  │
│           │ post_id ─────────────────┼──▶ blog_posts._id               │
│           │ saved_at                 │                                  │
│           │ (full snapshot of all    │                                  │
│           │  blog_posts fields)      │                                  │
│           └──────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTACT DOMAIN (standalone)                      │
│                                                                         │
│           ┌──────────────────────────┐                                  │
│           │  contact_submissions     │                                  │
│           │──────────────────────────│                                  │
│           │ _id           (nanoid)   │                                  │
│           │ name                     │                                  │
│           │ email                    │                                  │
│           │ subject                  │                                  │
│           │   (feedback/bugReport/   │                                  │
│           │    featureRequest/       │                                  │
│           │    generalQuery/other)   │                                  │
│           │ message                  │                                  │
│           │ ip                       │                                  │
│           │ status                   │                                  │
│           │ created_at               │                                  │
│           └──────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Relationship Summary

| Relationship | Type | Linked By | Cascade Delete? |
|---|---|---|---|
| **users → subscriptions** | 1 : 1 | `apple_user_id` | No (manual) |
| **users → credits** | 1 : 1 | `apple_user_id` | No (manual) |
| **users → usage** | 1 : N (monthly) | `apple_user_id` + `month` | No (manual) |
| **users → refresh_tokens** | 1 : N | `apple_user_id` | Yes (logout deletes all) |
| **statements → llm_calls** | 1 : N | `statement_id` | Yes (manual cascade) |
| **statements → responses** | 1 : 1 | `statement_id` | Yes (manual cascade) |
| **blog_posts → blog_post_versions** | 1 : N (max 3) | `post_id` | Yes (manual cascade) |
| **contact_submissions** | standalone | — | — |

> MongoDB has no FK constraints — all cascades are enforced in application code.

---

## Cross-Domain Note

The **dashboard `statements`** collection (server-side analytics) is **not** the same as the mobile SQLite `statements` table. They serve different purposes:

| | Backend MongoDB `statements` | Mobile SQLite `statements` |
|---|---|---|
| **Purpose** | Analytics dashboard — tracks every parse request | User's personal data — stores parsed results |
| **Contains** | Metadata, confidence scores, LLM call stats | Full transaction data, CSV, summary JSON |
| **Linked to user?** | No (anonymous analytics) | Yes (via `cardId` in AsyncStorage) |

---

## Indexes

| Collection | Index | Type |
|---|---|---|
| **users** | `apple_user_id` | Unique |
| **subscriptions** | `apple_user_id` | Unique |
| **usage** | `(apple_user_id, month)` | Unique compound |
| **credits** | `apple_user_id` | Unique |
| **refresh_tokens** | `apple_user_id` | Regular |
| **refresh_tokens** | `expires_at` | **TTL** (auto-delete on expiry) |
| **statements** | `created_at` | Regular |
| **statements** | `bank_detected` | Regular |
| **statements** | `label` | Regular |
| **llm_calls** | `statement_id` | Regular |
| **responses** | `statement_id` | Unique |
| **blog_posts** | `slug` | Unique |
| **blog_posts** | `status` | Regular |
| **blog_posts** | `published_at` | Regular |
| **blog_posts** | `(status, scheduled_at)` | Compound |
| **blog_post_versions** | `post_id` | Regular |
| **blog_post_versions** | `(post_id, saved_at desc)` | Compound |
| **contact_submissions** | `email` | Regular |
| **contact_submissions** | `created_at` | Regular |
| **contact_submissions** | `status` | Regular |

---

## Key Design Patterns

### Nanoid over ObjectId
All `_id` fields use 21-character nanoid strings instead of MongoDB ObjectId — shorter, URL-safe, no import needed on the client.

### Embedded vs Referenced
- **Embedded**: `credits.history[]` — purchase/usage log lives inside the credits doc (avoids extra collection for simple append-only log)
- **Referenced**: Everything else uses `apple_user_id` or `statement_id` as foreign keys across collections

### TTL for Token Cleanup
`refresh_tokens.expires_at` has a TTL index (`expireAfterSeconds: 0`) — MongoDB automatically deletes expired tokens. No cron job needed.

### Version Snapshots (Blog)
Before every update, the current blog post state is snapshotted into `blog_post_versions`. Only the last 3 versions are kept (older ones pruned on write).

### Upsert-Heavy
Auth & billing collections use `update_one(..., upsert=True)` extensively — `find_or_create_user()`, `upsert_subscription()`, `get_usage()` all create-if-missing.

---

## Initialization

Collections and indexes are created at app startup via lifespan handlers:

```python
# app/__init__.py — startup
init_user_db()        # users, subscriptions, usage, credits, refresh_tokens
init_dashboard_db()   # statements, llm_calls, responses
init_blog_db()        # blog_posts, blog_post_versions
init_contact_db()     # contact_submissions
```

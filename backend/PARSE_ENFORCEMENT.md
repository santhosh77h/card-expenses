# Parse Enforcement & Usage System

Complete reference for how Vector decides whether to allow a PDF parse and how usage is tracked.

---

## Request Lifecycle

When a user hits `POST /parse-statement/json`, the request passes through these gates **in order**. If any gate fails, the request is rejected immediately — later gates are never reached.

```
Request arrives
  |
  v
[1] Rate Limit ──── 429 Too Many Requests
  |
  v
[2] Authentication ── 401 Unauthorized
  |
  v
[3] File Validation ── 400 / 413
  |
  v
[4] Usage Enforcement (trial → subscription → credits) ── 403 Forbidden
  |
  v
[5] PDF Parsing
  |
  v
[6] Debit (only after successful parse)
  |
  v
[7] Response (200 + usage info)
```

---

## Gate 1: Rate Limiting

**File:** `app/rate_limiter.py`

| Setting | Default | Description |
|---------|---------|-------------|
| `RATE_LIMIT_REQUESTS` | 10 | Max requests per window |
| `RATE_LIMIT_WINDOW` | 60 | Window duration in seconds |
| `REDIS_URL` | `""` | Redis connection (if empty, rate limiting is disabled) |

- Uses a **sliding window counter** per client IP in Redis
- IP extracted from `X-Forwarded-For` header (first IP), falls back to `request.client.host`
- **Fails open** — if Redis is down or unconfigured, requests pass through
- Returns `429` with `Retry-After` header when exceeded

---

## Gate 2: Authentication

**File:** `app/auth_deps.py`

1. Extract `Bearer <token>` from `Authorization` header → **401** if missing
2. Decode JWT (HS256, signed with `JWT_SECRET_KEY`) → **401** if expired or invalid
3. Extract `sub` claim (Apple user ID) → **401** if missing
4. `find_or_create_user(apple_user_id)` → upsert in MongoDB `users` collection
5. Attach trial + subscription info to user dict for downstream use

**JWT settings:**
| Setting | Default |
|---------|---------|
| `JWT_ACCESS_EXPIRY_MINUTES` | 15 |
| `JWT_REFRESH_EXPIRY_DAYS` | 30 |

---

## Gate 3: File Validation

**File:** `app/routes.py`

| Check | Error | Detail |
|-------|-------|--------|
| File must end with `.pdf` | 400 | `"Only PDF files are accepted."` |
| File must not be empty | 400 | `"Empty file uploaded."` |
| File must be under size limit | 413 | `"File exceeds {MAX_FILE_SIZE_MB} MB limit."` |

`MAX_FILE_SIZE_MB` defaults to **10**.

---

## Gate 4: Usage Enforcement

**File:** `app/routes.py` — this is the core business logic

### Priority Order

```
1. TRIAL    → if active AND has remaining parses → debit from trial
2. SUBSCRIPTION → if active AND has remaining parses this month → debit from subscription
3. CREDITS  → if balance > 0 → debit from credits
4. DENY     → 403 "No trial, subscription, or credits available"
```

The system always tries to use the **highest-priority** resource first.

### 1. Trial Check

**Collection:** `trials` (indexed on `user_id`, unique)

A trial is considered **active** when ALL of these are true:
- Trial doc exists for this user
- `parses_used < max_parses` (haven't exhausted the 15 parses)
- `expires_at` is in the future (haven't exceeded the 15 days)

| Constant | Value |
|----------|-------|
| `TRIAL_MAX_PARSES` | 15 |
| `TRIAL_DAYS` | 15 |

**Key design decision:** Trial usage is tracked directly on the trial doc (`parses_used` field), NOT in the monthly `usage` collection. This prevents the bug where usage resets at month boundaries.

### 2. Subscription Check

**Collection:** `subscriptions` (indexed on `user_id`, unique)

A subscription is **active** when:
- `status == "active"`

(No time check needed — RevenueCat webhook handles expiry by setting `status` to `"expired"`)

| Plan | Max Parses / Month |
|------|--------------------|
| `monthly` | 4 |
| `yearly` | 4 |

Remaining calculated as: `max(0, max_parses - current_month_usage.parses_used)`

**Collection:** `usage` (indexed on `(user_id, month)`, unique)
- Month format: `YYYY-MM`
- Resets naturally each calendar month (new doc created)
- Also explicitly reset on subscription `RENEWAL` webhook

### 3. Credits Check

**Collection:** `credits` (indexed on `user_id`, unique)

- 1 credit = 1 parse
- No expiry
- Purchased via in-app purchase (RevenueCat)
- Products: `vector_credits_10` (10 credits), `vector_credits_100` (100 credits)

---

## Gate 5: PDF Parsing

**File:** `app/parser.py`

If all gates pass, the actual parsing happens. The PDF can still fail here (encrypted, corrupted, unparseable). **Important:** if parsing fails, no debit is applied — the user is not charged.

---

## Gate 6: Post-Parse Debit

Debit happens **only after successful parse**. Wrapped in try/except — if debit fails, the parsed result is still returned (failure is logged).

### Trial Debit
```
MongoDB: trials.find_one_and_update(
  {user_id},
  {$inc: {parses_used: 1}}
)
```

### Subscription Debit
```
MongoDB: usage.find_one_and_update(
  {user_id, month: "YYYY-MM"},
  {$inc: {parses_used: 1}},
  upsert: true
)
```

### Credit Debit
```
MongoDB: credits.find_one_and_update(
  {user_id, balance: {$gt: 0}},
  {$inc: {balance: -1}},
  {$push: {history: {type: "used", amount: -1, at: now}}}
)
```

---

## Response

The parsed result includes a `usage` object:

```json
{
  "transactions": [...],
  "summary": {...},
  "usage": {
    "debited": "trial" | "subscription" | "credit",
    "trial_remaining": 14,
    "subscription_remaining": 3,
    "credit_balance": 8
  }
}
```

The mobile app uses this to update the local UI immediately without re-fetching.

---

## Pre-Check Endpoint

**Route:** `GET /api/usage/check`
**File:** `app/subscription_routes.py`

Lightweight check the mobile app calls **before** showing the upload UI. Same 3-tier logic but read-only (no debit, no side effects).

```json
{
  "allowed": true,
  "trial_remaining": 5,
  "subscription_remaining": 0,
  "credit_balance": 10,
  "reason": null
}
```

---

## Subscription Status Endpoint

**Route:** `GET /api/subscription`
**File:** `app/subscription_routes.py`

Returns full breakdown of trial, subscription, and credits:

```json
{
  "trial": {
    "active": true,
    "max_parses": 15,
    "parses_used": 3,
    "parses_remaining": 12,
    "expires_at": "2026-04-19T10:30:00+00:00"
  },
  "subscription": null,
  "usage": {
    "month": "2026-04",
    "parses_used": 0,
    "parses_remaining": 0
  },
  "credits": {
    "balance": 0
  }
}
```

---

## User Lifecycle Scenarios

### Scenario 1: New User (Trial)

```
Day 1:  Sign in with Apple → trial granted (15 parses, 15 days)
Day 3:  Parse 1 → debit from trial (14 remaining)
Day 10: Parse 8 → debit from trial (7 remaining)
Day 16: Trial expired by time → 403 on next parse
```

### Scenario 2: Trial Exhausted Early

```
Day 1:  Sign in → trial granted
Day 5:  Used all 15 parses → trial exhausted
Day 5:  Next parse → 403 (must subscribe or buy credits)
```

### Scenario 3: Subscribe During Trial

```
Day 1:  Sign in → trial granted (15 parses, 15 days)
Day 3:  Parse 3 → trial (12 remaining)
Day 5:  Purchase monthly subscription (4 parses/month)
Day 5:  Parse 4 → trial (11 remaining) ← trial still used first!
Day 16: Trial expires → subscription kicks in (4/month)
Day 20: Parse 1 → subscription (3 remaining this month)
```

### Scenario 4: Credits as Fallback

```
Day 1:  Sign in → trial granted
Day 16: Trial expired, no subscription
Day 16: Buy 10 credits
Day 16: Parse �� credit (9 remaining)
Day 30: Buy monthly subscription
Day 30: Parse → subscription (3 remaining) ← subscription before credits
```

### Scenario 5: Subscription Renewal

```
Month 1: Subscribe monthly → 4 parses
Month 1: Use all 4 → 0 remaining
Month 2: RevenueCat RENEWAL webhook → usage reset → 4 parses again
```

---

## Error Reference

| HTTP | Message | When |
|------|---------|------|
| 400 | Only PDF files are accepted. | Non-PDF upload |
| 400 | Empty file uploaded. | Zero-byte file |
| 401 | Missing or invalid Authorization header | No Bearer token |
| 401 | Access token expired | JWT expired |
| 401 | Invalid access token: {error} | JWT decode failure |
| 401 | Token missing 'sub' claim | Malformed JWT |
| 403 | No trial, subscription, or credits available | All resources exhausted |
| 413 | File exceeds {N} MB limit. | File too large |
| 429 | Too many requests. Try again in {N} seconds. | Rate limit hit |

---

## MongoDB Collections

| Collection | Primary Index | Purpose |
|------------|---------------|---------|
| `users` | `apple_user_id` (unique) | User profiles |
| `trials` | `user_id` (unique) | Trial state (parses_used, expires_at) |
| `subscriptions` | `user_id` (unique) | Paid plan state (plan, status, max_parses) |
| `usage` | `(user_id, month)` (unique) | Monthly parse count for subscriptions |
| `credits` | `user_id` (unique) | Credit balance + transaction history |
| `refresh_tokens` | `user_id`, TTL on `expires_at` | Session tokens |

---

## RevenueCat Webhook Events

**Route:** `POST /webhooks/revenuecat`
**File:** `app/webhook_routes.py`

| Event | Action |
|-------|--------|
| `INITIAL_PURCHASE` | Create subscription (plan, max_parses, period dates) |
| `RENEWAL` | Update subscription + **reset monthly usage** |
| `CANCELLATION` | Mark `status="cancelled"` (remains active until period end) |
| `EXPIRATION` | Mark `status="expired"`, `max_parses=0` |
| `REFUND` | Mark `status="refunded"`, `max_parses=0` |
| `PRODUCT_CHANGE` | Update plan + max_parses |
| `NON_RENEWING_PURCHASE` | Add credits to balance |
| `BILLING_ISSUE` | Log warning (no state change) |

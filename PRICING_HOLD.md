# Vector Mobile App - Pricing

## Overview

Vector uses a hybrid monetization model: a **free tier** for casual users, **subscription plans** (monthly and yearly) for regular users, and **credit packs** for pay-as-you-go top-ups. All plans are processed via RevenueCat.

---

## Subscription Plans

### Regular Pricing

| Plan | Price | Statements/Month | Billed |
|------|-------|-----------------|--------|
| **Free** | $0 | 1 per month | — |
| **Monthly** | $5 / month | 8 per month | Monthly |
| **Yearly** | $48 / year *(= $4/month)* | 12 per month | Annually |

### Introductory / Launch Pricing *(limited time)*

| Plan | Intro Price | Statements/Month | Savings vs Regular |
|------|-------------|-----------------|-------------------|
| **Monthly** | $3 / month | 8 per month | Save $2/month |
| **Yearly** | $24 / year *(= $2/month)* | 12 per month | Save $24/year |

> Introductory pricing is available for a limited time during early launch. Users locked into intro pricing retain their rate as long as their subscription remains active.

---

## New User Signup Bonus

| Bonus | Details |
|-------|---------|
| **15 free statement uploads** | Granted automatically on first app launch |
| **Valid for** | 15 days from signup date |
| **Applies to** | All new users regardless of plan |
| **Expiry** | Unused bonus statements expire automatically after 15 days and cannot be carried over |

> This bonus lets new users experience the full parsing pipeline before committing to a plan.

---

## Credit Packs *(Pay-as-you-go)*

Credits are one-time purchases. Each credit = 1 statement parse. Credits **never expire** and stack with subscription allowances.

| Pack | Price | Statements Included | Rate per Statement |
|------|-------|--------------------|--------------------|
| **Starter** | $10 | 30 statements | $0.33 each |
| **Standard** | $20 | 70 statements | ~$0.29 each |
| **Mega** | $99 | 400 statements | ~$0.25 each |

> Bulk packs offer better per-statement value. The Mega pack is suited for power users, accountants, or anyone importing large statement backlogs.

**Credit usage rules:**
- Credits are consumed only after the monthly subscription/free allowance is exhausted
- Credits do not reset monthly — they persist until used
- Credits are non-refundable once purchased

---

## Plan Comparison

| Feature | Free | Monthly | Yearly |
|---------|------|---------|--------|
| Statements/month | 1 | 8 | 12 |
| Credit pack top-ups | ✅ | ✅ | ✅ |
| All analytics & charts | ✅ | ✅ | ✅ |
| Ask Vector (NLU queries) | ✅ | ✅ | ✅ |
| Biometric lock | ✅ | ✅ | ✅ |
| Encrypted backups | ✅ | ✅ | ✅ |
| CSV export | ✅ | ✅ | ✅ |
| New user signup bonus | ✅ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

---

## Statement Allowance Logic

```
Monthly allowance resets on the 1st of each calendar month.
Credit pack balance carries over indefinitely.

Parse order:
  1. New user bonus (if within 15-day window)
  2. Monthly subscription/free allowance
  3. Credit pack balance
```

---

## Notes for Implementation

| Item | Detail |
|------|--------|
| **Payment provider** | RevenueCat (existing integration) |
| **Intro pricing enforcement** | RevenueCat introductory offers or App Store / Play Store promo pricing |
| **Credit pack type** | Non-consumable or consumable one-time purchase via RevenueCat |
| **Bonus grant trigger** | On first app launch / account creation, write `bonus_statements: 15`, `bonus_expiry: now + 15 days` to local SQLite |
| **Bonus expiry enforcement** | Check `bonus_expiry` date on every parse attempt; zero out if past expiry |
| **Credit expiry** | None — credits persist in local SQLite until consumed |

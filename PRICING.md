# Vector Mobile App - Pricing

## Philosophy

One decision, one moment. Users are never shown more than two options at a time.
No free tier. No intro vs regular confusion. No overlapping plans.

---

## Step 1 — Everyone Starts Here (No Card Required)

> **15 statements free for 15 days.**
> Automatically granted on first app launch. No sign-up friction.

| Detail | Value |
|--------|-------|
| Statements included | 15 |
| Valid for | 15 days from first launch |
| Card required | No |
| Expiry | Unused statements expire automatically after 15 days |

After the trial ends (or all 15 statements are used), the user is shown the paywall.

---

## Step 2 — Paywall (Shown Once Trial Ends)

Two options only. No other plans shown.

| | Monthly | Yearly |
|---|---|---|
| **Price** | $3 / month | $24 / year *(= $2/month)* |
| **Statements** | 8 per month | 12 per month |
| **Billed** | Every month | Once a year |
| **Best for** | Trying it out | Regular users |
| | | ⭐ Best Value |

> Monthly allowance resets on the 1st of every calendar month.
> Unused monthly statements do not carry over.

---

## Step 3 — Top-Up Credits (Shown Only When Monthly Limit Is Hit)

Shown as a non-intrusive nudge: *"Need more this month? Top up instantly."*
Credits never expire and stack on top of the subscription allowance.

| Pack | Price | Statements | Rate per Statement |
|------|-------|------------|--------------------|
| **Starter** | $10 | 30 | $0.33 each |
| **Standard** | $20 | 70 | ~$0.29 each |

> Credits are consumed only after the monthly subscription allowance is exhausted.
> Credits are non-refundable once purchased.
> No expiry — credits persist until used.

---

## User Journey Summary

```
First launch
    └── 15-day trial (15 statements, no card)
            ├── Trial ends or statements used up
            │       └── Paywall: Monthly ($3) or Yearly ($24) ⭐
            │               └── Monthly limit hit mid-month?
            │                       └── Top-up nudge: $10 or $20
            └── User subscribes during trial
                    └── Trial balance used first, then subscription kicks in
```

---

## What's Intentionally Left Out (For Now)

| Removed | Reason |
|---------|--------|
| Free tier (2 statements/month) | Replaced by trial — better conversion, same experience |
| Regular pricing ($5/mo, $48/yr) | Launch with competitive rates, raise prices after traction |
| $99 Mega credit pack | Too niche at launch, revisit when power users emerge |
| Intro vs regular price labels | Current price IS the price — no confusion needed |

---

## Implementation Notes

| Item | Detail |
|------|--------|
| **Payment provider** | RevenueCat (existing integration) |
| **Trial grant trigger** | On first app launch, write `trial_statements: 15`, `trial_expiry: now + 15 days` to local SQLite |
| **Trial expiry check** | On every parse attempt, check `trial_expiry` date — zero out if past expiry |
| **Paywall trigger** | Show on trial end OR when `trial_statements == 0` |
| **Top-up nudge trigger** | Show only when monthly subscription allowance hits 0, never proactively |
| **Credit type** | Consumable one-time purchase via RevenueCat |
| **Credit storage** | Persist credit balance in local SQLite, no expiry date set |
| **Parse order** | Trial balance → Monthly subscription allowance → Credit pack balance |

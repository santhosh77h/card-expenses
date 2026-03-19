# Vector Mobile App - Features

## Core

| # | Feature | Details |
|---|---------|---------|
| 1 | **PDF Statement Parsing** | Upload credit card PDFs, extract transactions via LLM (GPT-4o-mini) with regex fallback. Supports 7+ banks (HDFC, ICICI, SBI, Axis, Chase, Amex, Citi) and 4 currencies (INR, USD, EUR, GBP). |
| 2 | **Batch Upload** | Upload multiple PDFs at once with per-file status tracking (pending, parsing, success, failed, duplicate, skipped). |
| 3 | **Password-Protected PDFs** | Auto-retry with a pool of up to 5 saved passwords. Manual prompt if pool exhausted. |
| 4 | **Duplicate Detection** | SHA-256 file hashing prevents re-importing the same statement. |
| 5 | **Statement Diff** | Re-uploading a statement shows added/modified/removed transactions with checkboxes to selectively apply changes. |
| 6 | **Demo Mode** | 24 realistic mock transactions across 12 categories to try the app without a real PDF. |

## Card Management

| # | Feature | Details |
|---|---------|---------|
| 7 | **Add Card** | Manual form with nickname, last 4, issuer, network, credit limit, billing cycle, currency, color. Live card preview updates as you type. |
| 8 | **On-Device Card OCR** | Scan a physical card via camera. ML Kit text recognition extracts last 4 digits, issuer, network, and cardholder name - all on-device, no image leaves the phone. |
| 9 | **Edit Card** | Update all card fields, set per-card statement reminder day, manage payment info (amount due, minimum due, due date). |
| 10 | **Delete Card** | With confirmation dialog. |
| 11 | **Card Color Picker** | 8 predefined colors, auto-suggests unused colors for new cards. |
| 12 | **Per-Card Statement History** | View all imported statements per card with bank, date, and transaction count. |
| 13 | **Auto Card Association** | Statements auto-match to existing cards by last 4 digits and bank. Prompts to create a new card if no match found. |

## Transactions

| # | Feature | Details |
|---|---------|---------|
| 14 | **Unified Transaction List** | Shows both statement-imported and manually added transactions in one view. |
| 15 | **Manual Transaction Entry** | Add transactions by hand with date, description, amount, category, type. |
| 16 | **Month Selector** | Sticky dropdown to filter by month. Shows per-month totals (debits/credits per currency). |
| 17 | **Search** | Real-time full-text search by description or category. |
| 18 | **Category Filter Chips** | Horizontal scroll chips to filter by spending category with color dots. |
| 19 | **Card Filter Chips** | Filter transactions by card (includes "No Card" for unassociated). |
| 20 | **Enrichment Filters** | Filter by Starred, Has Notes, or Has Receipt. |
| 21 | **Sort Toggle** | Sort by date (newest first) or by amount (largest first). |
| 22 | **Transaction Detail Modal** | Full detail view with edit mode, notes, star/flag, receipt attachment, and next/prev navigation. |
| 23 | **Inline Editing** | Edit description, amount, date, category, and type directly from the detail modal. |
| 24 | **Delete Transaction** | Per-transaction delete with confirmation. |

## Enrichments

| # | Feature | Details |
|---|---------|---------|
| 25 | **Notes** | Free-text notes per transaction, auto-saved on blur. |
| 26 | **Star/Flag** | Quick-toggle flag for marking transactions. |
| 27 | **Receipt Attachment** | Attach a photo from gallery or capture via camera. Saved to device filesystem. Viewable as thumbnail in detail modal. |

## Analytics & Charts

| # | Feature | Details |
|---|---------|---------|
| 28 | **12-Month Trend Line Chart** | Monthly spending trend with average line overlay. |
| 29 | **Category Donut Chart** | Pie/donut chart showing spending distribution across 12 categories. |
| 30 | **Daily Spending Chart** | Per-day spending sparkline for the selected month. |
| 31 | **Top Categories Breakdown** | Ranked list with amount, percentage, and horizontal bar visualization. |
| 32 | **Top Merchants by Spend** | Merchant ranking with avatar, transaction count, and total amount. |
| 33 | **Spending Insights** | Auto-generated natural language insights (peak month, lowest month, trends). |
| 34 | **Month-over-Month Comparison** | Per-card chips show total spend and % change with arrows. |
| 35 | **Multi-Currency Analytics** | Currency toggle filters all charts and summaries. |
| 36 | **Period Navigation** | Previous/next buttons to scroll through months of data. |

## Statement Analysis Screen

| # | Feature | Details |
|---|---------|---------|
| 37 | **Overview Tab** | Bank, period, transaction count, totals, per-category breakdown, largest transaction, CSV export. |
| 38 | **Transactions Tab** | Searchable, filterable, sortable list of statement transactions with inline editing. |
| 39 | **Categories Tab** | Donut chart + detailed category breakdown for the statement. |
| 40 | **Import to Transactions** | One-tap import of statement transactions into the main transaction list. |
| 41 | **CSV Export** | Export statement transactions as CSV via system share sheet. |

## Ask Vector (Natural Language Queries)

| # | Feature | Details |
|---|---------|---------|
| 42 | **On-Device NLU** | TFLite intent + entity classifiers for natural language expense queries. Works offline. |
| 43 | **Spell Correction** | Levenshtein distance-based typo correction before ML inference. |
| 44 | **Supported Intents** | count_transactions, total_spent, highest/lowest_transaction, category_spend, monthly_summary, compare_months, list_transactions, average_spend, top_category, spending_health, frequent_merchant, unusual_spend, weekly_summary. |
| 45 | **Entity Extraction** | Merchant, category, date range, month parsed from natural language. |
| 46 | **Chart Responses** | Query results rendered as line charts, bar charts, pie charts, or data tables depending on intent. |
| 47 | **Share Results** | Share query results as screenshots. |

## Home Dashboard

| # | Feature | Details |
|---|---------|---------|
| 48 | **Portfolio Card Carousel** | Swipeable monthly portfolio cards showing total due, per-card breakdown, and credit utilization with color-coded progress bars. |
| 49 | **Your Cards Section** | Read-only card summaries with nickname, last 4, statement count, and monthly spending. |

## Notifications & Reminders

| # | Feature | Details |
|---|---------|---------|
| 50 | **Per-Card Statement Reminders** | Schedule monthly notification on a chosen day (1-31) at 9 AM. |
| 51 | **Global Reminder** | Single reminder day for all cards. |
| 52 | **Auto-Reschedule** | Reminders rescheduled on app launch and after preference changes. |

## Security & Privacy

| # | Feature | Details |
|---|---------|---------|
| 53 | **Biometric Lock** | Face ID / Touch ID / device passcode lock screen. Re-locks when app backgrounds. Toggle in settings. |
| 54 | **On-Device Storage** | All data in local SQLite (op-sqlite). No cloud sync, no accounts. |
| 55 | **On-Device ML** | Card OCR and NLU run entirely on-device. No images or queries sent to servers. |
| 56 | **Encrypted Backups** | AES-encrypted JSON backup with user-chosen password. |

## Data & Backup

| # | Feature | Details |
|---|---------|---------|
| 57 | **Encrypted Backup Export** | Full data export (cards, statements, transactions, enrichments) as encrypted JSON via system share. |
| 58 | **Backup Import** | File picker to restore from backup. Detects encryption, prompts for password, shows preview before applying. |
| 59 | **CSV Export** | Plain CSV export of all transactions for spreadsheets. |
| 60 | **Reset All Data** | Nuclear option to erase everything with confirmation. |

## Settings

| # | Feature | Details |
|---|---------|---------|
| 61 | **Theme Mode** | Light / Dark / System toggle. Dark theme default (#0A0E1A background, #00E5A0 accent). |
| 62 | **Default Currency** | INR, USD, EUR, or GBP. Affects formatting and locale. |
| 63 | **Quick Stats** | Card count, statement count, and transaction count at a glance. |

## Monetization

| # | Feature | Details |
|---|---------|---------|
| 64 | **Free Tier** | 3 statement uploads per calendar month. |
| 65 | **Premium (RevenueCat)** | Unlimited uploads, advanced analytics. In-app paywall. |

## Supported Entities

**Issuers**: HDFC Bank, ICICI Bank, SBI Card, Axis Bank, Chase, American Express, Citi, Other

**Networks**: Visa, Mastercard, American Express, RuPay

**Currencies**: INR (Indian numbering), USD, EUR, GBP (Western numbering)

**Categories** (12 fixed): Food & Dining, Groceries, Shopping, Transportation, Entertainment, Health & Medical, Utilities & Bills, Travel, Education, Finance & Investment, Transfers, Other

**Transaction Types**: purchase, payment, refund, reversal, cashback, EMI, fee, tax, interest, adjustment, transfer

## Permissions Required

- Camera (card OCR, receipt capture)
- Photo Library (receipt picking)
- Notifications (statement reminders)
- Local Authentication (biometric lock)
- File System (receipts, backup export/import)
- Network (PDF parsing API)

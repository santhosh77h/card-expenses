# Vector — Feature Reference

> **Your Money. Directed.**
> Privacy-first credit card statement parser. Upload a PDF, get instant spending insights — no data ever stored on our servers.

---

## 1. Privacy-First Architecture

- **Zero data retention** — PDFs are processed entirely in-memory and immediately discarded. No financial data is ever written to disk on the server.
- **All data stays on your device** — Transactions, statements, cards, enrichments, and spending history are stored locally in an encrypted SQLite database on the user's phone.
- **No accounts required** — No sign-up, no email, no tracking of personal identity.
- **No cloud sync** — Data never leaves the device unless the user explicitly exports it.
- **Encrypted backups** — When users export data, it's password-encrypted (AES) before leaving the device.

---

## 2. AI-Powered Statement Parsing

### Multi-LLM Consensus Engine
- **3 AI models parse every statement in parallel** — OpenAI GPT-4o-mini, Anthropic Claude 3.5 Haiku, and Google Gemini 2.0 Flash.
- **Majority voting** — Transactions are aligned across all 3 models and fields are resolved by majority consensus, eliminating hallucinations and single-model errors.
- **Per-transaction confidence scores** — Each transaction gets a confidence score (0–1) based on how many models agreed.
- **Graceful fallback chain** — If consensus isn't available, falls back to single LLM → regex parsing → structured error.

### What Gets Extracted
- **Transactions**: Date, description, amount, debit/credit type, spending category, transaction type (purchase, payment, refund, reversal, cashback, EMI, fee, tax, interest, adjustment, transfer).
- **Card metadata**: Last 4 digits, card network (Visa/Mastercard/Amex/RuPay), credit limit, issuer/bank.
- **Payment info**: Total amount due, minimum amount due, payment due date.
- **Statement period**: From/to dates.
- **Bank & currency**: Auto-detected from PDF content.

### Document Intelligence (Pre-Parse)
- Before parsing transactions, a fast AI probe analyzes the document header to detect:
  - Language, country, currency, date format (DMY/MDY/YMD), statement type (credit card vs bank account), and issuing bank.
  - Uses regulatory clues (IFSC → India, IBAN → Europe, Sort Code → UK, Routing Number → US).
  - Uses phone prefixes (+91, +1, +44, etc.) and currency symbols (₹, $, £, €).

---

## 3. Bank & Currency Support

### Supported Banks (33+)

**India (14)**
HDFC, ICICI, SBI, Axis, Kotak, Yes Bank, IndusInd, RBL, Federal, IDFC First, AU Bank, Bank of Baroda, Canara, PNB

**United States (12)**
Chase, Citi, Bank of America, Wells Fargo, Capital One, Discover, US Bank, Synchrony, PNC, TD Bank, USAA, Barclays US

**United Kingdom (13)**
Barclays, HSBC, NatWest, Lloyds, Santander, Halifax, Nationwide, Virgin Money, Tesco Bank, M&S Bank, John Lewis, Metro Bank, Monzo, Starling

**Multi-Country**
American Express, HSBC (global)

### Supported Currencies
| Currency | Symbol | Formatting |
|----------|--------|-----------|
| INR | ₹ | Indian grouping (lakhs/crores): ₹1,23,45,678 |
| USD | $ | Western grouping: $12,345,678 |
| EUR | € | Western grouping: €12,345,678 |
| GBP | £ | Western grouping: £12,345,678 |

---

## 4. Automatic Spending Categorization

12 spending categories with color-coded icons, auto-assigned via keyword matching:

| Category | Color | Example Merchants |
|----------|-------|-------------------|
| Food & Dining | #FF6B6B | Swiggy, Zomato, Starbucks, McDonald's, DoorDash, Deliveroo |
| Groceries | #4ADE80 | BigBasket, Blinkit, Zepto, Walmart, Tesco, Sainsbury's |
| Shopping | #60A5FA | Amazon, Flipkart, Myntra, Target, Zara, ASOS |
| Transportation | #34D399 | Uber, Ola, Shell, IRCTC, FastTag, TfL Oyster |
| Entertainment | #A78BFA | Netflix, Spotify, Disney+, Hotstar, Steam, Sky TV |
| Health & Medical | #FFB547 | Apollo, CVS, Planet Fitness, Boots, PharmEasy |
| Utilities & Bills | #F472B6 | Jio, Airtel, Comcast, British Gas, Duke Energy |
| Travel | #22D3EE | MakeMyTrip, Booking.com, Emirates, Marriott, EasyJet |
| Education | #818CF8 | Udemy, Coursera, Byju's, Kindle, Open University |
| Finance & Investment | #FBBF24 | Zerodha, Groww, Robinhood, Vanguard, Trading 212 |
| Transfers | #94A3B8 | UPI, NEFT, Google Pay, Venmo, Wise, Revolut |
| Other | #6B7280 | Uncategorized transactions |

---

## 5. Multi-Card Management

- **Auto-detection**: When a statement is uploaded, Vector detects the card (last 4, network, issuer, currency) and either matches an existing card or prompts to create a new one.
- **Editable card profiles**: Nickname, last 4 digits, issuer, network, credit limit, billing cycle, color, currency.
- **Live card preview**: Visual credit card component updates in real-time while editing.
- **Color-coded cards**: Each card gets a distinct color for visual identification across the app.
- **Saved PDF passwords**: Optionally save the password for encrypted PDFs so future uploads auto-unlock.
- **Per-card analytics**: Spending breakdown, utilization, trend sparklines — all scoped per card.
- **Card deletion**: Cascading delete removes the card and all associated statements, transactions, and data.

---

## 6. Dashboard & Home Screen

- **Total Amount Due / Outstanding**: Aggregated across all cards with per-card breakdown.
- **Minimum amount due** with warning indicators.
- **Payment due dates** per card.
- **Credit utilization gauge**: Color-coded progress bar (green <30%, orange 30–60%, red >60%) with threshold markers.
- **Multi-currency utilization**: Separate bars when cards span different currencies.
- **Card carousel**: Horizontal scrollable cards, tap to switch active card.
- **Monthly usage summary**: Total debits, credit limit, utilization per card.
- **Recent statements**: Last 5 statements across all cards with period, net amount, and transaction count.
- **Empty state CTAs**: "Add Your First Card" and "Try Demo Mode" for new users.

---

## 7. Transaction Management

### Statement Transactions
- Parsed from uploaded PDFs.
- Viewable in the Analysis screen with search, category filters, and sorting.
- Can be **imported to "My Transactions"** for unified tracking across manual + statement data.

### Manual Transactions
- Add transactions manually with: description, amount, date, card assignment, debit/credit toggle.
- **Live AI categorization**: As you type the description, the category updates in real-time.
- Category hint system: If categorized as "Other", suggests example keywords to trigger better categorization.
- Notes field for additional context.

### Transaction Detail & Enrichment
- **Flag/star** important transactions.
- **Add notes** (free-form text, auto-saved).
- **Attach receipt photos** — capture from camera or pick from gallery. Stored locally.
- **Edit** any field: description, amount, date, category, type.
- **Delete** with confirmation.
- **Navigate between transactions** with previous/next arrows.

### Filtering & Search
- **Text search** across description and category.
- **Category filter** chips (single-select).
- **Card filter** chips (when multiple cards exist).
- **Enrichment filters**: Starred, Has Notes, Has Receipt.
- **Month selector** with year-grouped dropdown and left/right navigation.
- **Sort toggle**: By Date (newest first) or By Amount (largest first).
- **Monthly subtotals**: Debits and credits per currency for the selected month.

---

## 8. Statement Analysis

Deep dive into any uploaded statement:

### Overview Tab
- **Payment Due card**: Total amount due (hero size), minimum due, payment due date — all inline-editable.
- **Statement Summary**: Net spending, total debits, total credits, transaction count.
- **Statement period**: From/to dates, editable.
- **Largest transaction**: Highlighted with category badge.
- **Action buttons**: "Add to My Transactions" (import) and "Export CSV".

### Transactions Tab
- Full transaction list with search, category filter, and sort controls.
- Same enrichment capabilities as main transactions (flag, notes, receipt).

### Categories Tab
- **Pie chart**: Spending distribution across categories.
- **Bar chart**: Category comparison.
- **Category list**: Each category with amount, progress bar (proportional to total), count, and percentage.

---

## 9. Analytics & Charts

- **Category Pie Chart**: Spending distribution visualization.
- **Category Bar Chart**: Side-by-side category comparison.
- **Spend Comparison Chart**: Multi-card spending comparison by month.
- **Category by Card Chart**: Stacked/grouped category breakdown per card.
- **Spending Sparklines**: Monthly spending trend line per card.
- **Daily Spending Chart**: Bar chart of spending by day within a month.
- **Credit Utilization Progress Bars**: Per-card and aggregate, color-coded by threshold.

---

## 10. CSV Export

- Export any statement's transactions as a CSV file.
- Columns: date, description, amount, category, type, transaction_type.
- Shared via the native OS share sheet (AirDrop, Files, email, etc.).

---

## 11. Encrypted Backup & Restore

- **Export**: Creates a password-encrypted JSON backup of all data (cards, statements, transactions, enrichments).
  - Password strength indicator.
  - Minimum 6 character password.
  - Shared via native share sheet.
- **Import**: Pick a backup file, enter decryption password, preview contents before restoring.
  - Shows count of cards, statements, transactions, enrichments in the backup.
  - Full data replacement with confirmation ("Replace All Data?").
- **Current data summary**: Shows counts of all data on device before backup/restore.

---

## 12. Encrypted PDF Support

- Auto-detects password-protected PDFs.
- Prompts for password with a dedicated modal (lock icon, secure text input).
- **Save password option**: Checkbox to remember password for future uploads of the same card's statements.
- **Auto-retry**: If a card has a saved password, Vector tries it automatically before prompting.
- Clears saved password if it becomes invalid.

---

## 13. Demo Mode

- **Try before you upload**: One-tap demo loads a realistic statement with 24 transactions across all 12 categories.
- No file upload required.
- Full functionality available: analyze, import, export CSV.
- Demo card: Visa ending 4321, ₹200,000 credit limit, ₹42,759 due.
- Duplicate-protected: Demo can't be loaded twice.

---

## 14. Premium (Pro) Tier

- **Free tier**: 3 PDF uploads per month (resets monthly).
- **Pro tier**: Unlimited uploads.
- Visual usage indicator on Upload screen (progress bar showing remaining uploads).
- "Upgrade to Pro" buttons in Profile and Upload screens.
- RevenueCat-powered subscription management.
- PRO badge displayed in Profile when subscribed.

---

## 15. Regex Fallback Parsing

When AI models are unavailable, Vector falls back to bank-specific regex parsers:
- Dedicated parsers for HDFC, ICICI, SBI, Axis, Chase, Amex, Citi.
- Generic multi-pattern parser that tries 4 regex variants for unknown bank formats.
- Handles multiple date formats (DD/MM/YYYY, DD-Mon-YYYY, MM/DD/YY, etc.).
- Keyword-based transaction type inference with multi-language support.

---

## 16. Transaction Types

Every transaction is classified into one of 11 types:

| Type | Description |
|------|-------------|
| Purchase | Regular spending |
| Payment | Bill payment, CC payment, UPI/NEFT/IMPS credit |
| Refund | Merchant refunds |
| Reversal | Dispute credits, chargebacks, GST reversals |
| Cashback | Rewards, promotional credits, sign-up bonuses |
| EMI | Installment debits, loan conversions |
| Fee | Annual fee, late payment, processing fee, forex fee |
| Tax | GST, service tax, VAT |
| Interest | Finance charges |
| Adjustment | Corrections, write-offs |
| Transfer | Fund transfers, balance transfers |

Multi-language keyword detection: English, Hindi, Spanish, French, German, Italian, Japanese, Arabic.

---

## 17. Design & UX

- **Dark theme only**: Background #0A0E1A, accent #00E5A0 (teal/green).
- **Consistent design system**: Predefined spacing, border radius, typography scales.
- **Bottom tab navigation**: Home, Transactions, Upload (center), Cards, Profile.
- **Modal stack**: Analysis, Add Transaction, Backup, Card List, Edit Card — all slide-up modals.
- **Empty states**: Contextual illustrations and CTAs for every empty screen.
- **Keyboard-aware forms**: Proper keyboard avoidance, return key chaining, auto-focus.

---

## 18. Observability & Reliability

- **LangSmith tracing**: Full LLM call trees for debugging parsing issues.
- **Dashboard persistence**: Optional SQLite dashboard stores parsed results and LLM call traces.
- **Structured logging**: JSON log format for production aggregation.
- **PostHog analytics**: Screen capture, upload events, import tracking, export tracking.
- **Rate limiting**: Redis-backed per-IP sliding window (configurable requests/window).
- **Health endpoint**: `/health` returns status, LLM availability, and consensus capability.

---

## 19. Technical Highlights

| Capability | Detail |
|------------|--------|
| **Parsing pipeline** | LangGraph state machine with 6 sequential nodes |
| **Max PDF size** | 10 MB (configurable) |
| **Parsing timeout** | 45 seconds per LLM call |
| **Text extraction** | pdfplumber with pypdf fallback, handles scanned PDF detection |
| **Duplicate detection** | SHA256 file hashing prevents re-parsing the same PDF |
| **Atomic writes** | Statement + transactions inserted in a single SQLite transaction |
| **Migration system** | Versioned schema migrations, append-only, never destructive |
| **State management** | Write-through: SQLite (source of truth) → Zustand (in-memory cache) |
| **Offline capable** | All data and features work without internet after initial parse |
| **Platform** | Expo SDK 51 (React Native 0.74), FastAPI backend |

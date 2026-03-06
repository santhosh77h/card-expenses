# 📋 Cardlytics — GTM README
> **Use this file with Claude to build, extend, ship, and market Cardlytics.**
> Share this document at the start of any Claude session for full context.

---

## 1. What Is Cardlytics?

**Cardlytics** is a privacy-first, cross-platform expense tracker that parses credit card PDF statements, assigns AI-powered spending categories, visualizes transactions, and exports data as CSV — all without storing any user financial data on the server.

| Dimension | Detail |
|---|---|
| **Product type** | Mobile app (React Native) + Python API |
| **Core promise** | "Your statement. Your data. Your device." |
| **Key differentiator** | Zero financial data storage — PDF parsed in memory, discarded immediately |
| **Primary user** | Urban professionals, 25–40, managing 2–4 credit cards |
| **Monetization** | Freemium: free core + Pro ($2.99/mo) for multi-card history, export, insights |
| **Stage** | MVP complete. Pre-launch. |

---

## 2. The Problem We Solve

Most expense trackers either:
- Require bank login/open banking (scary for privacy-conscious users), or
- Require manual transaction entry (too tedious)

**The gap:** No app lets you drop a PDF statement and instantly see clean, categorized spending analytics — with zero data leaving your device.

### User Pain Points (validated)
1. "I don't trust apps with my bank login"
2. "I get my credit card PDF every month but never actually read it"
3. "I have 3 cards and no idea how much I've spent total this month"
4. "I want to know which category I overspend in"

---

## 3. Core Features (MVP)

### 🏠 Dashboard
- Portfolio view: total outstanding balance across all cards
- Credit utilization bar with 30% / 60% / 100% threshold markers
- Per-card compact carousel with selection
- Statement history per card

### 📄 Statement Upload
- Native PDF file picker
- Animated upload + parse progress
- **Demo mode** — fully functional without a real PDF
- Privacy-first messaging throughout

### 📊 Analysis (3-tab view)
| Tab | Contents |
|---|---|
| Overview | Net spend, total debits, credits/refunds, largest transaction, AI spending insight |
| Transactions | Full list, filterable by category, sortable by date or amount |
| Categories | Interactive pie chart + horizontal legend + bar chart (top 5) |

### ➕ Card Management
- Add/remove credit cards (metadata only — no PAN)
- Fields: nickname, last 4 digits, issuer, network, credit limit, billing cycle
- Live card visual preview with gradient + network logo

### 📤 CSV Export
- One-tap export to native share sheet
- Fields: date, description, amount, category, type

---

## 4. Tech Stack

### Mobile (React Native + Expo)
```
Framework:       React Native (Expo SDK 51)
State:           Zustand (device-local only)
Local storage:   Zustand + MMKV (production)
Charts:          Victory Native (pie + bar)
Navigation:      React Navigation v6
HTTP:            Axios
```

### Backend (Python)
```
Framework:       FastAPI
PDF parsing:     pdfplumber (primary) → PyPDF2 (fallback)
Categorization:  Rule-based keyword matching (12 categories)
Hosting:         Docker container (stateless)
Database:        NONE — zero persistence by design
```

### Privacy Architecture
```
PDF bytes      → parsed in-memory → never written to disk
Transactions   → returned to mobile → never stored server-side
Card details   → device-only (Zustand + MMKV)
CSV exports    → generated client-side, saved to device
Server logs    → no financial data logged
```

---

## 5. Project File Structure

```
cardlytics/
├── README.md                          ← this file
├── backend/
│   ├── main.py                        ← FastAPI routes (/parse-statement/json)
│   ├── parser.py                      ← PDF → transactions (7 bank formats)
│   ├── categorizer.py                 ← 12-category keyword engine
│   ├── requirements.txt
│   └── Dockerfile
└── mobile/
    ├── App.tsx                        ← Entry point
    ├── app.json                       ← Expo config
    ├── package.json
    └── src/
        ├── theme.ts                   ← Design system (colors, typography, spacing)
        ├── store/index.ts             ← Zustand global state
        ├── utils/api.ts               ← API client + parseDemoStatement()
        ├── navigation/index.tsx       ← React Navigation stack + tab navigator
        ├── components/
        │   ├── ui.tsx                 ← Shared components (Card, StatRow, Badge, etc.)
        │   ├── CreditCardView.tsx     ← Visual card (full + compact modes)
        │   └── CategoryChart.tsx      ← Pie chart + legend + bar chart
        └── screens/
            ├── HomeScreen.tsx         ← Dashboard
            ├── UploadScreen.tsx       ← PDF upload + parsing flow
            ├── AnalysisScreen.tsx     ← 3-tab insights screen
            └── AddCardScreen.tsx      ← Add/manage cards
```

---

## 6. Supported Banks & Formats

| Bank | Country | Format | Parser Status |
|---|---|---|---|
| HDFC Bank | India | PDF (text) | ✅ Specific parser |
| ICICI Bank | India | PDF (text) | ✅ Specific parser |
| SBI Card | India | PDF (text) | ✅ Specific parser |
| Axis Bank | India | PDF (text) | ✅ Specific parser |
| Chase | USA | PDF (text) | ✅ Specific parser |
| American Express | USA/Global | PDF (text) | ✅ Specific parser |
| Citi Bank | USA/Global | PDF (text) | ✅ Specific parser |
| Any text-based PDF | Any | PDF (text) | ✅ Generic parser |
| Scanned / image PDF | Any | PDF (image) | 🔄 Planned (OCR) |
| OFX / QFX files | Any | Structured | 🔄 Planned |
| CSV import | Any | Structured | 🔄 Planned |

---

## 7. Spending Categories

| Category | Icon | Hex Color | Example Keywords |
|---|---|---|---|
| Food & Dining | 🍽️ | `#FF6B6B` | Swiggy, Zomato, Starbucks, restaurant |
| Shopping | 🛍️ | `#60A5FA` | Amazon, Myntra, Flipkart, mall |
| Transportation | 🚗 | `#34D399` | Uber, Ola, IRCTC, petrol, Rapido |
| Entertainment | 🎬 | `#A78BFA` | Netflix, Spotify, BookMyShow, cinema |
| Health & Medical | 🏥 | `#FFB547` | Apollo, pharmacy, hospital, Cult.fit |
| Utilities & Bills | ⚡ | `#F472B6` | Jio, Airtel, electricity, rent, EMI |
| Travel | ✈️ | `#22D3EE` | Hotel, OYO, MakeMyTrip, airline |
| Groceries | 🛒 | `#4ADE80` | BigBasket, Blinkit, DMart, Zepto |
| Education | 📚 | `#818CF8` | Udemy, Coursera, BYJU's, school fee |
| Finance & Investment | 💰 | `#FBBF24` | Groww, Zerodha, SIP, mutual fund |
| Transfers | 🔄 | `#94A3B8` | UPI, NEFT, IMPS, Google Pay |
| Other | 📋 | `#6B7280` | Anything not matched |

---

## 8. Design System

**Aesthetic:** Dark luxury fintech — Bloomberg Terminal meets modern consumer finance

| Token | Value | Usage |
|---|---|---|
| Background | `#0A0E1A` | App background |
| Surface | `#111827` | Cards, modals |
| Surface Elevated | `#1C2333` | Nested cards |
| Accent | `#00E5A0` | CTAs, selected states, highlights |
| Debit Color | `#FF5C5C` | Expense amounts |
| Credit Color | `#00E5A0` | Refunds, credits |
| Warning | `#FFB547` | 30–60% utilization |
| Primary Font | Syne (800 display) | Headlines, amounts |
| Mono Font | DM Mono | Dates, card numbers, labels |

**Key design principles:**
- Never use color alone to convey meaning (accessibility)
- 44×44px minimum touch targets
- Offline-first: UI always reads from local state, syncs in background
- Dark mode only (financial apps, not lifestyle)

---

## 9. API Reference

### `POST /parse-statement/json`

**Request:** `multipart/form-data`, field: `file` (PDF, max 10 MB)

**Response:**
```json
{
  "transactions": [
    {
      "date": "2024-01-15",
      "description": "Swiggy Order #98234",
      "amount": 450.00,
      "category": "Food & Dining",
      "category_color": "#FF6B6B",
      "category_icon": "🍽️",
      "type": "debit"
    }
  ],
  "summary": {
    "total_transactions": 24,
    "total_debits": 28450.00,
    "total_credits": 830.00,
    "net": 27620.00,
    "categories": {
      "Food & Dining": { "total": 4580.00, "count": 7 }
    },
    "statement_period": { "from": "2024-01-01", "to": "2024-01-31" }
  },
  "csv": "date,description,amount,category,type\n..."
}
```

### `GET /health`
Returns `{ "status": "ok", "privacy": "no-data-stored" }`

---

## 10. Target User & ICP

### Primary ICP
- **Who:** Urban Indian professional, 28–38 years old
- **Cards:** 2–4 credit cards (HDFC, ICICI, Axis, Amex)
- **Pain:** Gets monthly PDF statements, ignores them, overspends
- **Tech comfort:** Uses UPI daily, comfortable with finance apps
- **Privacy stance:** Skeptical of apps with bank login

### Secondary ICP
- US/global users with Chase, Amex, Citi statements
- Small business owners tracking business card expenses
- Personal finance enthusiasts who want CSV exports for budgeting in Excel/Sheets

### Anti-ICP (not our user)
- Users who want full bank account sync (use Mint/YNAB)
- Users who don't have or use credit cards
- Enterprise / company expense management

---

## 11. Competitive Landscape

| App | CC Tracking | Statement Import | Privacy | Free Tier | Platform |
|---|---|---|---|---|---|
| **Cardlytics** | ✅ Full | ✅ PDF parse | ✅ Zero storage | ✅ Core free | iOS + Android + Web |
| Cashew | ❌ None | ❌ None | ✅ Local-first | ✅ Full free | Android + iOS |
| YNAB | ⚠️ Basic | ❌ None | ❌ Cloud stored | ❌ $109/yr | All |
| Wallet (BudgetBakers) | ⚠️ Limit only | ❌ None | ❌ Cloud stored | ⚠️ Limited | All |
| Spendee | ❌ None | ❌ None | ❌ Cloud stored | ⚠️ Limited | All |
| Monarch Money | ❌ None | ❌ None | ❌ Cloud stored | ❌ $99/yr | All |

**Our moat:** PDF statement parsing + zero server storage + credit utilization — no competitor has all three.

---

## 12. Monetization

### Free Tier (always free)
- Upload and parse 1 statement per card per month
- Up to 2 cards
- Full category analysis
- CSV export

### Pro Tier — $2.99/month or $24.99/year
- Unlimited statements + card history
- Multi-statement trend charts (3-month, 6-month)
- Advanced category insights + budget targets
- Bill due date push reminders
- Custom category rules
- Multi-currency support

### Revenue projections (conservative)
| Month | MAU | Pro Conversion | MRR |
|---|---|---|---|
| 3 | 500 | 3% | $45 |
| 6 | 2,000 | 5% | $300 |
| 12 | 8,000 | 7% | $1,680 |
| 18 | 20,000 | 8% | $4,800 |

---

## 13. Launch Checklist

### Pre-launch (technical)
- [ ] Backend deployed to Railway / Fly.io / AWS Lambda
- [ ] Domain + SSL configured
- [ ] API URL updated in `src/utils/api.ts`
- [ ] Expo EAS Build configured for production
- [ ] App Store Connect account created (Apple)
- [ ] Google Play Console account created (Android)
- [ ] Privacy policy published (required by both stores)
- [ ] App icons + splash screen assets created (1024×1024 PNG)

### Pre-launch (product)
- [ ] Demo mode tested end-to-end
- [ ] 10 real PDF statements tested across banks
- [ ] Error states handled (scanned PDFs, password-protected PDFs)
- [ ] Onboarding flow with value prop messaging
- [ ] Empty state screens (no cards, no statements)

### Launch channels
- [ ] Product Hunt submission
- [ ] r/personalfinance, r/IndiaInvestments, r/CreditCards
- [ ] LinkedIn post (personal finance professionals)
- [ ] Twitter/X thread: "I built a credit card analyzer that never stores your data"
- [ ] IndieHackers launch post

---

## 14. Roadmap

### Phase 2 (Month 1–2 post-launch)
- Multi-month trend charts (spending over 3–6 months)
- Bill due date reminders (push notifications)
- Credit utilization history tracking
- OFX / QFX file import
- Biometric app lock

### Phase 3 (Month 3–4)
- Spending budget targets per category
- AI-powered insights ("You spend 40% more on food on weekends")
- OCR for scanned PDF statements (Google ML Kit)
- Password-protected PDF support
- iCloud / Google Drive encrypted backup

### Phase 4 (Month 5–6)
- Optional Plaid integration (US market, opt-in)
- Multi-currency + exchange rate support
- Home screen widgets (iOS/Android)
- Payment optimization recommendations
- CSV / Google Sheets two-way sync

---

## 15. Known Limitations (MVP)

| Limitation | Impact | Fix in Phase |
|---|---|---|
| Scanned PDFs not supported | Users with image-based statements get empty parse | Phase 3 |
| Password-protected PDFs fail | Common for some Indian banks | Phase 3 |
| No persistent storage on backend | Cannot sync across devices | By design — use iCloud/Drive backup in Phase 3 |
| Categories are rule-based (no ML) | ~85% accuracy, misses niche merchants | Phase 3 (on-device ML) |
| Single user (no household) | Couples can't share view | Phase 5 |
| No recurring transaction detection | Can't auto-flag subscriptions | Phase 2 |

---

## 16. How to Use This File With Claude

Copy and paste this entire README into a Claude conversation to:

### Build new features
> *"Using the Cardlytics README context, build a multi-month trend chart screen that shows spending per category over the last 3 statement periods."*

### Fix bugs
> *"Using the Cardlytics README context, the PDF parser is not detecting transactions for Kotak Bank statements. Add a Kotak-specific parser to parser.py."*

### Write marketing copy
> *"Using the Cardlytics README context, write a Product Hunt launch post, tagline, and 3 bullet points that emphasize privacy and ease of use."*

### Add a new screen
> *"Using the Cardlytics README context, create a BudgetScreen.tsx that lets users set monthly budget limits per category and shows progress bars."*

### Write the privacy policy
> *"Using the Cardlytics README context, write a privacy policy suitable for App Store submission."*

### Generate test data
> *"Using the Cardlytics README context, generate 50 realistic test transactions that cover all 12 categories for an HDFC Regalia statement."*

### Extend the categorizer
> *"Using the Cardlytics README context, add 20 more keywords to the Groceries and Food & Dining categories in categorizer.py, focused on Indian D2C brands."*

---

## 17. Environment Variables

```bash
# Backend (.env)
PORT=8000
MAX_PDF_SIZE_MB=10
LOG_LEVEL=INFO
# No database URL — intentional

# Mobile (app.config.js or .env)
EXPO_PUBLIC_API_URL=https://api.cardlytics.app
EXPO_PUBLIC_API_URL_DEV=http://localhost:8000
```

---

## 18. Running Locally

```bash
# 1. Start backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. Start mobile app (new terminal)
cd mobile
npm install
npx expo start

# Press i → iOS Simulator
# Press a → Android Emulator
# Press w → Web browser

# For physical device: update EXPO_PUBLIC_API_URL_DEV to your machine's local IP
```

---

## 19. Deployment

### Backend (Railway — recommended for MVP)
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
# Copy the generated URL → update mobile app's API_URL
```

### Backend (Docker / any VPS)
```bash
cd backend
docker build -t cardlytics-api .
docker run -p 8000:8000 cardlytics-api
```

### Mobile (Expo EAS Build)
```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all --profile production
```

---

## 20. Contact & Repository

| | |
|---|---|
| **Project name** | Cardlytics |
| **Version** | 1.0.0 (MVP) |
| **License** | MIT |
| **Primary language** | TypeScript (mobile), Python (backend) |
| **Target stores** | Apple App Store, Google Play Store |
| **Web demo** | cardlytics-mvp.html (single-file, shareable) |

---

*Last updated: MVP completion. Share this file at the start of any Claude session to provide full product context.*

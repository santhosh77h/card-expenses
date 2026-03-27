export const SITE = {
  name: "Vector Expense",
  tagline: "Your Money. Directed.",
  description:
    "Privacy-first credit card statement parser. Upload a PDF, get instant spending insights. Your PII is never saved on our servers.",
  url: "https://vectorexpense.com",
};

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Blog", href: "/blog" },
];

export const FEATURES = [
  {
    title: "AI-Powered Statement Parsing",
    description:
      "Upload any bank's credit card statement PDF and let our 3-model AI consensus engine extract every transaction automatically. GPT-4o-mini, Claude, and Gemini parse in parallel with majority voting for near-perfect accuracy.",
    icon: "brain",
  },
  {
    title: "Privacy-First Design",
    description:
      "Zero data retention. Your credit card statements are processed entirely in-memory and immediately discarded. All financial data stays encrypted on your device -no accounts, no cloud sync, no tracking.",
    icon: "shield",
  },
  {
    title: "Smart Expense Categorization",
    description:
      "12 spending categories auto-assigned using AI and keyword matching. Food, groceries, shopping, transport, entertainment, health, utilities, travel, education, finance, transfers -all detected across multiple languages.",
    icon: "tags",
  },
  {
    title: "Multi-Currency Support",
    description:
      "Track expenses in INR (₹), USD ($), EUR (€), and GBP (£) with locale-specific formatting. Works with any bank that issues a PDF statement -if they print it, Vector reads it.",
    icon: "globe",
  },
  {
    title: "Multi-Card Management",
    description:
      "Manage all your credit cards in one place. Auto-detect card details from statements, color-coded profiles, per-card spending analytics, utilization tracking, and trend sparklines.",
    icon: "credit-card",
  },
  {
    title: "Offline & Encrypted Storage",
    description:
      "All transaction data stored locally in AES-encrypted SQLite. Browse transactions, view analytics, and export reports without internet after initial parse. Password-protected backups for data portability.",
    icon: "lock",
  },
  {
    title: "Demo Mode",
    description:
      "Try Vector Expense before uploading a single document. Explore 24 realistic transactions across all 12 spending categories with one tap -full analytics, CSV export, and category breakdowns included.",
    icon: "play-circle",
  },
  {
    title: "Manual Transaction Entry",
    description:
      "Add expenses manually with live AI categorization as you type. Attach receipt photos, add notes, flag important transactions, and track spending alongside your parsed statements.",
    icon: "pen-line",
  },
];

export const BENEFITS = [
  {
    title: "Save hours on expense tracking",
    description:
      "Upload a PDF statement and get a full spending breakdown in seconds. No manual data entry.",
  },
  {
    title: "Eliminate categorization errors",
    description:
      "Our 3-model AI consensus engine cross-validates every transaction, achieving near-perfect accuracy.",
  },
  {
    title: "Track spending across all cards",
    description:
      "Manage multiple credit cards with per-card analytics, utilization tracking, and trend sparklines.",
  },
  {
    title: "Export and backup with confidence",
    description:
      "CSV export for any statement. Encrypted backups with AES encryption for total data portability.",
  },
];

export const CATEGORIES = [
  { name: "Food & Dining", color: "#FF6B6B", icon: "utensils" },
  { name: "Groceries", color: "#4ADE80", icon: "shopping-cart" },
  { name: "Shopping", color: "#60A5FA", icon: "shopping-bag" },
  { name: "Transportation", color: "#34D399", icon: "car" },
  { name: "Entertainment", color: "#A78BFA", icon: "film" },
  { name: "Health & Medical", color: "#FFB547", icon: "heart" },
  { name: "Utilities & Bills", color: "#F472B6", icon: "zap" },
  { name: "Travel", color: "#22D3EE", icon: "plane" },
  { name: "Education", color: "#818CF8", icon: "book" },
  { name: "Finance & Investment", color: "#FBBF24", icon: "trending-up" },
  { name: "Transfers", color: "#94A3B8", icon: "repeat" },
  { name: "Other", color: "#6B7280", icon: "more-horizontal" },
];

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Upload",
    description:
      "Take a photo or select your credit card statement PDF. Encrypted PDFs are auto-detected.",
    icon: "upload",
  },
  {
    step: 2,
    title: "Parse",
    description:
      "Our 3-model AI consensus engine extracts every transaction and categorizes spending automatically.",
    icon: "cpu",
  },
  {
    step: 3,
    title: "Insights",
    description:
      "Get instant spending breakdowns, category charts, and exportable CSV reports - all stored locally.",
    icon: "bar-chart",
  },
];

export const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "Freelance Designer",
    quote:
      "Vector Expense has completely changed how I track my business expenses. I just upload my HDFC statement and everything is categorized instantly.",
    avatar: "PS",
  },
  {
    name: "James Mitchell",
    role: "Software Engineer",
    quote:
      "The privacy-first approach is what sold me. No account needed, no data stored on servers. Exactly how finance apps should work.",
    avatar: "JM",
  },
  {
    name: "Ananya Patel",
    role: "Small Business Owner",
    quote:
      "Managing 4 credit cards used to be a nightmare. Vector Expense auto-detects each card and gives me per-card analytics. Incredible.",
    avatar: "AP",
  },
  {
    name: "David Chen",
    role: "Product Manager",
    quote:
      "The AI parsing accuracy is impressive. 3 models voting on each transaction means I rarely need to correct anything.",
    avatar: "DC",
  },
  {
    name: "Sarah Williams",
    role: "Marketing Director",
    quote:
      "I love that it works with my Barclays and Amex statements. The multi-currency support is perfect for my travel expenses.",
    avatar: "SW",
  },
  {
    name: "Rahul Verma",
    role: "CA / Accountant",
    quote:
      "The CSV export feature saves me hours during tax season. Upload statement, export transactions, done.",
    avatar: "RV",
  },
  {
    name: "Emily Foster",
    role: "Graduate Student",
    quote:
      "Free tier with 3 uploads per month is more than enough for me. Best budgeting tool I've found that doesn't want all my data.",
    avatar: "EF",
  },
  {
    name: "Vikram Singh",
    role: "Startup Founder",
    quote:
      "Finally an app that handles Indian number formatting correctly. ₹1,23,456 instead of ₹123,456. It's the details that matter.",
    avatar: "VS",
  },
  {
    name: "Lisa Park",
    role: "UX Researcher",
    quote:
      "The demo mode let me try everything before uploading a single document. Smart onboarding.",
    avatar: "LP",
  },
  {
    name: "Arjun Nair",
    role: "Data Analyst",
    quote:
      "Works with my ICICI, SBI, and Axis statements flawlessly. The category breakdown charts are beautiful.",
    avatar: "AN",
  },
  {
    name: "Michael Torres",
    role: "Consultant",
    quote:
      "I travel between US and UK for work. Vector Expense handles both Chase and HSBC statements with correct currency formatting.",
    avatar: "MT",
  },
  {
    name: "Neha Gupta",
    role: "Doctor",
    quote:
      "The encrypted backup feature gives me peace of mind. All my financial data is password-protected and stays on my phone.",
    avatar: "NG",
  },
];

export const PRICING = [
  {
    name: "Monthly",
    price: "$3",
    period: "per month",
    description: "Flexible month-to-month plan",
    features: [
      "4 statement parses per month",
      "3-model AI consensus engine",
      "12 spending categories",
      "Multi-card management",
      "CSV export & encrypted backups",
      "Offline access after parse",
    ],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Yearly",
    price: "$24",
    period: "per year",
    description: "Best value -save 33% vs monthly",
    features: [
      "4 statement parses per month",
      "3-model AI consensus engine",
      "12 spending categories",
      "Multi-card management",
      "CSV export & encrypted backups",
      "Offline access after parse",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
];

export const BANKS = {
  india: [
    "HDFC", "ICICI", "SBI", "Axis", "Kotak", "Yes Bank", "IndusInd",
    "RBL", "Federal", "IDFC First", "AU Bank", "Bank of Baroda", "Canara", "PNB",
  ],
  us: [
    "Chase", "Citi", "Bank of America", "Wells Fargo", "Capital One",
    "Discover", "US Bank", "Synchrony", "PNC", "TD Bank", "USAA", "Barclays US",
  ],
  uk: [
    "Barclays", "HSBC", "NatWest", "Lloyds", "Santander", "Halifax",
    "Nationwide", "Virgin Money", "Tesco Bank", "M&S Bank", "Monzo", "Starling",
    "John Lewis", "Metro Bank",
  ],
  global: ["American Express", "HSBC"],
};

export const ALL_BANKS = [
  ...BANKS.india, ...BANKS.us, ...BANKS.uk, ...BANKS.global,
];

export const FAQ_DATA = [
  {
    question: "How does the AI parsing work?",
    answer:
      "Vector Expense uses a 3-model consensus engine - GPT-4o-mini, Claude 3.5 Haiku, and Gemini 2.0 Flash parse every statement in parallel. Fields are resolved by majority voting, eliminating hallucinations. Each transaction gets a confidence score.",
  },
  {
    question: "Is my financial data safe?",
    answer:
      "Absolutely. Vector Expense processes PDFs entirely in-memory - no financial data is ever written to disk on our servers. All your data is stored locally on your device in an encrypted SQLite database. No accounts, no cloud sync, no tracking.",
  },
  {
    question: "Can I integrate Vector Expense with other apps?",
    answer:
      "Vector Expense supports CSV export for any statement, which you can import into spreadsheets, accounting software, or other financial tools. Encrypted backups can be shared via your device's native share sheet.",
  },
  {
    question: "Which banks and currencies are supported?",
    answer:
      "Vector Expense works with any bank that issues a PDF statement -HDFC, Chase, Barclays, American Express, HSBC, and more. If they print it, Vector reads it. Currencies supported: INR (₹), USD ($), EUR (€), and GBP (£) with locale-specific formatting.",
  },
  {
    question: "Can I use Vector Expense offline?",
    answer:
      "Yes! After the initial statement parse (which requires internet for AI processing), all features work completely offline. Your data is stored locally, so you can browse transactions, view analytics, and export reports without internet.",
  },
  {
    question: "Does Vector Expense support password-protected PDFs?",
    answer:
      "Yes. Vector Expense auto-detects encrypted PDFs and prompts you for the password before parsing. You can optionally save the password for that card so future uploads from the same bank are unlocked automatically.",
  },
  {
    question: "Can I add transactions manually?",
    answer:
      "Absolutely. You can add expenses manually with live AI categorization as you type. Attach receipt photos, add notes, flag important transactions, and track manual entries alongside your parsed statements in a unified view.",
  },
];

export const APP_SHOWCASE_TABS = [
  { id: "home", label: "Home", image: "/screenshots/home.svg" },
  { id: "upload", label: "Upload", image: "/screenshots/upload.svg" },
  { id: "analysis", label: "Analysis", image: "/screenshots/analysis.svg" },
  { id: "categories", label: "Categories", image: "/screenshots/categories.svg" },
  { id: "transactions", label: "Transactions", image: "/screenshots/transactions.svg" },
];

import {
  BrainIcon,
  ShieldIcon,
  TagsIcon,
  GlobeIcon,
  CreditCardIcon,
  LockIcon,
  PlayCircleIcon,
  PenLineIcon,
} from "lucide-react";

export const BLUR_FADE_DELAY = 0.15;

export const siteConfig = {
  name: "Vector Expense",
  description: "Your Money. Directed.",
  cta: "Download App",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://vectorexpense.com",
  keywords: [
    "Credit Card Statement Parser",
    "Expense Tracker",
    "AI Finance",
    "Privacy First",
    "Spending Insights",
  ],
  links: {
    email: "support@vectorexpense.com",
    twitter: "https://x.com/Vector_Expense",
    instagram: "https://www.instagram.com/vector_expense/",
    linkedin: "https://www.linkedin.com/company/vector-expense",
  },
  features: [
    {
      name: "AI-Powered Statement Parsing",
      description:
        "Upload any bank's credit card statement PDF and let our 3-model AI consensus engine extract every transaction automatically. GPT-4o-mini, Claude, and Gemini parse in parallel with majority voting for near-perfect accuracy.",
      icon: <BrainIcon className="h-6 w-6" />,
    },
    {
      name: "Privacy-First Design",
      description:
        "Zero data retention. Your credit card statements are processed entirely in-memory and immediately discarded. All financial data stays encrypted on your device — no accounts, no cloud sync, no tracking.",
      icon: <ShieldIcon className="h-6 w-6" />,
    },
    {
      name: "Smart Expense Categorization",
      description:
        "12 spending categories auto-assigned using AI and keyword matching. Food, groceries, shopping, transport, entertainment, health, utilities, travel, education, finance, transfers — all detected across multiple languages.",
      icon: <TagsIcon className="h-6 w-6" />,
    },
    {
      name: "Multi-Currency Support",
      description:
        "Track expenses in INR (₹), USD ($), EUR (€), and GBP (£) with locale-specific formatting. Supports 40+ banks across India, US, and UK including HDFC, Chase, Barclays, and American Express.",
      icon: <GlobeIcon className="h-6 w-6" />,
    },
    {
      name: "Multi-Card Management",
      description:
        "Manage all your credit cards in one place. Auto-detect card details from statements, color-coded profiles, per-card spending analytics, utilization tracking, and trend sparklines.",
      icon: <CreditCardIcon className="h-6 w-6" />,
    },
    {
      name: "Offline & Encrypted Storage",
      description:
        "All transaction data stored locally in AES-encrypted SQLite. Browse transactions, view analytics, and export reports without internet after initial parse. Password-protected backups for data portability.",
      icon: <LockIcon className="h-6 w-6" />,
    },
    {
      name: "Demo Mode",
      description:
        "Try Vector Expense before uploading a single document. Explore 24 realistic transactions across all 12 spending categories with one tap — full analytics, CSV export, and category breakdowns included.",
      icon: <PlayCircleIcon className="h-6 w-6" />,
    },
    {
      name: "Manual Transaction Entry",
      description:
        "Add expenses manually with live AI categorization as you type. Attach receipt photos, add notes, flag important transactions, and track spending alongside your parsed statements.",
      icon: <PenLineIcon className="h-6 w-6" />,
    },
  ],
  featureHighlight: [
    {
      title: "AI-Powered Parsing",
      description:
        "3-model consensus engine cross-validates every transaction for near-perfect accuracy.",
      imageSrc: "/screenshots/upload.svg",
      direction: "rtl" as const,
      previewId: "upload-screen",
    },
    {
      title: "Smart Categories",
      description:
        "12 spending categories auto-assigned via AI and keyword matching across multiple languages.",
      imageSrc: "/screenshots/categories.svg",
      direction: "ltr" as const,
      previewId: "categories-screen",
    },
    {
      title: "Detailed Analytics",
      description:
        "Get instant spending breakdowns, category charts, and exportable CSV reports.",
      imageSrc: "/screenshots/analysis.svg",
      direction: "rtl" as const,
      previewId: "card-analytics",
    },
  ],
  bento: [
    {
      title: "AI-Powered Parsing",
      content:
        "Our 3-model consensus engine uses GPT-4o-mini, Claude, and Gemini to parse every statement in parallel. A document intelligence pre-parse probe detects layout, currency, and bank before extraction — fields are resolved by majority voting for near-perfect accuracy.",
      imageSrc: "/screenshots/home.svg",
      imageAlt: "Vector Expense home screen",
      fullWidth: true,
    },
    {
      title: "Smart Categorization",
      content:
        "12 spending categories are auto-assigned using AI and keyword matching. Each transaction gets a confidence score.",
      imageSrc: "/screenshots/categories.svg",
      imageAlt: "Category breakdown",
      fullWidth: false,
    },
    {
      title: "Transaction Details",
      content:
        "Browse every transaction with merchant names, amounts, dates, and categories. Supports 11 transaction types — purchase, payment, refund, EMI, fee, interest, cashback, reward, reversal, adjustment, and transfer. Flag, annotate, and attach receipts.",
      imageSrc: "/screenshots/transactions.svg",
      imageAlt: "Transaction list",
      fullWidth: false,
    },
    {
      title: "Multi-Card Analytics",
      content:
        "Manage multiple credit cards with per-card analytics, utilization tracking, and trend sparklines across all your banks.",
      imageSrc: "/screenshots/analysis.svg",
      imageAlt: "Analytics dashboard",
      fullWidth: true,
      previewId: "card-analytics",
    },
  ],
  benefits: [
    {
      id: 1,
      text: "Save hours on expense tracking. Upload a PDF and get a full spending breakdown in seconds.",
      image: "/screenshots/home.svg",
    },
    {
      id: 2,
      text: "Eliminate categorization errors with 3-model AI consensus that cross-validates every transaction.",
      image: "/screenshots/upload.svg",
    },
    {
      id: 3,
      text: "Track spending across all cards with per-card analytics, utilization tracking, and trend sparklines.",
      image: "/screenshots/analysis.svg",
    },
    {
      id: 4,
      text: "Export and backup with confidence. CSV export and AES-encrypted backups for total data portability.",
      image: "/screenshots/transactions.svg",
    },
  ],
  trial: {
    statements: 15,
    days: 15,
    description: "15 free statement parses over 15 days. No credit card required.",
  },
  pricing: [
    {
      name: "Monthly",
      href: "#",
      price: "$3",
      period: "month",
      yearlyPrice: "$3",
      features: [
        "4 statement parses per month",
        "3-model AI consensus engine",
        "12 spending categories",
        "Multi-card management",
        "CSV export & encrypted backups",
        "Offline access after parse",
      ],
      description: "Flexible month-to-month plan",
      buttonText: "Start Free Trial",
      isPopular: false,
    },
    {
      name: "Yearly",
      href: "#",
      price: "$24",
      period: "year",
      yearlyPrice: "$24",
      features: [
        "4 statement parses per month",
        "3-model AI consensus engine",
        "12 spending categories",
        "Multi-card management",
        "CSV export & encrypted backups",
        "Offline access after parse",
      ],
      description: "Best value — save 33% vs monthly",
      buttonText: "Start Free Trial",
      isPopular: true,
    },
  ],
  faqs: [
    {
      question: "How does the AI parsing work?",
      answer: (
        <span>
          Vector Expense uses a 3-model consensus engine &mdash; GPT-4o-mini, Claude 3.5
          Haiku, and Gemini 2.0 Flash parse every statement in parallel. Fields
          are resolved by majority voting, eliminating hallucinations. Each
          transaction gets a confidence score.
        </span>
      ),
    },
    {
      question: "Is my financial data safe?",
      answer: (
        <span>
          Absolutely. Vector Expense processes PDFs entirely in-memory &mdash; no
          financial data is ever written to disk on our servers. All your data is
          stored locally on your device in an encrypted SQLite database. No
          accounts, no cloud sync, no tracking.
        </span>
      ),
    },
    {
      question: "Can I integrate Vector Expense with other apps?",
      answer: (
        <span>
          Vector Expense supports CSV export for any statement, which you can import into
          spreadsheets, accounting software, or other financial tools. Encrypted
          backups can be shared via your device&apos;s native share sheet.
        </span>
      ),
    },
    {
      question: "Which banks and currencies are supported?",
      answer: (
        <span>
          Vector Expense supports 40+ banks across India, US, and UK, plus global cards
          like American Express and HSBC. Currencies supported: INR (&rupee;), USD ($), EUR
          (&euro;), and GBP (&pound;) with locale-specific formatting.
        </span>
      ),
    },
    {
      question: "Can I use Vector Expense offline?",
      answer: (
        <span>
          Yes! After the initial statement parse (which requires internet for AI
          processing), all features work completely offline. Your data is stored
          locally, so you can browse transactions, view analytics, and export
          reports without internet.
        </span>
      ),
    },
    {
      question: "Does Vector Expense support password-protected PDFs?",
      answer: (
        <span>
          Yes. Vector Expense auto-detects encrypted PDFs and prompts you for
          the password before parsing. You can optionally save the password for
          that card so future uploads from the same bank are unlocked
          automatically.
        </span>
      ),
    },
    {
      question: "Can I add transactions manually?",
      answer: (
        <span>
          Absolutely. You can add expenses manually with live AI categorization
          as you type. Attach receipt photos, add notes, flag important
          transactions, and track manual entries alongside your parsed
          statements in a unified view.
        </span>
      ),
    },
  ],
  footer: [
    {
      id: 1,
      menu: [
        { href: "#features", text: "Features" },
        { href: "#pricing", text: "Pricing" },
        { href: "#faq", text: "FAQ" },
        { href: "/blog", text: "Blog" },
        { href: "/privacy", text: "Privacy" },
        { href: "/terms", text: "Terms" },
      ],
    },
  ],
  testimonials: [
    {
      id: 1,
      text: "Vector Expense has completely changed how I track my business expenses. I just upload my HDFC statement and everything is categorized instantly.",
      name: "Priya Sharma",
      role: "Freelance Designer",
      image:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 2,
      text: "The privacy-first approach is what sold me. No account needed, no data stored on servers. Exactly how finance apps should work.",
      name: "James Mitchell",
      role: "Software Engineer",
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 3,
      text: "Managing 4 credit cards used to be a nightmare. Vector Expense auto-detects each card and gives me per-card analytics. Incredible.",
      name: "Ananya Patel",
      role: "Small Business Owner",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 4,
      text: "The AI parsing accuracy is impressive. 3 models voting on each transaction means I rarely need to correct anything.",
      name: "David Chen",
      role: "Product Manager",
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 5,
      text: "I love that it works with my Barclays and Amex statements. The multi-currency support is perfect for my travel expenses.",
      name: "Sarah Williams",
      role: "Marketing Director",
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 6,
      text: "The CSV export feature saves me hours during tax season. Upload statement, export transactions, done.",
      name: "Rahul Verma",
      role: "CA / Accountant",
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 7,
      text: "Free tier with 3 uploads per month is more than enough for me. Best budgeting tool I've found that doesn't want all my data.",
      name: "Emily Foster",
      role: "Graduate Student",
      image:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 8,
      text: "Finally an app that handles Indian number formatting correctly. The details that matter.",
      name: "Vikram Singh",
      role: "Startup Founder",
      image:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 9,
      text: "The demo mode let me try everything before uploading a single document. Smart onboarding.",
      name: "Lisa Park",
      role: "UX Researcher",
      image:
        "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 10,
      text: "Works with my ICICI, SBI, and Axis statements flawlessly. The category breakdown charts are beautiful.",
      name: "Arjun Nair",
      role: "Data Analyst",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 11,
      text: "I travel between US and UK for work. Vector Expense handles both Chase and HSBC statements with correct currency formatting.",
      name: "Michael Torres",
      role: "Consultant",
      image:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60",
    },
    {
      id: 12,
      text: "The encrypted backup feature gives me peace of mind. All my financial data is password-protected and stays on my phone.",
      name: "Neha Gupta",
      role: "Doctor",
      image:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60",
    },
  ],
};

export type SiteConfig = typeof siteConfig;

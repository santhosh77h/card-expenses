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
    appStore: "https://apps.apple.com/us/app/vector-expense/id6761052010",
  },
  featureKeys: [
    { key: "aiParsing", icon: <BrainIcon className="h-6 w-6" /> },
    { key: "privacy", icon: <ShieldIcon className="h-6 w-6" /> },
    { key: "categorization", icon: <TagsIcon className="h-6 w-6" /> },
    { key: "multiCurrency", icon: <GlobeIcon className="h-6 w-6" /> },
    { key: "multiCard", icon: <CreditCardIcon className="h-6 w-6" /> },
    { key: "offline", icon: <LockIcon className="h-6 w-6" /> },
    { key: "demo", icon: <PlayCircleIcon className="h-6 w-6" /> },
    { key: "manual", icon: <PenLineIcon className="h-6 w-6" /> },
  ],
  featureHighlight: [
    {
      key: "aiParsing",
      imageSrc: "/screenshots/upload.svg",
      direction: "rtl" as const,
      previewId: "upload-screen",
    },
    {
      key: "smartCategories",
      imageSrc: "/screenshots/categories.svg",
      direction: "ltr" as const,
      previewId: "categories-screen",
    },
    {
      key: "detailedAnalytics",
      imageSrc: "/screenshots/analysis.svg",
      direction: "rtl" as const,
      previewId: "card-analytics",
    },
  ],
  bento: [
    {
      key: "aiParsing",
      imageSrc: "/screenshots/home.svg",
      imageAlt: "Vector Expense home screen",
      fullWidth: true,
    },
    {
      key: "smartCategorization",
      imageSrc: "/screenshots/categories.svg",
      imageAlt: "Category breakdown",
      fullWidth: false,
    },
    {
      key: "transactionDetails",
      imageSrc: "/screenshots/transactions.svg",
      imageAlt: "Transaction list",
      fullWidth: false,
    },
    {
      key: "multiCardAnalytics",
      imageSrc: "/screenshots/analysis.svg",
      imageAlt: "Analytics dashboard",
      fullWidth: true,
      previewId: "card-analytics",
    },
  ],
  benefits: [
    { id: 1, image: "/screenshots/home.svg" },
    { id: 2, image: "/screenshots/upload.svg" },
    { id: 3, image: "/screenshots/analysis.svg" },
    { id: 4, image: "/screenshots/transactions.svg" },
  ],
  trial: {
    statements: 15,
    days: 15,
  },
  pricing: [
    {
      key: "monthly" as const,
      href: "#",
      price: "$3",
      period: "month" as const,
      yearlyPrice: "$3",
      isPopular: false,
    },
    {
      key: "yearly" as const,
      href: "#",
      price: "$24",
      period: "year" as const,
      yearlyPrice: "$24",
      isPopular: true,
    },
  ],
  pricingFeatureKeys: [
    "parses",
    "aiEngine",
    "categories",
    "multiCard",
    "csvExport",
    "offline",
  ] as const,
  faqKeys: ["q1", "q2", "q3", "q4", "q5", "q6", "q7"] as const,
  footerLinks: [
    { key: "features", href: "#features" },
    { key: "pricing", href: "#pricing" },
    { key: "faq", href: "#faq" },
    { key: "blog", href: "/blog" },
    { key: "privacy", href: "/privacy" },
    { key: "terms", href: "/terms" },
  ],
  testimonials: [
    { key: "t1", name: "Priya Sharma", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60" },
    { key: "t2", name: "James Mitchell", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60" },
    { key: "t3", name: "Ananya Patel", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60" },
    { key: "t4", name: "David Chen", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&auto=format&fit=crop&q=60" },
    { key: "t5", name: "Sarah Williams", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=60" },
    { key: "t6", name: "Rahul Verma", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60" },
    { key: "t7", name: "Emily Foster", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=60" },
    { key: "t8", name: "Vikram Singh", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60" },
    { key: "t9", name: "Lisa Park", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&auto=format&fit=crop&q=60" },
    { key: "t10", name: "Arjun Nair", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60" },
    { key: "t11", name: "Michael Torres", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60" },
    { key: "t12", name: "Neha Gupta", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60" },
  ],
};

export type SiteConfig = typeof siteConfig;

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

import axios from 'axios';
import { Transaction, StatementSummary } from '../store';
import { categoryColors } from '../theme';

const API_URL = 'http://192.168.0.203:8000';

export interface CardInfo {
	card_last4: string | null;
	card_network: string | null;
	credit_limit: number | null;
	total_amount_due: number | null;
	minimum_amount_due: number | null;
	payment_due_date: string | null;
	currency?: string | null;
}

interface ParseResult {
	transactions: Transaction[];
	summary: StatementSummary;
	csv: string;
	bank_detected: string;
	card_info: CardInfo | null;
	currency_detected?: string;
}

export async function parseStatement(fileUri: string, fileName: string, password?: string): Promise<ParseResult> {
	const formData = new FormData();
	formData.append('file', {
		uri: fileUri,
		name: fileName,
		type: 'application/pdf',
	} as any);
	if (password) {
		formData.append('password', password);
	}

	const response = await axios.post<ParseResult>(`${API_URL}/parse-statement/json`, formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
		timeout: 60000,
	});

	const data = response.data;
	return validateParseResult(data);
}

// ---------------------------------------------------------------------------
// Demo mode — 24 realistic mock transactions across 12 categories
// ---------------------------------------------------------------------------

export function parseDemoStatement(): ParseResult {
	const transactions: Transaction[] = [
		{
			id: 'demo-1',
			date: '2024-01-03',
			description: 'Swiggy Order #48291',
			amount: 456.0,
			category: 'Food & Dining',
			category_color: categoryColors['Food & Dining'],
			category_icon: 'fork-knife',
			type: 'debit',
		},
		{
			id: 'demo-2',
			date: '2024-01-05',
			description: 'Zomato Gold - Barbeque Nation',
			amount: 1850.0,
			category: 'Food & Dining',
			category_color: categoryColors['Food & Dining'],
			category_icon: 'fork-knife',
			type: 'debit',
		},
		{
			id: 'demo-3',
			date: '2024-01-06',
			description: 'Starbucks Reserve MG Road',
			amount: 680.0,
			category: 'Food & Dining',
			category_color: categoryColors['Food & Dining'],
			category_icon: 'fork-knife',
			type: 'debit',
		},
		{
			id: 'demo-4',
			date: '2024-01-04',
			description: 'BigBasket Monthly Groceries',
			amount: 3240.0,
			category: 'Groceries',
			category_color: categoryColors['Groceries'],
			category_icon: 'shopping-cart',
			type: 'debit',
		},
		{
			id: 'demo-5',
			date: '2024-01-12',
			description: 'Blinkit Instant Delivery',
			amount: 589.0,
			category: 'Groceries',
			category_color: categoryColors['Groceries'],
			category_icon: 'shopping-cart',
			type: 'debit',
		},
		{
			id: 'demo-6',
			date: '2024-01-07',
			description: 'Amazon.in - Electronics',
			amount: 4299.0,
			category: 'Shopping',
			category_color: categoryColors['Shopping'],
			category_icon: 'shopping-bag',
			type: 'debit',
		},
		{
			id: 'demo-7',
			date: '2024-01-15',
			description: 'Myntra Fashion Sale',
			amount: 2150.0,
			category: 'Shopping',
			category_color: categoryColors['Shopping'],
			category_icon: 'shopping-bag',
			type: 'debit',
		},
		{
			id: 'demo-8',
			date: '2024-01-08',
			description: 'Uber Ride - Airport',
			amount: 890.0,
			category: 'Transportation',
			category_color: categoryColors['Transportation'],
			category_icon: 'car',
			type: 'debit',
		},
		{
			id: 'demo-9',
			date: '2024-01-20',
			description: 'Indian Oil Petrol',
			amount: 3500.0,
			category: 'Transportation',
			category_color: categoryColors['Transportation'],
			category_icon: 'car',
			type: 'debit',
		},
		{
			id: 'demo-10',
			date: '2024-01-09',
			description: 'Netflix Premium Monthly',
			amount: 649.0,
			category: 'Entertainment',
			category_color: categoryColors['Entertainment'],
			category_icon: 'film',
			type: 'debit',
		},
		{
			id: 'demo-11',
			date: '2024-01-09',
			description: 'Spotify Premium Annual',
			amount: 1189.0,
			category: 'Entertainment',
			category_color: categoryColors['Entertainment'],
			category_icon: 'film',
			type: 'debit',
		},
		{
			id: 'demo-12',
			date: '2024-01-10',
			description: 'Apollo Pharmacy - Medicines',
			amount: 1450.0,
			category: 'Health & Medical',
			category_color: categoryColors['Health & Medical'],
			category_icon: 'heart-pulse',
			type: 'debit',
		},
		{
			id: 'demo-13',
			date: '2024-01-22',
			description: 'Cult.fit Gym Membership',
			amount: 1500.0,
			category: 'Health & Medical',
			category_color: categoryColors['Health & Medical'],
			category_icon: 'heart-pulse',
			type: 'debit',
		},
		{
			id: 'demo-14',
			date: '2024-01-01',
			description: 'Jio Fiber Monthly',
			amount: 999.0,
			category: 'Utilities & Bills',
			category_color: categoryColors['Utilities & Bills'],
			category_icon: 'zap',
			type: 'debit',
		},
		{
			id: 'demo-15',
			date: '2024-01-05',
			description: 'BESCOM Electricity Bill',
			amount: 2100.0,
			category: 'Utilities & Bills',
			category_color: categoryColors['Utilities & Bills'],
			category_icon: 'zap',
			type: 'debit',
		},
		{
			id: 'demo-16',
			date: '2024-01-11',
			description: 'MakeMyTrip - Goa Hotel',
			amount: 5600.0,
			category: 'Travel',
			category_color: categoryColors['Travel'],
			category_icon: 'plane',
			type: 'debit',
		},
		{
			id: 'demo-17',
			date: '2024-01-11',
			description: 'IndiGo Flight BLR-GOI',
			amount: 3800.0,
			category: 'Travel',
			category_color: categoryColors['Travel'],
			category_icon: 'plane',
			type: 'debit',
		},
		{
			id: 'demo-18',
			date: '2024-01-14',
			description: 'Udemy - React Native Course',
			amount: 449.0,
			category: 'Education',
			category_color: categoryColors['Education'],
			category_icon: 'book-open',
			type: 'debit',
		},
		{
			id: 'demo-19',
			date: '2024-01-25',
			description: 'Kindle Unlimited Subscription',
			amount: 169.0,
			category: 'Education',
			category_color: categoryColors['Education'],
			category_icon: 'book-open',
			type: 'debit',
		},
		{
			id: 'demo-20',
			date: '2024-01-02',
			description: 'Groww - SIP Mutual Fund',
			amount: 5000.0,
			category: 'Finance & Investment',
			category_color: categoryColors['Finance & Investment'],
			category_icon: 'trending-up',
			type: 'debit',
		},
		{
			id: 'demo-21',
			date: '2024-01-02',
			description: 'Zerodha Brokerage',
			amount: 200.0,
			category: 'Finance & Investment',
			category_color: categoryColors['Finance & Investment'],
			category_icon: 'trending-up',
			type: 'debit',
		},
		{
			id: 'demo-22',
			date: '2024-01-18',
			description: 'Google Pay Transfer',
			amount: 2000.0,
			category: 'Transfers',
			category_color: categoryColors['Transfers'],
			category_icon: 'repeat',
			type: 'debit',
		},
		{
			id: 'demo-23',
			date: '2024-01-13',
			description: 'Cashback Reward - Amazon',
			amount: 430.0,
			category: 'Shopping',
			category_color: categoryColors['Shopping'],
			category_icon: 'shopping-bag',
			type: 'credit',
		},
		{
			id: 'demo-24',
			date: '2024-01-28',
			description: 'Refund - Myntra Return',
			amount: 899.0,
			category: 'Shopping',
			category_color: categoryColors['Shopping'],
			category_icon: 'shopping-bag',
			type: 'credit',
		},
	];

	const totalDebits = transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
	const totalCredits = transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);

	const categories: Record<string, { total: number; count: number }> = {};
	for (const t of transactions) {
		if (!categories[t.category]) {
			categories[t.category] = { total: 0, count: 0 };
		}
		categories[t.category].total += t.amount;
		categories[t.category].count += 1;
	}

	const dates = transactions.map((t) => t.date).sort();

	const summary: StatementSummary = {
		total_transactions: transactions.length,
		total_debits: Math.round(totalDebits * 100) / 100,
		total_credits: Math.round(totalCredits * 100) / 100,
		net: Math.round((totalDebits - totalCredits) * 100) / 100,
		categories,
		statement_period: { from: dates[0], to: dates[dates.length - 1] },
	};

	const csv = generateCSV(transactions);

	return {
		transactions,
		summary,
		csv,
		bank_detected: 'demo',
		card_info: {
			card_last4: '4321',
			card_network: 'Visa',
			credit_limit: 200000,
			total_amount_due: 42759,
			minimum_amount_due: 2138,
			payment_due_date: '2024-02-15',
		},
	};
}

// ---------------------------------------------------------------------------
// Client-side categorizer — mirrors backend categorizer.py
// ---------------------------------------------------------------------------

const categoryKeywords: { category: string; icon: string; keywords: string[] }[] = [
	{
		category: 'Food & Dining',
		icon: 'fork-knife',
		keywords: [
			'swiggy',
			'zomato',
			'restaurant',
			'cafe',
			'starbucks',
			'pizza',
			'burger',
			'food',
			'dining',
			'dominos',
			'mcdonalds',
			'kfc',
			'biryani',
			'dinner',
			'lunch',
			'breakfast',
		],
	},
	{
		category: 'Groceries',
		icon: 'shopping-cart',
		keywords: [
			'bigbasket',
			'blinkit',
			'grofers',
			'dmart',
			'grocery',
			'supermarket',
			'zepto',
			'dunzo',
			'instamart',
			'vegetables',
			'fruits',
		],
	},
	{
		category: 'Shopping',
		icon: 'shopping-bag',
		keywords: [
			'amazon',
			'flipkart',
			'myntra',
			'ajio',
			'nykaa',
			'meesho',
			'shopping',
			'mall',
			'store',
			'retail',
			'fashion',
		],
	},
	{
		category: 'Transportation',
		icon: 'car',
		keywords: [
			'uber',
			'ola',
			'rapido',
			'metro',
			'petrol',
			'diesel',
			'fuel',
			'parking',
			'toll',
			'indian oil',
			'hp petrol',
			'bharat petroleum',
		],
	},
	{
		category: 'Entertainment',
		icon: 'film',
		keywords: [
			'netflix',
			'spotify',
			'hotstar',
			'prime video',
			'youtube',
			'cinema',
			'movie',
			'concert',
			'gaming',
			'playstation',
			'xbox',
			'bookmyshow',
		],
	},
	{
		category: 'Health & Medical',
		icon: 'heart-pulse',
		keywords: [
			'apollo',
			'pharmacy',
			'hospital',
			'doctor',
			'medical',
			'health',
			'gym',
			'cult.fit',
			'fitness',
			'lab',
			'diagnostic',
			'medicine',
		],
	},
	{
		category: 'Utilities & Bills',
		icon: 'zap',
		keywords: [
			'jio',
			'airtel',
			'vodafone',
			'electricity',
			'water',
			'gas',
			'broadband',
			'wifi',
			'recharge',
			'bill',
			'bescom',
			'bsnl',
			'fiber',
		],
	},
	{
		category: 'Travel',
		icon: 'plane',
		keywords: [
			'makemytrip',
			'goibibo',
			'indigo',
			'air india',
			'spicejet',
			'hotel',
			'booking',
			'flight',
			'train',
			'irctc',
			'oyo',
			'airbnb',
		],
	},
	{
		category: 'Education',
		icon: 'book-open',
		keywords: [
			'udemy',
			'coursera',
			'kindle',
			'book',
			'school',
			'college',
			'tuition',
			'course',
			'unacademy',
			'byjus',
			'education',
		],
	},
	{
		category: 'Finance & Investment',
		icon: 'trending-up',
		keywords: [
			'groww',
			'zerodha',
			'mutual fund',
			'sip',
			'investment',
			'insurance',
			'lic',
			'premium',
			'brokerage',
			'trading',
		],
	},
	{
		category: 'Transfers',
		icon: 'repeat',
		keywords: ['transfer', 'neft', 'imps', 'upi', 'google pay', 'phonepe', 'paytm', 'bhim', 'gpay'],
	},
];

export function categorizeTransaction(description: string): {
	category: string;
	category_color: string;
	category_icon: string;
} {
	const lower = description.toLowerCase();
	for (const entry of categoryKeywords) {
		if (entry.keywords.some((kw) => lower.includes(kw))) {
			return {
				category: entry.category,
				category_color: categoryColors[entry.category] || categoryColors['Other'],
				category_icon: entry.icon,
			};
		}
	}
	return {
		category: 'Other',
		category_color: categoryColors['Other'],
		category_icon: 'help-circle',
	};
}

function validateParseResult(data: any): ParseResult {
	const transactions: Transaction[] = Array.isArray(data.transactions)
		? data.transactions.map((t: any, i: number) => ({
				id: t.id || `api-${Date.now()}-${i}`,
				date: t.date || 'Unknown',
				description: t.description || 'Unknown',
				amount: typeof t.amount === 'number' ? t.amount : 0,
				category: t.category || 'Other',
				category_color: t.category_color || categoryColors['Other'],
				category_icon: t.category_icon || 'help-circle',
				type: t.type === 'credit' ? 'credit' : 'debit',
				cardId: t.cardId,
				currency: t.currency,
			}))
		: [];

	const summary = data.summary || {
		total_transactions: transactions.length,
		total_debits: 0,
		total_credits: 0,
		net: 0,
		categories: {},
		statement_period: { from: null, to: null },
	};

	return {
		transactions,
		summary,
		csv: data.csv || '',
		bank_detected: data.bank_detected || 'generic',
		card_info: data.card_info ?? null,
		currency_detected: data.currency_detected,
	};
}

export function generateCSV(transactions: Transaction[]): string {
	const header = 'date,description,amount,category,type';
	const rows = transactions.map(
		(t) => `${t.date},"${t.description.replace(/"/g, '""')}",${t.amount},${t.category},${t.type}`,
	);
	return [header, ...rows].join('\n');
}

import type { CreditCard, MonthlyUsage, StatementData, Transaction } from '../store';
import type { CurrencyCode } from '../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardSpendSummary {
  cardId: string;
  nickname: string;
  last4: string;
  color: string;
  currency: CurrencyCode;
  totalSpend: number;
  previousMonthSpend: number;
  momChange: number | null; // percentage, null if no previous data
  proportionOfTotal: number; // 0-1
}

export interface MonthlySpendByCard {
  month: string; // "YYYY-MM"
  label: string; // "Jan", "Feb" etc.
  spends: Array<{ cardId: string; nickname: string; amount: number; color: string }>;
}

export interface CategoryByCardSegment {
  category: string;
  color: string;
  total: number;
  segments: Array<{ cardId: string; nickname: string; amount: number; color: string }>;
}

export interface CardDetailData {
  trendData: Array<{ month: string; label: string; amount: number }>;
  topCategories: Array<{ name: string; color: string; amount: number; percentage: number }>;
  recentTransactions: Transaction[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(yyyymm: string): string {
  const [, m] = yyyymm.split('-');
  return MONTH_NAMES[parseInt(m, 10) - 1] || yyyymm;
}

function monthLabelShortYear(yyyymm: string): string {
  const [year, m] = yyyymm.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} '${year.slice(2)}`;
}

function monthLabelFull(yyyymm: string): string {
  const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [year, m] = yyyymm.split('-');
  return `${FULL[parseInt(m, 10) - 1]} ${year}`;
}

function prevMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get sorted list of months that have usage data, newest first.
 */
export function getAvailableMonths(monthlyUsage: MonthlyUsage[]): string[] {
  const set = new Set(monthlyUsage.map((u) => u.month));
  return Array.from(set).sort().reverse();
}

/**
 * Format a YYYY-MM month string to a full display label like "January 2026".
 */
export { monthLabelFull };

/**
 * Per-card spend summaries for a given month.
 */
export function getCardSpendSummaries(
  cards: CreditCard[],
  monthlyUsage: MonthlyUsage[],
  selectedMonth: string,
  currencyFilter?: CurrencyCode,
): CardSpendSummary[] {
  const prev = prevMonth(selectedMonth);

  // Build lookup: cardId -> usage for the month
  const currentByCard = new Map<string, MonthlyUsage>();
  const prevByCard = new Map<string, MonthlyUsage>();
  for (const u of monthlyUsage) {
    if (u.month === selectedMonth) currentByCard.set(u.cardId, u);
    if (u.month === prev) prevByCard.set(u.cardId, u);
  }

  const filteredCards = currencyFilter
    ? cards.filter((c) => (c.currency || 'INR') === currencyFilter)
    : cards;

  const summaries: CardSpendSummary[] = filteredCards.map((card) => {
    const cur = currentByCard.get(card.id);
    const prv = prevByCard.get(card.id);
    const totalSpend = cur?.totalDebits ?? 0;
    const previousMonthSpend = prv?.totalDebits ?? 0;
    const momChange = previousMonthSpend > 0
      ? ((totalSpend - previousMonthSpend) / previousMonthSpend) * 100
      : null;
    return {
      cardId: card.id,
      nickname: card.nickname,
      last4: card.last4,
      color: card.color,
      currency: (card.currency || 'INR') as CurrencyCode,
      totalSpend,
      previousMonthSpend,
      momChange,
      proportionOfTotal: 0, // computed below
    };
  });

  const grandTotal = summaries.reduce((s, c) => s + c.totalSpend, 0);
  if (grandTotal > 0) {
    for (const s of summaries) {
      s.proportionOfTotal = s.totalSpend / grandTotal;
    }
  }

  return summaries.sort((a, b) => b.totalSpend - a.totalSpend);
}

/**
 * Monthly spending per card over the last N months. For grouped bar chart.
 */
export function getMonthlySpendByCard(
  cards: CreditCard[],
  monthlyUsage: MonthlyUsage[],
  numMonths: number = 6,
  currencyFilter?: CurrencyCode,
): MonthlySpendByCard[] {
  const filteredCards = currencyFilter
    ? cards.filter((c) => (c.currency || 'INR') === currencyFilter)
    : cards;
  const cardIds = new Set(filteredCards.map((c) => c.id));
  const cardMap = new Map(filteredCards.map((c) => [c.id, c]));

  // Get unique months, sorted ascending, last N
  const months = Array.from(new Set(
    monthlyUsage
      .filter((u) => cardIds.has(u.cardId))
      .map((u) => u.month),
  )).sort().slice(-numMonths);

  // Build lookup
  const lookup = new Map<string, number>(); // "cardId|month" -> debits
  for (const u of monthlyUsage) {
    if (cardIds.has(u.cardId)) {
      lookup.set(`${u.cardId}|${u.month}`, u.totalDebits);
    }
  }

  return months.map((month) => ({
    month,
    label: monthLabel(month),
    spends: filteredCards
      .map((card) => ({
        cardId: card.id,
        nickname: card.nickname,
        amount: lookup.get(`${card.id}|${month}`) ?? 0,
        color: card.color,
      }))
      .filter((s) => s.amount > 0 || filteredCards.length <= 5),
  }));
}

/**
 * Category breakdown by card for a given month. For stacked horizontal bars.
 */
export function getCategoryBreakdownByCard(
  cards: CreditCard[],
  statements: Record<string, StatementData[]>,
  selectedMonth: string,
  currencyFilter?: CurrencyCode,
): CategoryByCardSegment[] {
  const filteredCards = currencyFilter
    ? cards.filter((c) => (c.currency || 'INR') === currencyFilter)
    : cards;
  const cardMap = new Map(filteredCards.map((c) => [c.id, c]));

  // Collect all debit transactions for the selected month across cards
  const categoryTotals = new Map<string, Map<string, number>>(); // category -> (cardId -> amount)
  const categoryColors = new Map<string, string>();

  for (const card of filteredCards) {
    const stmts = statements[card.id] || [];
    for (const stmt of stmts) {
      // Check if this statement covers the selected month
      const period = stmt.summary?.statement_period;
      const stmtMonth = period?.to ? period.to.slice(0, 7) : stmt.parsedAt?.slice(0, 7);
      if (stmtMonth !== selectedMonth) continue;

      for (const txn of stmt.transactions) {
        if (txn.type !== 'debit') continue;
        const cat = txn.category || 'Other';
        if (!categoryTotals.has(cat)) categoryTotals.set(cat, new Map());
        const cardTotals = categoryTotals.get(cat)!;
        cardTotals.set(card.id, (cardTotals.get(card.id) || 0) + txn.amount);
        if (txn.category_color) categoryColors.set(cat, txn.category_color);
      }
    }
  }

  // Convert to sorted array
  const result: CategoryByCardSegment[] = [];
  for (const [category, cardTotals] of categoryTotals) {
    const segments = Array.from(cardTotals.entries())
      .map(([cardId, amount]) => {
        const card = cardMap.get(cardId);
        return {
          cardId,
          nickname: card?.nickname || 'Unknown',
          amount,
          color: card?.color || '#666',
        };
      })
      .sort((a, b) => b.amount - a.amount);

    result.push({
      category,
      color: categoryColors.get(category) || '#6B7280',
      total: segments.reduce((s, seg) => s + seg.amount, 0),
      segments,
    });
  }

  return result.sort((a, b) => b.total - a.total).slice(0, 8);
}

/**
 * Per-card detail: trend, top categories, recent transactions.
 */
export function getCardDetail(
  cardId: string,
  statements: Record<string, StatementData[]>,
  monthlyUsage: MonthlyUsage[],
): CardDetailData {
  // Trend: last 6 months of spending for this card
  const cardUsage = monthlyUsage
    .filter((u) => u.cardId === cardId)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  const trendData = cardUsage.map((u) => ({
    month: u.month,
    label: monthLabel(u.month),
    amount: u.totalDebits,
  }));

  // Top categories across all statements for this card
  const catTotals = new Map<string, { amount: number; color: string }>();
  const stmts = statements[cardId] || [];
  for (const stmt of stmts) {
    for (const txn of stmt.transactions) {
      if (txn.type !== 'debit') continue;
      const cat = txn.category || 'Other';
      const existing = catTotals.get(cat) || { amount: 0, color: txn.category_color || '#6B7280' };
      existing.amount += txn.amount;
      catTotals.set(cat, existing);
    }
  }

  const catArray = Array.from(catTotals.entries())
    .map(([name, { amount, color }]) => ({ name, color, amount, percentage: 0 }))
    .sort((a, b) => b.amount - a.amount);

  const catTotal = catArray.reduce((s, c) => s + c.amount, 0);
  if (catTotal > 0) {
    for (const c of catArray) c.percentage = (c.amount / catTotal) * 100;
  }

  // Recent transactions (last 5 debits across all statements)
  const allTxns: Transaction[] = [];
  for (const stmt of stmts) {
    for (const txn of stmt.transactions) {
      if (txn.type === 'debit') allTxns.push(txn);
    }
  }
  allTxns.sort((a, b) => b.date.localeCompare(a.date));
  const recentTransactions = allTxns.slice(0, 5);

  return {
    trendData,
    topCategories: catArray.slice(0, 5),
    recentTransactions,
  };
}

/**
 * Per-card monthly usage for the manage view — utilization bars.
 */
export interface CardMonthlyBill {
  month: string;
  label: string;       // "Jan", "Feb"
  labelYear: string;   // "Jan '26"
  totalDebits: number;
  totalCredits: number;
  net: number;
  utilization: number; // 0-1 ratio against credit limit
  statementId: string;
}

export function getCardMonthlyBills(
  cardId: string,
  creditLimit: number,
  monthlyUsage: MonthlyUsage[],
): CardMonthlyBill[] {
  return monthlyUsage
    .filter((u) => u.cardId === cardId)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((u) => ({
      month: u.month,
      label: monthLabel(u.month),
      labelYear: monthLabelShortYear(u.month),
      totalDebits: u.totalDebits,
      totalCredits: u.totalCredits,
      net: u.net,
      utilization: creditLimit > 0 ? Math.min(u.totalDebits / creditLimit, 1) : 0,
      statementId: u.statementId,
    }));
}

/**
 * Quick stats for a card: total statements, total spend across all time, avg monthly spend.
 */
export interface CardQuickStats {
  totalStatements: number;
  totalSpendAllTime: number;
  avgMonthlySpend: number;
  highestMonth: { month: string; amount: number } | null;
  lowestMonth: { month: string; amount: number } | null;
}

export function getCardQuickStats(
  cardId: string,
  statements: Record<string, StatementData[]>,
  monthlyUsage: MonthlyUsage[],
): CardQuickStats {
  const stmts = statements[cardId] || [];
  const usage = monthlyUsage.filter((u) => u.cardId === cardId);
  const totalSpend = usage.reduce((s, u) => s + u.totalDebits, 0);
  const avg = usage.length > 0 ? totalSpend / usage.length : 0;

  let highest: { month: string; amount: number } | null = null;
  let lowest: { month: string; amount: number } | null = null;
  for (const u of usage) {
    if (!highest || u.totalDebits > highest.amount) highest = { month: u.month, amount: u.totalDebits };
    if (!lowest || u.totalDebits < lowest.amount) lowest = { month: u.month, amount: u.totalDebits };
  }

  return {
    totalStatements: stmts.length,
    totalSpendAllTime: totalSpend,
    avgMonthlySpend: avg,
    highestMonth: highest,
    lowestMonth: lowest,
  };
}

/**
 * Get unique currencies across cards that have monthly usage data.
 */
export function getActiveCurrencies(
  cards: CreditCard[],
  monthlyUsage: MonthlyUsage[],
): CurrencyCode[] {
  const activeCardIds = new Set(monthlyUsage.map((u) => u.cardId));
  const currencies = new Set<CurrencyCode>();
  for (const card of cards) {
    if (activeCardIds.has(card.id)) {
      currencies.add((card.currency || 'INR') as CurrencyCode);
    }
  }
  return Array.from(currencies);
}

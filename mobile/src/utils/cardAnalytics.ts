import type { CreditCard, MonthlyUsage, StatementData, Transaction } from '../store';
import type { CurrencyCode } from '../theme';
import { categoryColors, CURRENCY_CONFIG } from '../theme';

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

// ---------------------------------------------------------------------------
// 12-Month Period Analytics
// ---------------------------------------------------------------------------

export interface Period {
  startMonth: string; // "YYYY-MM"
  endMonth: string;   // "YYYY-MM"
  label: string;      // "Apr 2025 – Mar 2026"
  months: string[];   // all months in order
}

function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

function generateMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  let cur = start;
  while (cur <= end) {
    months.push(cur);
    cur = addMonths(cur, 1);
  }
  return months;
}

export function buildPeriod(endMonth: string, numMonths: number = 12): Period {
  const startMonth = addMonths(endMonth, -(numMonths - 1));
  const months = generateMonthRange(startMonth, endMonth);
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = endMonth.split('-').map(Number);
  return {
    startMonth,
    endMonth,
    label: `${MONTH_NAMES[sm - 1]} ${sy} – ${MONTH_NAMES[em - 1]} ${ey}`,
    months,
  };
}

export function getLatestPeriod(monthlyUsage: MonthlyUsage[]): Period | null {
  const months = getAvailableMonths(monthlyUsage);
  if (months.length === 0) return null;
  return buildPeriod(months[0], 12);
}

export function navigatePeriod(period: Period, direction: 'prev' | 'next'): Period {
  const newEnd = addMonths(period.endMonth, direction === 'next' ? 12 : -12);
  return buildPeriod(newEnd, period.months.length);
}

export function canNavigatePeriod(
  period: Period,
  direction: 'prev' | 'next',
  monthlyUsage: MonthlyUsage[],
): boolean {
  const allMonths = getAvailableMonths(monthlyUsage);
  if (allMonths.length === 0) return false;
  const oldest = allMonths[allMonths.length - 1];
  const newest = allMonths[0];
  if (direction === 'next') return period.endMonth < newest;
  return period.startMonth > oldest;
}

// ---------------------------------------------------------------------------
// 12-Month Trend (line chart data)
// ---------------------------------------------------------------------------

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  amount: number;
}

export function get12MonthTrend(
  cards: CreditCard[],
  monthlyUsage: MonthlyUsage[],
  period: Period,
  cardFilter?: string | null,
  currencyFilter?: CurrencyCode,
): MonthlyTrendPoint[] {
  const filteredCards = currencyFilter
    ? cards.filter((c) => (c.currency || 'INR') === currencyFilter)
    : cards;
  const cardIds = cardFilter
    ? new Set([cardFilter])
    : new Set(filteredCards.map((c) => c.id));

  const monthTotals = new Map<string, number>();
  for (const u of monthlyUsage) {
    if (!cardIds.has(u.cardId)) continue;
    if (u.month < period.startMonth || u.month > period.endMonth) continue;
    monthTotals.set(u.month, (monthTotals.get(u.month) || 0) + u.totalDebits);
  }

  return period.months.map((month) => ({
    month,
    label: monthLabel(month),
    amount: monthTotals.get(month) || 0,
  }));
}

// ---------------------------------------------------------------------------
// Summary Stats
// ---------------------------------------------------------------------------

export interface SummaryStats {
  monthlyAverage: number;
  peakMonth: { month: string; label: string; amount: number } | null;
  lowestMonth: { month: string; label: string; amount: number } | null;
  totalSpend: number;
  activeMonths: number;
}

export function getSummaryStats(trendData: MonthlyTrendPoint[]): SummaryStats {
  const active = trendData.filter((d) => d.amount > 0);
  const totalSpend = active.reduce((s, d) => s + d.amount, 0);
  const activeMonths = active.length;
  const monthlyAverage = activeMonths > 0 ? totalSpend / activeMonths : 0;

  let peakMonth: SummaryStats['peakMonth'] = null;
  let lowestMonth: SummaryStats['lowestMonth'] = null;
  for (const d of active) {
    if (!peakMonth || d.amount > peakMonth.amount) {
      peakMonth = { month: d.month, label: d.label, amount: d.amount };
    }
    if (!lowestMonth || d.amount < lowestMonth.amount) {
      lowestMonth = { month: d.month, label: d.label, amount: d.amount };
    }
  }

  return { monthlyAverage, peakMonth, lowestMonth, totalSpend, activeMonths };
}

// ---------------------------------------------------------------------------
// Card Chip Summaries (for period selector chips)
// ---------------------------------------------------------------------------

export interface CardChipSummary {
  cardId: string | null; // null = "All Cards"
  label: string;
  last4: string;
  totalSpend: number;
  changePercent: number | null;
  changeLabel: string;
  isUp: boolean;
  currency: CurrencyCode;
  color: string;
}

export function getCardChipSummaries(
  cards: CreditCard[],
  monthlyUsage: MonthlyUsage[],
  period: Period,
  currencyFilter?: CurrencyCode,
): CardChipSummary[] {
  const filtered = currencyFilter
    ? cards.filter((c) => (c.currency || 'INR') === currencyFilter)
    : cards;

  // Period totals per card
  const currentTotals = new Map<string, number>();
  const prevPeriod = buildPeriod(addMonths(period.endMonth, -12), period.months.length);
  const prevTotals = new Map<string, number>();

  // Latest month MoM
  const latestMonth = period.endMonth;
  const prevMo = prevMonth(latestMonth);
  const latestByCard = new Map<string, number>();
  const prevMoByCard = new Map<string, number>();

  for (const u of monthlyUsage) {
    if (u.month >= period.startMonth && u.month <= period.endMonth) {
      currentTotals.set(u.cardId, (currentTotals.get(u.cardId) || 0) + u.totalDebits);
    }
    if (u.month >= prevPeriod.startMonth && u.month <= prevPeriod.endMonth) {
      prevTotals.set(u.cardId, (prevTotals.get(u.cardId) || 0) + u.totalDebits);
    }
    if (u.month === latestMonth) {
      latestByCard.set(u.cardId, (latestByCard.get(u.cardId) || 0) + u.totalDebits);
    }
    if (u.month === prevMo) {
      prevMoByCard.set(u.cardId, (prevMoByCard.get(u.cardId) || 0) + u.totalDebits);
    }
  }

  const allCurrent = filtered.reduce((s, c) => s + (currentTotals.get(c.id) || 0), 0);
  const allPrev = filtered.reduce((s, c) => s + (prevTotals.get(c.id) || 0), 0);
  const yoy = allPrev > 0 ? ((allCurrent - allPrev) / allPrev) * 100 : null;
  const defaultCurrency = (filtered[0]?.currency || 'INR') as CurrencyCode;

  const result: CardChipSummary[] = [{
    cardId: null,
    label: 'All cards',
    last4: '',
    totalSpend: allCurrent,
    changePercent: yoy,
    changeLabel: 'vs prev year',
    isUp: yoy !== null ? yoy >= 0 : true,
    currency: defaultCurrency,
    color: '#00E5A0',
  }];

  for (const card of filtered) {
    const spend = latestByCard.get(card.id) || 0;
    const prev = prevMoByCard.get(card.id) || 0;
    const mom = prev > 0 ? ((spend - prev) / prev) * 100 : null;
    result.push({
      cardId: card.id,
      label: `${card.issuer} ••${card.last4}`,
      last4: card.last4,
      totalSpend: spend,
      changePercent: mom,
      changeLabel: 'vs last mo',
      isUp: mom !== null ? mom >= 0 : true,
      currency: (card.currency || 'INR') as CurrencyCode,
      color: card.color,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Top Categories (12-month aggregate)
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, string> = {
  'Food & Dining': '🍽️',
  Groceries: '🛒',
  Shopping: '🛍️',
  Transportation: '🚗',
  Entertainment: '🎬',
  'Health & Medical': '💊',
  'Utilities & Bills': '📱',
  Travel: '✈️',
  Education: '📚',
  'Finance & Investment': '💰',
  Transfers: '🔄',
  Other: '📦',
};

export interface CategoryBreakdown {
  name: string;
  icon: string;
  color: string;
  amount: number;
  percentage: number;
}

export function getTopCategories(
  cards: CreditCard[],
  statements: Record<string, StatementData[]>,
  period: Period,
  cardFilter?: string | null,
  currencyFilter?: CurrencyCode,
): CategoryBreakdown[] {
  const filtered = currencyFilter
    ? cards.filter((c) => (c.currency || 'INR') === currencyFilter)
    : cards;
  const cardIds = cardFilter
    ? new Set([cardFilter])
    : new Set(filtered.map((c) => c.id));

  const catTotals = new Map<string, { amount: number; color: string; icon: string }>();

  for (const card of filtered) {
    if (!cardIds.has(card.id)) continue;
    for (const stmt of (statements[card.id] || [])) {
      const sp = stmt.summary?.statement_period;
      const stmtMonth = sp?.to ? sp.to.slice(0, 7) : stmt.parsedAt?.slice(0, 7);
      if (!stmtMonth || stmtMonth < period.startMonth || stmtMonth > period.endMonth) continue;

      for (const txn of stmt.transactions) {
        if (txn.type !== 'debit') continue;
        const cat = txn.category || 'Other';
        const existing = catTotals.get(cat) || {
          amount: 0,
          color: txn.category_color || categoryColors[cat] || '#6B7280',
          icon: CATEGORY_ICONS[cat] || '📦',
        };
        existing.amount += txn.amount;
        catTotals.set(cat, existing);
      }
    }
  }

  const total = Array.from(catTotals.values()).reduce((s, c) => s + c.amount, 0);
  const sorted = Array.from(catTotals.entries())
    .map(([name, { amount, color, icon }]) => ({
      name, icon, color, amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (sorted.length > 5) {
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const othersAmt = rest.reduce((s, c) => s + c.amount, 0);
    return [...top5, {
      name: 'Others', icon: '📦', color: '#6B7280',
      amount: othersAmt,
      percentage: total > 0 ? (othersAmt / total) * 100 : 0,
    }];
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Top Merchants
// ---------------------------------------------------------------------------

export interface MerchantSpend {
  name: string;
  initials: string;
  txnCount: number;
  totalAmount: number;
  color: string;
}

const MERCHANT_COLORS = ['#5B8DEF', '#4ecb8a', '#ff6b6b', '#a78bfa', '#4ecfcf'];

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getTopMerchants(
  cards: CreditCard[],
  statements: Record<string, StatementData[]>,
  period: Period,
  cardFilter?: string | null,
  currencyFilter?: CurrencyCode,
): MerchantSpend[] {
  const filtered = currencyFilter
    ? cards.filter((c) => (c.currency || 'INR') === currencyFilter)
    : cards;
  const cardIds = cardFilter
    ? new Set([cardFilter])
    : new Set(filtered.map((c) => c.id));

  const merchantMap = new Map<string, { count: number; total: number }>();

  for (const card of filtered) {
    if (!cardIds.has(card.id)) continue;
    for (const stmt of (statements[card.id] || [])) {
      const sp = stmt.summary?.statement_period;
      const stmtMonth = sp?.to ? sp.to.slice(0, 7) : stmt.parsedAt?.slice(0, 7);
      if (!stmtMonth || stmtMonth < period.startMonth || stmtMonth > period.endMonth) continue;

      for (const txn of stmt.transactions) {
        if (txn.type !== 'debit') continue;
        const name = txn.description.trim();
        if (!name) continue;
        // Normalize: strip trailing reference numbers
        const normalized = name.replace(/\s+\d{4,}.*$/, '').replace(/\s+#.*$/, '').trim() || name;
        const existing = merchantMap.get(normalized) || { count: 0, total: 0 };
        existing.count++;
        existing.total += txn.amount;
        merchantMap.set(normalized, existing);
      }
    }
  }

  return Array.from(merchantMap.entries())
    .map(([name, { count, total }], idx) => ({
      name,
      initials: getInitials(name),
      txnCount: count,
      totalAmount: total,
      color: MERCHANT_COLORS[idx % MERCHANT_COLORS.length],
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Spending Insights (auto-generated)
// ---------------------------------------------------------------------------

export interface SpendingInsight {
  type: 'spike' | 'trend' | 'best_month';
  label: string;
  text: string;
  highlightColor: string;
}

export function generateInsights(
  trendData: MonthlyTrendPoint[],
  categories: CategoryBreakdown[],
  stats: SummaryStats,
): SpendingInsight[] {
  const insights: SpendingInsight[] = [];
  const avg = stats.monthlyAverage;
  if (avg <= 0) return insights;

  // Spike: month significantly above average
  if (stats.peakMonth && stats.peakMonth.amount > avg * 1.3) {
    const pctAbove = ((stats.peakMonth.amount - avg) / avg * 100).toFixed(0);
    const topCats = categories.slice(0, 2).map((c) => c.name).join(' and ');
    insights.push({
      type: 'spike',
      label: '↑ Unusual spike',
      text: `${stats.peakMonth.label} was ${pctAbove}% above your monthly average.${topCats ? ` ${topCats} were the biggest drivers.` : ''}`,
      highlightColor: '#ff6b6b',
    });
  }

  // Trend: compare last 3 months vs prior 3 months
  if (trendData.length >= 6) {
    const recent = trendData.slice(-3);
    const prior = trendData.slice(-6, -3);
    const recentTotal = recent.reduce((s, d) => s + d.amount, 0);
    const priorTotal = prior.reduce((s, d) => s + d.amount, 0);
    if (priorTotal > 0) {
      const changePct = ((recentTotal - priorTotal) / priorTotal) * 100;
      if (Math.abs(changePct) > 15) {
        const dir = changePct > 0 ? 'increased' : 'decreased';
        insights.push({
          type: 'trend',
          label: changePct > 0 ? '📈 Spending trend' : '📉 Spending trend',
          text: `Overall spending has ${dir} ${Math.abs(changePct).toFixed(0)}% over the last 3 months compared to the 3 months prior.`,
          highlightColor: changePct > 0 ? '#ff6b6b' : '#4ecb8a',
        });
      }
    }
  }

  // Best month: lowest spend
  if (stats.lowestMonth && stats.lowestMonth.amount < avg * 0.9) {
    const pctBelow = ((avg - stats.lowestMonth.amount) / avg * 100).toFixed(0);
    insights.push({
      type: 'best_month',
      label: '✓ Best month',
      text: `${stats.lowestMonth.label} was your lowest spend month — ${pctBelow}% below your yearly average.`,
      highlightColor: '#4ecb8a',
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Compact currency formatting for chart axes
// ---------------------------------------------------------------------------

export function formatCompact(amount: number, currency: CurrencyCode = 'INR'): string {
  const sym = CURRENCY_CONFIG[currency]?.symbol || '₹';
  if (amount >= 10000000) return `${sym}${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `${sym}${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${sym}${Math.round(amount / 1000)}k`;
  return `${sym}${Math.round(amount)}`;
}

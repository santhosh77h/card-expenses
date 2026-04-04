import type { Transaction, StatementData } from '../store';
import type { CurrencyCode } from '../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MerchantData {
  name: string;
  initials: string;
  txnCount: number;
  totalAmount: number;
  maxAmount: number;
  minAmount: number;
  color: string;
  transactions: Transaction[];
}

export interface MerchantStats {
  totalSpend: Record<string, number>;
  txnCount: number;
  max: { amount: number; description: string; date: string } | null;
  min: { amount: number; description: string; date: string } | null;
}

export interface DaySection {
  date: string;
  totals: Record<string, number>;
  data: Transaction[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MERCHANT_COLORS = [
  '#5B8DEF', '#4ecb8a', '#ff6b6b', '#a78bfa', '#4ecfcf',
  '#FF9F43', '#60A5FA', '#34D399', '#FBBF24', '#F472B6',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizeMerchantName(description: string): string {
  const name = description.trim();
  if (!name) return name;
  return name.replace(/\s+\d{4,}.*$/, '').replace(/\s+#.*$/, '').trim() || name;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function merchantColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return MERCHANT_COLORS[Math.abs(hash) % MERCHANT_COLORS.length];
}

// ---------------------------------------------------------------------------
// Core: get all merchants from both data sources
// ---------------------------------------------------------------------------

export function getAllMerchants(
  manualTransactions: Transaction[],
  statements: Record<string, StatementData[]>,
  _defaultCurrency: CurrencyCode,
): MerchantData[] {
  const merchantMap = new Map<string, {
    count: number;
    total: number;
    max: number;
    min: number;
    transactions: Transaction[];
  }>();
  const seenIds = new Set<string>();

  function processTxn(txn: Transaction) {
    if (txn.type !== 'debit') return;
    const raw = txn.description?.trim();
    if (!raw) return;
    const normalized = normalizeMerchantName(raw);
    const existing = merchantMap.get(normalized) ?? {
      count: 0,
      total: 0,
      max: -Infinity,
      min: Infinity,
      transactions: [],
    };
    existing.count++;
    existing.total += txn.amount;
    if (txn.amount > existing.max) existing.max = txn.amount;
    if (txn.amount < existing.min) existing.min = txn.amount;
    existing.transactions.push(txn);
    merchantMap.set(normalized, existing);
  }

  // 1. Manual transactions first (includes imported statement txns)
  for (const txn of manualTransactions) {
    seenIds.add(txn.id);
    processTxn(txn);
  }

  // 2. Statement transactions — skip if already seen (dedup)
  for (const stmts of Object.values(statements)) {
    for (const stmt of stmts) {
      for (const txn of stmt.transactions) {
        if (seenIds.has(txn.id)) continue;
        seenIds.add(txn.id);
        processTxn(txn);
      }
    }
  }

  return Array.from(merchantMap.entries())
    .map(([name, data]) => ({
      name,
      initials: getInitials(name),
      txnCount: data.count,
      totalAmount: data.total,
      maxAmount: data.max === -Infinity ? 0 : data.max,
      minAmount: data.min === Infinity ? 0 : data.min,
      color: merchantColor(name),
      transactions: data.transactions.sort((a, b) => b.date.localeCompare(a.date)),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

// ---------------------------------------------------------------------------
// Stats for selected merchants
// ---------------------------------------------------------------------------

export function computeMerchantStats(
  merchants: MerchantData[],
  defaultCurrency: CurrencyCode,
): MerchantStats {
  let globalMax: MerchantStats['max'] = null;
  let globalMin: MerchantStats['min'] = null;
  const totals: Record<string, number> = {};
  let count = 0;

  for (const m of merchants) {
    count += m.txnCount;
    for (const txn of m.transactions) {
      const cur = txn.currency ?? defaultCurrency;
      if (!totals[cur]) totals[cur] = 0;
      totals[cur] += txn.amount;

      if (!globalMax || txn.amount > globalMax.amount) {
        globalMax = { amount: txn.amount, description: txn.description, date: txn.date };
      }
      if (!globalMin || txn.amount < globalMin.amount) {
        globalMin = { amount: txn.amount, description: txn.description, date: txn.date };
      }
    }
  }

  return { totalSpend: totals, txnCount: count, max: globalMax, min: globalMin };
}

// ---------------------------------------------------------------------------
// Date-grouped sections for selected merchants
// ---------------------------------------------------------------------------

export function buildDaySections(
  merchants: MerchantData[],
  defaultCurrency: CurrencyCode,
): DaySection[] {
  const allTxns: Transaction[] = [];
  for (const m of merchants) {
    allTxns.push(...m.transactions);
  }

  // Dedup by ID (in case merchants share transactions — unlikely but safe)
  const seen = new Set<string>();
  const unique: Transaction[] = [];
  for (const txn of allTxns) {
    if (seen.has(txn.id)) continue;
    seen.add(txn.id);
    unique.push(txn);
  }

  const grouped: Record<string, Transaction[]> = {};
  for (const txn of unique) {
    const day = txn.date.substring(0, 10);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(txn);
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => {
      const totals: Record<string, number> = {};
      for (const t of data) {
        const cur = t.currency ?? defaultCurrency;
        if (!totals[cur]) totals[cur] = 0;
        totals[cur] += t.type === 'debit' ? t.amount : -t.amount;
      }
      return { date, totals, data };
    });
}

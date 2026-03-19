import { NativeModules, Platform } from 'react-native';
import type { CurrencyCode } from '../theme';
import { categoryColors } from '../theme';
import type { CreditCard, MonthlyUsage, StatementData } from '../store';

// ---------------------------------------------------------------------------
// Widget data JSON schema
// ---------------------------------------------------------------------------

interface WidgetData {
  lastUpdated: string;
  defaultCurrency: CurrencyCode;
  currentMonth: {
    month: string; // "YYYY-MM"
    totalSpend: number;
    totalCredits: number;
    net: number;
    currency: CurrencyCode;
  };
  topCategories: Array<{
    name: string;
    amount: number;
    color: string; // hex
    percentage: number; // 0-100
  }>;
  cards: Array<{
    id: string;
    nickname: string;
    last4: string;
    currency: CurrencyCode;
    currentMonthSpend: number;
  }>;
}

// ---------------------------------------------------------------------------
// Native module interface
// ---------------------------------------------------------------------------

interface VectorWidgetBridgeModule {
  writeSharedData(json: string): Promise<void>;
  reloadWidgets(): Promise<void>;
}

const NativeBridge: VectorWidgetBridgeModule | null =
  NativeModules.VectorWidgetBridge ?? null;

// ---------------------------------------------------------------------------
// Build widget snapshot from Zustand state
// ---------------------------------------------------------------------------

function buildWidgetData(
  cards: CreditCard[],
  monthlyUsage: MonthlyUsage[],
  statements: Record<string, StatementData[]>,
  defaultCurrency: CurrencyCode,
): WidgetData {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Aggregate current month totals from monthlyUsage
  const currentMonthEntries = monthlyUsage.filter((u) => u.month === currentMonthKey);
  const totalSpend = currentMonthEntries.reduce((sum, u) => sum + u.totalDebits, 0);
  const totalCredits = currentMonthEntries.reduce((sum, u) => sum + u.totalCredits, 0);
  const net = currentMonthEntries.reduce((sum, u) => sum + u.net, 0);

  // Build category breakdown from all statements for current month
  const categoryTotals: Record<string, number> = {};
  for (const cardId of Object.keys(statements)) {
    for (const stmt of statements[cardId] || []) {
      const stmtMonth = stmt.summary.statement_period.to?.slice(0, 7);
      if (stmtMonth !== currentMonthKey) continue;
      for (const [cat, summary] of Object.entries(stmt.summary.categories)) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + summary.total;
      }
    }
  }

  const totalCategorySpend = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, amount]) => ({
      name,
      amount: Math.round(amount * 100) / 100,
      color: categoryColors[name] || '#6B7280',
      percentage: totalCategorySpend > 0 ? Math.round((amount / totalCategorySpend) * 100) : 0,
    }));

  // Per-card current month spend
  const cardData = cards.map((card) => {
    const usage = currentMonthEntries.find((u) => u.cardId === card.id);
    return {
      id: card.id,
      nickname: card.nickname,
      last4: card.last4,
      currency: (card.currency || defaultCurrency) as CurrencyCode,
      currentMonthSpend: usage?.totalDebits ?? 0,
    };
  });

  return {
    lastUpdated: new Date().toISOString(),
    defaultCurrency,
    currentMonth: {
      month: currentMonthKey,
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      net: Math.round(net * 100) / 100,
      currency: defaultCurrency,
    },
    topCategories,
    cards: cardData,
  };
}

// ---------------------------------------------------------------------------
// Public API - call after state mutations
// ---------------------------------------------------------------------------

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced sync: writes widget-data.json to shared storage and reloads widgets.
 * Safe to call frequently - batches rapid mutations into a single write.
 */
export function syncWidgetData(
  cards: CreditCard[],
  monthlyUsage: MonthlyUsage[],
  statements: Record<string, StatementData[]>,
  defaultCurrency: CurrencyCode,
): void {
  if (!NativeBridge) return; // no native module (e.g., Expo Go)

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const data = buildWidgetData(cards, monthlyUsage, statements, defaultCurrency);
      await NativeBridge!.writeSharedData(JSON.stringify(data));
      await NativeBridge!.reloadWidgets();
    } catch (e) {
      console.warn('[WidgetBridge] sync failed:', e);
    }
  }, 500);
}

/**
 * Convenience: pull current state from the store and sync.
 * Import useStore lazily to avoid circular dependency.
 */
export function syncWidgetDataFromStore(): void {
  // Lazy import to avoid circular dependency with store
  const { useStore } = require('../store');
  const state = useStore.getState();
  syncWidgetData(
    state.cards,
    state.monthlyUsage,
    state.statements,
    state.defaultCurrency,
  );
}

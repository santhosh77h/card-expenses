import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  spacing,
  borderRadius,
  fontSize,
  formatCurrency,
  formatDate,
  dateFormatForCurrency,
  categoryColors,
  CurrencyCode,
} from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore } from '../store';
import { ProgressBar } from './ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StructuredAnswerProps {
  intent: string;
  answer: string;
  rows?: Record<string, any>[];
}

// ---------------------------------------------------------------------------
// Transaction List — list_transactions / transactions_on_date
// ---------------------------------------------------------------------------

function TransactionListView({ rows }: { rows: Record<string, any>[] }) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { defaultCurrency } = useStore();
  const visible = rows.slice(0, 10);
  const remaining = rows.length - visible.length;

  return (
    <View style={s.listContainer}>
      {visible.map((r, i) => {
        const currency = (r.currency as CurrencyCode) ?? defaultCurrency;
        const isCredit = r.type === 'credit';
        const amountColor = isCredit ? colors.credit : colors.debit;
        const sign = isCredit ? '+' : '-';
        const dotColor = (r.category_color as string) || categoryColors[r.category as string] || colors.textMuted;
        const dateStr = formatDate(r.date as string, dateFormatForCurrency(currency));

        return (
          <View key={r.id ?? i}>
            {i > 0 && <View style={s.separator} />}
            <View style={s.txRow}>
              <View style={[s.dot, { backgroundColor: dotColor }]} />
              <View style={s.txInfo}>
                <View style={s.txTopLine}>
                  <Text style={s.txDesc} numberOfLines={1}>
                    {r.description}
                  </Text>
                  <Text style={[s.txAmount, { color: amountColor }]} numberOfLines={1}>
                    {sign}{formatCurrency(r.amount as number, currency)}
                  </Text>
                </View>
                <View style={s.txMeta}>
                  <Text style={s.txDate} numberOfLines={1}>{dateStr}</Text>
                  {r.category ? (
                    <Text style={[s.txCategory, { color: dotColor }]} numberOfLines={1}>
                      {r.category}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        );
      })}
      {remaining > 0 && (
        <Text style={s.moreText}>and {remaining} more</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Category Spend
// ---------------------------------------------------------------------------

function CategorySpendView({ rows }: { rows: Record<string, any>[] }) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { defaultCurrency } = useStore();
  const maxTotal = Math.max(...rows.map((r) => (r.total as number) || 0), 1);

  return (
    <View style={s.listContainer}>
      {rows.map((r, i) => {
        const category = r.category as string;
        const total = (r.total as number) || 0;
        const count = (r.count as number) || 0;
        const currency = (r.currency as CurrencyCode) ?? defaultCurrency;
        const catColor = categoryColors[category] || colors.textMuted;

        return (
          <View key={category ?? i}>
            {i > 0 && <View style={s.separator} />}
            <View style={s.catRow}>
              <View style={s.catHeader}>
                <View style={s.catLeft}>
                  <View style={[s.dot, { backgroundColor: catColor }]} />
                  <Text style={s.catName}>{category}</Text>
                </View>
                <Text style={s.catAmount}>{formatCurrency(total, currency)}</Text>
              </View>
              <View style={s.catBar}>
                <ProgressBar
                  progress={total / maxTotal}
                  color={catColor}
                  height={4}
                />
                <Text style={s.catCount}>{count} txn{count !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Monthly Summary
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_LABELS[idx] ?? month} ${year}`;
}

function MonthlySummaryView({ rows }: { rows: Record<string, any>[] }) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { defaultCurrency } = useStore();

  return (
    <View style={s.listContainer}>
      {rows.map((r, i) => {
        const month = r.month as string;
        const total = (r.total as number) || 0;
        const count = (r.count as number) || 0;
        const currency = (r.currency as CurrencyCode) ?? defaultCurrency;

        return (
          <View key={month ?? i}>
            {i > 0 && <View style={s.separator} />}
            <View style={s.monthRow}>
              <View style={s.monthLeft}>
                <Feather name="calendar" size={14} color={colors.accent} />
                <Text style={s.monthLabel}>{formatMonth(month)}</Text>
              </View>
              <View style={s.monthRight}>
                <Text style={s.monthAmount}>{formatCurrency(total, currency)}</Text>
                <Text style={s.monthCount}>{count} txn{count !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const RICH_INTENTS: Record<string, React.FC<{ rows: Record<string, any>[] }>> = {
  list_transactions: TransactionListView,
  transactions_on_date: TransactionListView,
  category_spend: CategorySpendView,
  monthly_summary: MonthlySummaryView,
  compare_months: MonthlySummaryView,
  top_category: CategorySpendView,
  unusual_spend: TransactionListView,
};

export function StructuredAnswer({ intent, answer, rows }: StructuredAnswerProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const Renderer = RICH_INTENTS[intent];
  if (Renderer && rows && rows.length > 0) {
    return <Renderer rows={rows} />;
  }
  return <Text style={s.plainAnswer}>{answer}</Text>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  listContainer: {
    gap: 0,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  plainAnswer: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    lineHeight: 22,
  },

  // Transaction list
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  txDesc: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  txMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  txDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  txCategory: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    lineHeight: 16,
  },
  txAmount: {
    flexShrink: 0,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 20,
  },

  // Category spend
  catRow: {
    gap: spacing.xs,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  catName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  catAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  catBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: 16, // align with text after dot
  },
  catCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  // Monthly summary
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  monthLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  monthRight: {
    alignItems: 'flex-end',
  },
  monthAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  monthCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  // More footer
  moreText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

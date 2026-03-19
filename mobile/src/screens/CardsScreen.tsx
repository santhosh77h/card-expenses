import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, fontSize, formatCurrency, CURRENCY_CONFIG, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, CreditCard } from '../store';
import { EmptyState } from '../components/ui';
import TrendLineChart from '../components/charts/TrendLineChart';
import DonutChart from '../components/charts/DonutChart';
import {
  getAvailableMonths,
  getActiveCurrencies,
  getLatestPeriod,
  navigatePeriod,
  canNavigatePeriod,
  get12MonthTrend,
  getSummaryStats,
  getCardChipSummaries,
  getTopCategories,
  getTopMerchants,
  generateInsights,
  type Period,
} from '../utils/cardAnalytics';
import type { StatementData, MonthlyUsage } from '../store';

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function CardsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cards, statements, monthlyUsage } = useStore();

  const hasData = useMemo(() => getAvailableMonths(monthlyUsage).length > 0, [monthlyUsage]);

  // Multi-currency
  const activeCurrencies = useMemo(
    () => getActiveCurrencies(cards, monthlyUsage),
    [cards, monthlyUsage],
  );
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode | undefined>(undefined);
  const effectiveCurrency = currencyFilter || activeCurrencies[0] || 'INR';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Cards</Text>
        <Text style={styles.subtitle}>12-month overview</Text>
      </View>

      <AnalyticsView
        cards={cards}
        statements={statements}
        monthlyUsage={monthlyUsage}
        hasData={hasData}
        activeCurrencies={activeCurrencies}
        effectiveCurrency={effectiveCurrency}
        onChangeCurrency={setCurrencyFilter}
      />

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Analytics View - 12-Month Overview with 7 Sections
// ---------------------------------------------------------------------------

function AnalyticsView({
  cards,
  statements,
  monthlyUsage,
  hasData,
  activeCurrencies,
  effectiveCurrency,
  onChangeCurrency,
}: {
  cards: CreditCard[];
  statements: Record<string, StatementData[]>;
  monthlyUsage: MonthlyUsage[];
  hasData: boolean;
  activeCurrencies: CurrencyCode[];
  effectiveCurrency: CurrencyCode;
  onChangeCurrency: (c: CurrencyCode | undefined) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const currencyArg = activeCurrencies.length > 1 ? effectiveCurrency : undefined;
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Period state
  const initialPeriod = useMemo(() => getLatestPeriod(monthlyUsage), [monthlyUsage]);
  const [period, setPeriod] = useState<Period | null>(initialPeriod);

  // Keep period in sync if data changes and no period set
  const effectivePeriod = period || initialPeriod;

  // All analytics computed from the period
  const trendData = useMemo(
    () => effectivePeriod ? get12MonthTrend(cards, monthlyUsage, effectivePeriod, selectedCardId, currencyArg) : [],
    [cards, monthlyUsage, effectivePeriod, selectedCardId, currencyArg],
  );

  const stats = useMemo(() => getSummaryStats(trendData), [trendData]);

  const chipSummaries = useMemo(
    () => effectivePeriod ? getCardChipSummaries(cards, monthlyUsage, effectivePeriod, currencyArg) : [],
    [cards, monthlyUsage, effectivePeriod, currencyArg],
  );

  const categories = useMemo(
    () => effectivePeriod ? getTopCategories(cards, statements, effectivePeriod, selectedCardId, currencyArg) : [],
    [cards, statements, effectivePeriod, selectedCardId, currencyArg],
  );

  const merchants = useMemo(
    () => effectivePeriod ? getTopMerchants(cards, statements, effectivePeriod, selectedCardId, currencyArg) : [],
    [cards, statements, effectivePeriod, selectedCardId, currencyArg],
  );

  const insights = useMemo(
    () => generateInsights(trendData, categories, stats),
    [trendData, categories, stats],
  );

  if (!hasData || !effectivePeriod) {
    return (
      <View style={{ marginTop: spacing.xxxl }}>
        <EmptyState
          icon="bar-chart-2"
          title="No analytics yet"
          subtitle="Upload a credit card statement to see spending insights and card comparisons."
        />
      </View>
    );
  }

  const canPrev = canNavigatePeriod(effectivePeriod, 'prev', monthlyUsage);
  const canNext = canNavigatePeriod(effectivePeriod, 'next', monthlyUsage);

  return (
    <>
      {/* 1. Period Selector */}
      <View style={styles.periodRow}>
        <TouchableOpacity
          onPress={() => canPrev && setPeriod(navigatePeriod(effectivePeriod, 'prev'))}
          style={styles.periodBtn}
          disabled={!canPrev}
        >
          <Feather name="chevron-left" size={20} color={canPrev ? colors.textSecondary : colors.border} />
        </TouchableOpacity>
        <Text style={styles.periodLabel}>{effectivePeriod.label}</Text>
        <TouchableOpacity
          onPress={() => canNext && setPeriod(navigatePeriod(effectivePeriod, 'next'))}
          style={styles.periodBtn}
          disabled={!canNext}
        >
          <Feather name="chevron-right" size={20} color={canNext ? colors.textSecondary : colors.border} />
        </TouchableOpacity>
      </View>

      {/* Currency filter */}
      {activeCurrencies.length > 1 && (
        <View style={styles.currencyRow}>
          {activeCurrencies.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyChip, effectiveCurrency === c && styles.currencyChipActive]}
              onPress={() => onChangeCurrency(c)}
            >
              <Text style={[styles.currencyChipText, effectiveCurrency === c && styles.currencyChipTextActive]}>
                {CURRENCY_CONFIG[c].symbol} {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 2. Card Selector Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        {chipSummaries.map((chip) => {
          const isActive = chip.cardId === selectedCardId || (chip.cardId === null && selectedCardId === null);
          return (
            <TouchableOpacity
              key={chip.cardId ?? 'all'}
              style={[styles.cardChip, isActive ? styles.cardChipActive : styles.cardChipInactive]}
              onPress={() => setSelectedCardId(chip.cardId)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipBank}>{chip.label}</Text>
              <Text style={[styles.chipAmount, isActive && styles.chipAmountActive]}>
                {formatCurrency(chip.totalSpend, chip.currency)}
              </Text>
              {chip.changePercent !== null && (
                <Text style={[styles.chipChange, { color: chip.isUp ? colors.debit : colors.credit }]}>
                  {chip.isUp ? '\u2191' : '\u2193'} {Math.abs(chip.changePercent).toFixed(0)}% {chip.changeLabel}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. Summary Stat Boxes */}
      <View style={styles.summaryRow}>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Monthly avg</Text>
          <Text style={styles.statBoxValue}>{formatCurrency(stats.monthlyAverage, effectiveCurrency)}</Text>
          <Text style={styles.statBoxSub}>across {stats.activeMonths} months</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBoxLabel}>Peak month</Text>
          <Text style={styles.statBoxValue}>{stats.peakMonth?.label ?? '\u2014'}</Text>
          {stats.peakMonth && (
            <Text style={[styles.statBoxSub, { color: colors.debit }]}>
              {formatCurrency(stats.peakMonth.amount, effectiveCurrency)} spent
            </Text>
          )}
        </View>
      </View>

      {/* 4. 12-Month Trend Line Chart */}
      {trendData.some((d) => d.amount > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly spending trend</Text>
          <TrendLineChart
            data={trendData}
            average={stats.monthlyAverage}
            currency={effectiveCurrency}
          />
        </View>
      )}

      {/* 5. Top Spending Categories */}
      {categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Top spending categories - last {effectivePeriod.months.length} months
          </Text>

          {/* Donut chart */}
          <DonutChart
            segments={categories.map((c) => ({
              name: c.name,
              amount: c.amount,
              color: c.color,
              percentage: c.percentage,
            }))}
            currency={effectiveCurrency}
          />

          <View style={styles.divider} />

          {/* Category list */}
          {categories.map((cat) => {
            const maxPct = categories[0]?.percentage || 1;
            return (
              <View key={cat.name} style={styles.catRow12}>
                <View style={[styles.catIcon12, { backgroundColor: cat.color + '20' }]}>
                  <Text style={{ fontSize: 15 }}>{cat.icon}</Text>
                </View>
                <View style={styles.catInfo12}>
                  <Text style={styles.catName12}>{cat.name}</Text>
                  <View style={styles.catBarWrap12}>
                    <View style={[styles.catBar12, { width: `${(cat.percentage / maxPct) * 100}%`, backgroundColor: cat.color }]} />
                  </View>
                </View>
                <View style={styles.catAmountCol12}>
                  <Text style={styles.catAmount12}>{formatCurrency(cat.amount, effectiveCurrency)}</Text>
                  <Text style={styles.catPct12}>{cat.percentage.toFixed(1)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 6. Top Merchants */}
      {merchants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top merchants by spend</Text>
          {merchants.map((m, idx) => (
            <View key={m.name} style={[styles.merchantRow, idx === merchants.length - 1 && { marginBottom: 0 }]}>
              <View style={[styles.merchantAvatar, { borderColor: m.color + '40' }]}>
                <Text style={[styles.merchantInitials, { color: m.color }]}>{m.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchantName} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.merchantTxn}>{m.txnCount} transaction{m.txnCount !== 1 ? 's' : ''}</Text>
              </View>
              <Text style={styles.merchantAmount}>{formatCurrency(m.totalAmount, effectiveCurrency)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 7. Spending Insights */}
      {insights.length > 0 && (
        <View style={[styles.section, { marginBottom: 0 }]}>
          <Text style={styles.sectionTitle}>Spending insights</Text>
          {insights.map((insight, idx) => (
            <View
              key={idx}
              style={[styles.insightBox, idx === insights.length - 1 && { marginBottom: 0 }]}
            >
              <Text style={[styles.insightLabel, { color: insight.highlightColor }]}>
                {insight.label}
              </Text>
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xxxl,
    fontWeight: '600',
    lineHeight: 32,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 18,
  },

  // Period selector
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  periodBtn: {
    padding: spacing.sm,
  },
  periodLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },

  // Currency filter
  currencyRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  currencyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  currencyChipText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  currencyChipTextActive: {
    color: colors.accent,
  },

  // Card selector chips
  chipScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    marginBottom: spacing.md,
  },
  cardChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    minWidth: 140,
  },
  cardChipActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  cardChipInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipBank: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginBottom: 2,
  },
  chipAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    lineHeight: 22,
  },
  chipAmountActive: {
    color: colors.accent,
  },
  chipChange: {
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },

  // Summary stat boxes
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBoxLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  statBoxValue: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    lineHeight: 22,
  },
  statBoxSub: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },

  // Section containers
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  // Category rows (12-month view)
  catRow12: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  catIcon12: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catInfo12: {
    flex: 1,
    minWidth: 0,
  },
  catName12: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  catBarWrap12: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: spacing.xs,
  },
  catBar12: {
    height: 4,
    borderRadius: 2,
  },
  catAmountCol12: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  catAmount12: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  catPct12: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },

  // Merchant rows
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  merchantAvatar: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  merchantInitials: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  merchantName: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  merchantTxn: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  merchantAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Insight boxes
  insightBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  insightLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  insightText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },

});

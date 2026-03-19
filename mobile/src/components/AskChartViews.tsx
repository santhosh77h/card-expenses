import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  VictoryChart,
  VictoryBar,
  VictoryAxis,
} from 'victory-native';
import {
  spacing,
  fontSize,
  formatCurrency,
  categoryColors,
  chartPalette,
  CurrencyCode,
} from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore } from '../store';
import DonutChart from './charts/DonutChart';
import { formatMonth } from './AskResultViews';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ChartViewProps {
  rows: Record<string, any>[];
  containerWidth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAxisLabel(value: number): string {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return `${value}`;
}

function shortDay(dateStr: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? dateStr : days[d.getDay()];
}

// ---------------------------------------------------------------------------
// Category Donut Chart - category_spend / top_category
// ---------------------------------------------------------------------------

const CategoryDonutChartView = React.memo(function CategoryDonutChartView({
  rows,
  containerWidth,
}: ChartViewProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { defaultCurrency } = useStore();

  const total = rows.reduce((sum, r) => sum + ((r.total as number) || 0), 0);
  if (total <= 0) return null;

  const currency = (rows[0]?.currency as CurrencyCode) ?? defaultCurrency;
  const segments = rows.map((r) => {
    const cat = r.category as string;
    const amount = (r.total as number) || 0;
    return {
      name: cat,
      amount,
      color: categoryColors[cat] || colors.textMuted,
      percentage: (amount / total) * 100,
    };
  });

  const chartSize = Math.min(containerWidth - spacing.lg * 2, 200);

  return (
    <View style={s.chartContainer}>
      <DonutChart
        segments={segments}
        currency={currency}
        size={chartSize}
        strokeWidth={24}
      />
      {/* Legend */}
      <View style={s.legend}>
        {segments.map((seg) => (
          <View key={seg.name} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: seg.color }]} />
            <Text style={s.legendName} numberOfLines={1}>{seg.name}</Text>
            <Text style={s.legendPct}>{seg.percentage.toFixed(1)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Monthly Bar Chart - monthly_summary / compare_months
// ---------------------------------------------------------------------------

const MonthlyBarChartView = React.memo(function MonthlyBarChartView({
  rows,
  containerWidth,
}: ChartViewProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const data = rows.map((r) => ({
    x: formatMonth(r.month as string),
    y: (r.total as number) || 0,
  }));

  const barWidth = Math.max(
    12,
    Math.floor((containerWidth - 80) / (data.length * 2)),
  );

  return (
    <View style={s.chartContainer}>
      <VictoryChart
        width={containerWidth}
        height={220}
        padding={{ top: 16, bottom: 40, left: 54, right: 16 }}
        domainPadding={{ x: 20 }}
      >
        <VictoryAxis
          style={{
            axis: { stroke: colors.border },
            tickLabels: {
              fill: colors.textMuted,
              fontSize: 10,
              fontWeight: '500',
              angle: data.length > 4 ? -30 : 0,
            },
            grid: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={formatAxisLabel}
          style={{
            axis: { stroke: 'transparent' },
            tickLabels: { fill: colors.textMuted, fontSize: 10 },
            grid: { stroke: colors.border, strokeDasharray: '4,4' },
          }}
        />
        <VictoryBar
          data={data}
          style={{ data: { fill: colors.accent } }}
          barWidth={barWidth}
          cornerRadius={{ top: 3 }}
        />
      </VictoryChart>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Weekly Bar Chart - weekly_summary
// ---------------------------------------------------------------------------

const WeeklyBarChartView = React.memo(function WeeklyBarChartView({
  rows,
  containerWidth,
}: ChartViewProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const data = rows.map((r) => ({
    x: shortDay(r.date as string),
    y: (r.total as number) || 0,
  }));

  const barWidth = Math.max(
    14,
    Math.floor((containerWidth - 80) / (data.length * 2)),
  );

  return (
    <View style={s.chartContainer}>
      <VictoryChart
        width={containerWidth}
        height={220}
        padding={{ top: 16, bottom: 36, left: 54, right: 16 }}
        domainPadding={{ x: 20 }}
      >
        <VictoryAxis
          style={{
            axis: { stroke: colors.border },
            tickLabels: { fill: colors.textMuted, fontSize: 10, fontWeight: '500' },
            grid: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={formatAxisLabel}
          style={{
            axis: { stroke: 'transparent' },
            tickLabels: { fill: colors.textMuted, fontSize: 10 },
            grid: { stroke: colors.border, strokeDasharray: '4,4' },
          }}
        />
        <VictoryBar
          data={data}
          style={{ data: { fill: chartPalette[2] } }}
          barWidth={barWidth}
          cornerRadius={{ top: 3 }}
        />
      </VictoryChart>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Frequency Horizontal Bar Chart - frequent_merchant
// ---------------------------------------------------------------------------

const FrequencyBarChartView = React.memo(function FrequencyBarChartView({
  rows,
}: ChartViewProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const maxCount = Math.max(...rows.map((r) => (r.visit_count as number) || 0), 1);
  const visible = rows.slice(0, 8);

  return (
    <View style={s.chartContainer}>
      {visible.map((r, i) => {
        const name = r.description as string;
        const count = (r.visit_count as number) || 0;
        const progress = count / maxCount;
        const barColor = chartPalette[i % chartPalette.length];

        return (
          <View key={name ?? i} style={s.hBarRow}>
            <Text style={s.hBarLabel} numberOfLines={1}>
              {name}
            </Text>
            <View style={s.hBarTrack}>
              <View
                style={[
                  s.hBarFill,
                  {
                    width: `${Math.max(progress * 100, 4)}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
            <Text style={s.hBarCount}>{count}x</Text>
          </View>
        );
      })}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Export lookup map
// ---------------------------------------------------------------------------

export const CHART_COMPONENTS: Record<string, React.FC<ChartViewProps>> = {
  category_spend: CategoryDonutChartView,
  top_category: CategoryDonutChartView,
  monthly_summary: MonthlyBarChartView,
  compare_months: MonthlyBarChartView,
  weekly_summary: WeeklyBarChartView,
  frequent_merchant: FrequencyBarChartView,
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chartContainer: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    // Horizontal bar (frequency)
    hBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      width: '100%',
    },
    hBarLabel: {
      width: 90,
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    hBarTrack: {
      flex: 1,
      height: 14,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 7,
      overflow: 'hidden',
    },
    hBarFill: {
      height: 14,
      borderRadius: 7,
    },
    hBarCount: {
      width: 30,
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'right',
      lineHeight: 16,
    },
    // Donut legend
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendName: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      lineHeight: 16,
      maxWidth: 80,
    },
    legendPct: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
  });

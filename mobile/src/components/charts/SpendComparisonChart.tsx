import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryBar,
  VictoryGroup,
  VictoryAxis,
  VictoryTheme,
} from 'victory-native';
import { spacing, fontSize, formatCurrency, CurrencyCode } from '../../theme';
import type { ThemeColors } from '../../theme';
import { useColors } from '../../hooks/useColors';
import type { MonthlySpendByCard } from '../../utils/cardAnalytics';

interface Props {
  data: MonthlySpendByCard[];
  currency: CurrencyCode;
  cardColors: Array<{ cardId: string; nickname: string; color: string }>;
}

const CHART_WIDTH = Dimensions.get('window').width - spacing.lg * 2;
const CHART_HEIGHT = 220;

export default function SpendComparisonChart({ data, currency, cardColors }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (data.length === 0 || cardColors.length === 0) return null;

  // Build per-card series data for VictoryGroup
  const seriesData = cardColors.map((card) => ({
    cardId: card.cardId,
    color: card.color,
    nickname: card.nickname,
    data: data.map((month) => {
      const spend = month.spends.find((s) => s.cardId === card.cardId);
      return { x: month.label, y: spend?.amount ?? 0 };
    }),
  }));

  // Filter out cards with zero spending in every month
  const activeSeries = seriesData.filter((s) => s.data.some((d) => d.y > 0));
  if (activeSeries.length === 0) return null;

  const maxVal = Math.max(...activeSeries.flatMap((s) => s.data.map((d) => d.y)), 1);

  const formatAxisLabel = (value: number) => {
    if (value >= 100000) return `${(value / 100000).toFixed(0)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return `${value}`;
  };

  const barWidth = Math.max(
    4,
    Math.floor((CHART_WIDTH - 80) / (data.length * activeSeries.length * 1.5)),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Spending by Card</Text>
      <VictoryChart
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        padding={{ top: 16, bottom: 36, left: 50, right: 16 }}
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
        <VictoryGroup offset={barWidth + 2}>
          {activeSeries.map((series) => (
            <VictoryBar
              key={series.cardId}
              data={series.data}
              style={{
                data: {
                  fill: series.color,
                  borderRadius: 3,
                },
              }}
              barWidth={barWidth}
              cornerRadius={{ top: 3 }}
            />
          ))}
        </VictoryGroup>
      </VictoryChart>

      {/* Legend */}
      <View style={styles.legend}>
        {activeSeries.map((s) => (
          <View key={s.cardId} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>{s.nickname}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    maxWidth: 100,
    lineHeight: 16,
  },
});

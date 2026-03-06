import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, borderRadius, fontSize, formatINR, categoryColors } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CategoryData {
  name: string;
  total: number;
  count: number;
}

interface Props {
  categories: Record<string, { total: number; count: number }>;
}

export function CategoryPieChart({ categories }: Props) {
  const data = Object.entries(categories)
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.total - a.total);

  const total = data.reduce((s, d) => s + d.total, 0);

  if (total === 0) return null;

  // Render a simple visual pie representation using stacked segments
  return (
    <View style={styles.container}>
      {/* Pie segments as a horizontal stacked bar (more reliable than SVG pie) */}
      <View style={styles.pieBar}>
        {data.map((item) => {
          const pct = (item.total / total) * 100;
          if (pct < 1) return null;
          return (
            <View
              key={item.name}
              style={{
                width: `${pct}%`,
                height: 12,
                backgroundColor: categoryColors[item.name] || colors.textMuted,
              }}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((item) => {
          const pct = ((item.total / total) * 100).toFixed(1);
          return (
            <View key={item.name} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: categoryColors[item.name] || colors.textMuted },
                ]}
              />
              <Text style={styles.legendName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.legendValue}>
                {formatINR(item.total)} ({pct}%)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function CategoryBarChart({ categories }: Props) {
  const data = Object.entries(categories)
    .map(([name, val]) => ({ name, ...val }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <View style={styles.barContainer}>
      <Text style={styles.barTitle}>Top 5 Categories</Text>
      {data.map((item) => {
        const pct = item.total / maxTotal;
        return (
          <View key={item.name} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${pct * 100}%`,
                    backgroundColor: categoryColors[item.name] || colors.textMuted,
                  },
                ]}
              />
            </View>
            <Text style={styles.barAmount}>{formatINR(item.total)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  pieBar: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  legend: {
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  legendName: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    flex: 1,
  },
  legendValue: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  barContainer: {
    marginTop: spacing.lg,
  },
  barTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  barLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    width: 80,
    textAlign: 'right',
  },
});

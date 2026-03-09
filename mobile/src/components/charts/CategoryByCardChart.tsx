import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, fontSize, formatCurrency, CurrencyCode } from '../../theme';
import type { CategoryByCardSegment } from '../../utils/cardAnalytics';

interface Props {
  data: CategoryByCardSegment[];
  currency: CurrencyCode;
}

const CHART_WIDTH = Dimensions.get('window').width - spacing.lg * 4;

export default function CategoryByCardChart({ data, currency }: Props) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Categories by Card</Text>
      <Text style={styles.subtitle}>Which card do you use most per category?</Text>

      {data.map((cat) => (
        <View key={cat.category} style={styles.row}>
          <View style={styles.labelRow}>
            <View style={[styles.catDot, { backgroundColor: cat.color }]} />
            <Text style={styles.catName} numberOfLines={1}>{cat.category}</Text>
            <Text style={styles.catAmount}>{formatCurrency(cat.total, currency)}</Text>
          </View>

          {/* Stacked bar */}
          <View style={styles.barTrack}>
            {cat.segments.map((seg, idx) => {
              const widthPct = (seg.amount / maxTotal) * 100;
              if (widthPct < 0.5) return null;
              return (
                <View
                  key={seg.cardId}
                  style={[
                    styles.barSegment,
                    {
                      width: `${widthPct}%`,
                      backgroundColor: seg.color,
                      borderTopLeftRadius: idx === 0 ? 3 : 0,
                      borderBottomLeftRadius: idx === 0 ? 3 : 0,
                      borderTopRightRadius: idx === cat.segments.length - 1 ? 3 : 0,
                      borderBottomRightRadius: idx === cat.segments.length - 1 ? 3 : 0,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Segment labels (show if > 1 card) */}
          {cat.segments.length > 1 && (
            <View style={styles.segLabels}>
              {cat.segments.map((seg) => (
                <View key={seg.cardId} style={styles.segLabel}>
                  <View style={[styles.segDot, { backgroundColor: seg.color }]} />
                  <Text style={styles.segText}>
                    {seg.nickname}: {formatCurrency(seg.amount, currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.xs,
    lineHeight: 22,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  row: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  catName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  catAmount: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  barTrack: {
    flexDirection: 'row',
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barSegment: {
    height: 12,
  },
  segLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  segLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  segText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
});

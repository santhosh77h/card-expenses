import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import type { CardSpendSummary } from '../utils/cardAnalytics';

interface Props {
  summaries: CardSpendSummary[];
  selectedCardId: string | null;
  onSelectCard: (id: string | null) => void;
}

export default function CardSummaryRow({ summaries, selectedCardId, onSelectCard }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (summaries.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* "All Cards" chip */}
      <TouchableOpacity
        style={[
          styles.card,
          !selectedCardId && styles.cardSelected,
        ]}
        onPress={() => onSelectCard(null)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Feather name="layers" size={14} color={!selectedCardId ? colors.accent : colors.textSecondary} />
          <Text style={[styles.cardTitle, !selectedCardId && styles.cardTitleSelected]}>
            All Cards
          </Text>
        </View>
        <Text style={styles.cardSpend}>
          {formatCurrency(
            summaries.reduce((s, c) => s + c.totalSpend, 0),
            summaries[0]?.currency || 'INR',
          )}
        </Text>
      </TouchableOpacity>

      {summaries.map((s) => {
        const isSelected = selectedCardId === s.cardId;
        return (
          <TouchableOpacity
            key={s.cardId}
            style={[
              styles.card,
              { borderLeftColor: s.color, borderLeftWidth: 3 },
              isSelected && [styles.cardSelected, { borderColor: s.color }],
            ]}
            onPress={() => onSelectCard(isSelected ? null : s.cardId)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, isSelected && { color: colors.textPrimary }]} numberOfLines={1}>
                {s.nickname}
              </Text>
              <Text style={styles.cardLast4}>···{s.last4}</Text>
            </View>

            <Text style={styles.cardSpend}>
              {formatCurrency(s.totalSpend, s.currency)}
            </Text>

            {/* Proportion bar */}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(s.proportionOfTotal * 100, 2)}%`,
                    backgroundColor: s.color,
                  },
                ]}
              />
            </View>

            {/* MoM change */}
            {s.momChange !== null && (
              <View style={styles.momRow}>
                <Feather
                  name={s.momChange >= 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={s.momChange >= 0 ? colors.debit : colors.credit}
                />
                <Text
                  style={[
                    styles.momText,
                    { color: s.momChange >= 0 ? colors.debit : colors.credit },
                  ]}
                >
                  {Math.abs(s.momChange).toFixed(0)}% vs last mo
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: 160,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  cardTitleSelected: {
    color: colors.accent,
  },
  cardLast4: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  cardSpend: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
    lineHeight: 26,
  },
  barTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing.xs,
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  momRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  momText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    lineHeight: 16,
  },
});

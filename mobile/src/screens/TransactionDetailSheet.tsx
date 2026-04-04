import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, borderRadius, fontSize, formatCurrency, formatDate, dateFormatForCurrency, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction } from '../store';
import { Badge } from '../components/ui';
import { getTransactionsByMerchant } from '../db/transactions';
import type { RootStackParamList } from '../navigation';

type DetailRoute = RouteProp<RootStackParamList, 'TransactionDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TransactionDetailSheet() {
  const { params } = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { enrichments, cards, defaultCurrency, transactionLabels, labels } = useStore();

  const transaction = params.transaction;
  const card = transaction.cardId ? cards.find((c) => c.id === transaction.cardId) : undefined;
  const enrichment = enrichments[transaction.id];
  const currency: CurrencyCode = transaction.currency ?? card?.currency ?? defaultCurrency;
  const resolvedDateFormat = dateFormatForCurrency(currency);
  const isFlagged = enrichment?.flagged ?? false;
  const txnLabelIds = transactionLabels[transaction.id] ?? [];
  const txnLabels = txnLabelIds.map((id) => labels.find((l) => l.id === id)).filter(Boolean);

  // Merchant history
  const merchantHistory = useMemo(
    () => getTransactionsByMerchant(transaction.description, transaction.id, 10),
    [transaction.id, transaction.description],
  );

  // Header right button
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('EditTransaction', { transactionId: transaction.id })}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '500' }}>Edit</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, transaction.id, colors]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero section */}
      <View style={styles.heroCard}>
        {/* Category icon + description */}
        <View style={styles.heroTop}>
          <View style={[styles.categoryIcon, { backgroundColor: transaction.category_color + '20' }]}>
            <Feather name={transaction.category_icon as any || 'tag'} size={22} color={transaction.category_color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.description} numberOfLines={2}>{transaction.description}</Text>
            {transaction.isEdited && (
              <View style={styles.editedPill}>
                <Text style={styles.editedPillText}>edited</Text>
              </View>
            )}
          </View>
        </View>

        {/* Amount */}
        <Text style={[styles.amount, { color: transaction.type === 'debit' ? colors.debit : colors.credit }]}>
          {transaction.type === 'debit' ? '-' : '+'}
          {formatCurrency(transaction.amount, currency)}
        </Text>
        <Text style={styles.amountType}>{transaction.type === 'debit' ? 'Debit' : 'Credit'}</Text>

        {/* Details */}
        <View style={styles.divider} />
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Feather name="calendar" size={16} color={colors.accent} />
          </View>
          <Text style={styles.detailText}>{formatDate(transaction.date, resolvedDateFormat)}</Text>
        </View>
        {card && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Feather name="credit-card" size={16} color={colors.accent} />
            </View>
            <View style={[styles.cardDot, { backgroundColor: card.color }]} />
            <Text style={styles.detailText}>{card.nickname} {'\u00B7'}{card.last4}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Feather name="tag" size={16} color={colors.accent} />
          </View>
          <Badge text={transaction.category} color={transaction.category_color} />
        </View>

        {/* Indicators */}
        {(isFlagged || !!enrichment?.notes || !!enrichment?.receiptUri || txnLabels.length > 0) && (
          <>
            <View style={styles.divider} />
            <View style={styles.indicatorRow}>
              {isFlagged && (
                <View style={styles.indicator}>
                  <Feather name="star" size={12} color={colors.warning} />
                  <Text style={[styles.indicatorText, { color: colors.warning }]}>Flagged</Text>
                </View>
              )}
              {!!enrichment?.notes && (
                <View style={styles.indicator}>
                  <Feather name="file-text" size={12} color={colors.textMuted} />
                  <Text style={styles.indicatorText}>Has notes</Text>
                </View>
              )}
              {!!enrichment?.receiptUri && (
                <View style={styles.indicator}>
                  <Feather name="camera" size={12} color={colors.textMuted} />
                  <Text style={styles.indicatorText}>Receipt</Text>
                </View>
              )}
            </View>
            {txnLabels.length > 0 && (
              <View style={styles.labelRow}>
                {txnLabels.map((label) => label && (
                  <View key={label.id} style={[styles.labelChip, { backgroundColor: label.color + '20' }]}>
                    <Text style={[styles.labelChipText, { color: label.color }]}>{label.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {/* Merchant history */}
      <Text style={styles.sectionLabel}>
        {merchantHistory.length > 0 ? 'Previous with this merchant' : 'Merchant history'}
      </Text>
      <View style={styles.surfaceCard}>
        {merchantHistory.length > 0 ? (
          merchantHistory.map((txn, idx) => (
            <React.Fragment key={txn.id}>
              {idx > 0 && <View style={styles.itemDivider} />}
              <TouchableOpacity
                style={styles.historyItem}
                onPress={() => {
                  const historyCard = txn.cardId ? cards.find((c) => c.id === txn.cardId) : undefined;
                  navigation.push('TransactionDetail', { transaction: txn, cardId: historyCard?.id });
                }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDate}>
                    {formatDate(txn.date, resolvedDateFormat)}
                  </Text>
                </View>
                <Text style={[styles.historyAmount, { color: txn.type === 'debit' ? colors.debit : colors.credit }]}>
                  {txn.type === 'debit' ? '-' : '+'}
                  {formatCurrency(txn.amount, txn.currency ?? currency)}
                </Text>
                <Text style={styles.chevron}>{'\u203A'}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))
        ) : (
          <View style={styles.emptyHistory}>
            <Feather name="clock" size={16} color={colors.textMuted} />
            <Text style={styles.emptyHistoryText}>First transaction with this merchant</Text>
          </View>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Hero card
  heroCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  editedPill: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  editedPillText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
  },
  amountType: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: -spacing.lg,
    marginVertical: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '400',
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: -4,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  labelChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: 12,
  },
  labelChipText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    letterSpacing: 0.1,
  },

  // Grouped surface card
  surfaceCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 14,
    marginRight: 14,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  historyDate: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '400',
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 16,
    color: colors.textMuted,
    marginLeft: 2,
  },
  emptyHistory: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

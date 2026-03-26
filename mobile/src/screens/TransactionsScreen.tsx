import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { spacing, borderRadius, fontSize, formatCurrency, formatDate, dateFormatForCurrency, categoryColors, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction, CreditCard } from '../store';
import { Badge, EmptyState, PrimaryButton } from '../components/ui';
import TransactionDetailModal from '../components/TransactionDetailModal';
import DailySpendingChart from '../components/DailySpendingChart';
import MonthSelector from '../components/MonthSelector';
import type { RootStackParamList, TabParamList } from '../navigation';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Transactions'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function TransactionsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cards, manualTransactions, enrichments, defaultCurrency, updateManualTransaction } = useStore();
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [enrichmentFilter, setEnrichmentFilter] = useState<'flagged' | 'notes' | 'receipt' | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);

  const cardMap = useMemo(() => {
    const map: Record<string, CreditCard> = {};
    for (const c of cards) map[c.id] = c;
    return map;
  }, [cards]);

  const allCategories = useMemo(() => {
    const cats = new Set(manualTransactions.map((t) => t.category));
    return Array.from(cats).sort();
  }, [manualTransactions]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const t of manualTransactions) {
      months.add(t.date.substring(0, 7));
    }
    return Array.from(months).sort().reverse();
  }, [manualTransactions]);

  // Default to newest month on first load
  useEffect(() => {
    if (monthFilter === null && availableMonths.length > 0) {
      setMonthFilter(availableMonths[0]);
    }
  }, [availableMonths]);

  // Handle stale monthFilter (e.g. all transactions in that month deleted)
  const effectiveMonth = monthFilter === null
    ? null
    : availableMonths.includes(monthFilter)
      ? monthFilter
      : availableMonths[0] ?? null;

  // Sync state if effectiveMonth differs
  useEffect(() => {
    if (monthFilter !== null && effectiveMonth !== monthFilter) {
      setMonthFilter(effectiveMonth);
    }
  }, [effectiveMonth, monthFilter]);

  const usedCards = useMemo(() => {
    const ids = new Set(manualTransactions.map((t) => t.cardId).filter(Boolean));
    return Array.from(ids).map((id) => cardMap[id!]).filter(Boolean) as CreditCard[];
  }, [manualTransactions, cardMap]);

  const filteredTransactions = useMemo(() => {
    let result = [...manualTransactions];
    if (effectiveMonth) {
      result = result.filter((t) => t.date.startsWith(effectiveMonth));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (cardFilter !== null) {
      if (cardFilter === '__none__') {
        result = result.filter((t) => !t.cardId);
      } else {
        result = result.filter((t) => t.cardId === cardFilter);
      }
    }
    if (enrichmentFilter) {
      result = result.filter((t) => {
        const e = enrichments[t.id];
        if (!e) return false;
        if (enrichmentFilter === 'flagged') return e.flagged;
        if (enrichmentFilter === 'notes') return !!e.notes;
        if (enrichmentFilter === 'receipt') return !!e.receiptUri;
        return false;
      });
    }
    result.sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount;
      return b.date.localeCompare(a.date);
    });
    return result;
  }, [manualTransactions, effectiveMonth, searchQuery, categoryFilter, cardFilter, enrichmentFilter, sortBy, enrichments]);

  const selectedIdx = selectedTxn
    ? filteredTransactions.findIndex((t) => t.id === selectedTxn.id)
    : -1;
  const handlePrev = selectedIdx > 0
    ? () => setSelectedTxn(filteredTransactions[selectedIdx - 1])
    : undefined;
  const handleNext = selectedIdx >= 0 && selectedIdx < filteredTransactions.length - 1
    ? () => setSelectedTxn(filteredTransactions[selectedIdx + 1])
    : undefined;

  // Group totals by currency (month-scoped via filteredTransactions)
  const totals = useMemo(() => {
    const byCurrency: Record<string, { debits: number; credits: number }> = {};
    for (const t of filteredTransactions) {
      const cur = t.currency ?? (t.cardId ? cardMap[t.cardId]?.currency : undefined) ?? defaultCurrency;
      if (!byCurrency[cur]) byCurrency[cur] = { debits: 0, credits: 0 };
      if (t.type === 'debit') byCurrency[cur].debits += t.amount;
      else byCurrency[cur].credits += t.amount;
    }
    return byCurrency;
  }, [filteredTransactions, cardMap]);
  const totalCurrencies = Object.keys(totals) as CurrencyCode[];

  const chartData = useMemo(() => {
    if (!effectiveMonth) return null;
    const source = manualTransactions.filter((t) => t.date.startsWith(effectiveMonth));
    const [year, month] = effectiveMonth.split('-').map(Number);
    const daysInRange = new Date(year, month, 0).getDate();

    const debitMap: Record<number, number> = {};
    for (const t of source) {
      if (t.type !== 'debit') continue;
      const day = parseInt(t.date.substring(8, 10), 10);
      debitMap[day] = (debitMap[day] || 0) + t.amount;
    }

    const debitsByDay = Object.entries(debitMap)
      .map(([d, a]) => ({ day: Number(d), amount: a }))
      .sort((a, b) => a.day - b.day);

    return { debitsByDay, daysInRange };
  }, [manualTransactions, effectiveMonth]);

  const renderItem = useCallback(({ item }: { item: Transaction }) => {
    const txnCard = item.cardId ? cardMap[item.cardId] : undefined;
    const enrichment = enrichments[item.id];
    return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => setSelectedTxn(item)}
    >
      <View style={[styles.dot, { backgroundColor: item.category_color }]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowDesc} numberOfLines={1}>
          {item.description}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowDate}>{formatDate(item.date, dateFormatForCurrency(item.currency ?? txnCard?.currency ?? defaultCurrency))}</Text>
          <Badge text={item.category} color={item.category_color} />
          {txnCard && (
            <View style={styles.cardTag}>
              <View style={[styles.cardTagDot, { backgroundColor: txnCard.color }]} />
              <Text style={styles.cardTagText}>{txnCard.nickname}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.rowAmount,
            { color: item.type === 'debit' ? colors.debit : colors.credit },
          ]}
        >
          {item.type === 'debit' ? '-' : '+'}
          {formatCurrency(item.amount, item.currency ?? txnCard?.currency ?? defaultCurrency)}
        </Text>
        {/* Enrichment indicators */}
        <View style={styles.indicators}>
          {enrichment?.flagged && (
            <Feather name="star" size={11} color={colors.warning} />
          )}
          {!!enrichment?.notes && (
            <Feather name="message-square" size={11} color={colors.textMuted} />
          )}
          {!!enrichment?.receiptUri && (
            <Feather name="paperclip" size={11} color={colors.textMuted} />
          )}
          {item.isEdited && (
            <Feather name="edit-3" size={11} color={colors.warning} />
          )}
        </View>
      </View>
    </TouchableOpacity>
    );
  }, [cardMap, enrichments, colors, styles]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      {manualTransactions.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="list"
            title="No Transactions Yet"
            subtitle="Add your first transaction to see it auto-categorized and tracked here."
          />
          <View style={styles.listHeader}>
            <PrimaryButton
              title="Add Transaction"
              icon="plus"
              onPress={() => navigation.navigate('AddTransaction')}
            />
          </View>
        </View>
      ) : (
        <>
          {/* Sticky month selector outside FlatList */}
          <MonthSelector
            selectedMonth={effectiveMonth}
            availableMonths={availableMonths}
            onChangeMonth={setMonthFilter}
            allowAll
            renderSubtitle={() => (
              <View style={styles.monthTotals}>
                {totalCurrencies.map((cur) => (
                  <View key={cur} style={styles.monthTotalsRow}>
                    <Text style={[styles.monthTotalText, { color: colors.debit }]}>
                      -{formatCurrency(totals[cur]?.debits ?? 0, cur)}
                    </Text>
                    <Text style={[styles.monthTotalText, { color: colors.credit }]}>
                      +{formatCurrency(totals[cur]?.credits ?? 0, cur)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          />

          <FlatList
            data={filteredTransactions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <PrimaryButton
                  title="Add Transaction"
                  icon="plus"
                  onPress={() => navigation.navigate('AddTransaction')}
                />

                {/* Daily spending chart */}
                {chartData && (
                  <DailySpendingChart
                    debitsByDay={chartData.debitsByDay}
                    daysInRange={chartData.daysInRange}
                  />
                )}

                {/* Search */}
                <View style={styles.searchRow}>
                  <Feather name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search transactions..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={Keyboard.dismiss}
                    accessibilityLabel="Search transactions"
                  />
                </View>

                {/* Category chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  <TouchableOpacity
                    style={[styles.chip, !categoryFilter && styles.chipActive]}
                    onPress={() => setCategoryFilter(null)}
                  >
                    <Text style={[styles.chipText, !categoryFilter && styles.chipTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {allCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, categoryFilter === cat && styles.chipActive]}
                      onPress={() =>
                        setCategoryFilter(categoryFilter === cat ? null : cat)
                      }
                    >
                      <View
                        style={[
                          styles.chipDot,
                          { backgroundColor: categoryColors[cat] || colors.textMuted },
                        ]}
                      />
                      <Text
                        style={[styles.chipText, categoryFilter === cat && styles.chipTextActive]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Card chips */}
                {usedCards.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipRow}
                  >
                    <TouchableOpacity
                      style={[styles.chip, cardFilter === null && styles.chipActive]}
                      onPress={() => setCardFilter(null)}
                    >
                      <Text style={[styles.chipText, cardFilter === null && styles.chipTextActive]}>
                        All Cards
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chip, cardFilter === '__none__' && styles.chipActive]}
                      onPress={() =>
                        setCardFilter(cardFilter === '__none__' ? null : '__none__')
                      }
                    >
                      <Text style={[styles.chipText, cardFilter === '__none__' && styles.chipTextActive]}>
                        No Card
                      </Text>
                    </TouchableOpacity>
                    {usedCards.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chip, cardFilter === c.id && styles.chipActive]}
                        onPress={() =>
                          setCardFilter(cardFilter === c.id ? null : c.id)
                        }
                      >
                        <View
                          style={[styles.chipDot, { backgroundColor: c.color }]}
                        />
                        <Text
                          style={[styles.chipText, cardFilter === c.id && styles.chipTextActive]}
                        >
                          {c.nickname}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Enrichment chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                >
                  <TouchableOpacity
                    style={[styles.chip, enrichmentFilter === 'flagged' && styles.chipActive]}
                    onPress={() =>
                      setEnrichmentFilter(enrichmentFilter === 'flagged' ? null : 'flagged')
                    }
                  >
                    <Feather name="star" size={12} color={enrichmentFilter === 'flagged' ? colors.accent : colors.textSecondary} style={{ marginRight: spacing.xs }} />
                    <Text style={[styles.chipText, enrichmentFilter === 'flagged' && styles.chipTextActive]}>
                      Starred
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, enrichmentFilter === 'notes' && styles.chipActive]}
                    onPress={() =>
                      setEnrichmentFilter(enrichmentFilter === 'notes' ? null : 'notes')
                    }
                  >
                    <Feather name="message-square" size={12} color={enrichmentFilter === 'notes' ? colors.accent : colors.textSecondary} style={{ marginRight: spacing.xs }} />
                    <Text style={[styles.chipText, enrichmentFilter === 'notes' && styles.chipTextActive]}>
                      Has Notes
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, enrichmentFilter === 'receipt' && styles.chipActive]}
                    onPress={() =>
                      setEnrichmentFilter(enrichmentFilter === 'receipt' ? null : 'receipt')
                    }
                  >
                    <Feather name="paperclip" size={12} color={enrichmentFilter === 'receipt' ? colors.accent : colors.textSecondary} style={{ marginRight: spacing.xs }} />
                    <Text style={[styles.chipText, enrichmentFilter === 'receipt' && styles.chipTextActive]}>
                      Has Receipt
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* Sort toggle */}
                <View style={styles.sortRow}>
                  <Text style={styles.sortLabel}>{filteredTransactions.length} transactions</Text>
                  <TouchableOpacity
                    style={styles.sortToggle}
                    onPress={() => setSortBy(sortBy === 'date' ? 'amount' : 'date')}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort ${sortBy === 'date' ? 'by date' : 'by amount'}`}
                  >
                    <Feather name="repeat" size={14} color={colors.textSecondary} />
                    <Text style={styles.sortToggleText}>
                      {sortBy === 'date' ? 'By Date' : 'By Amount'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </>
      )}

      <TransactionDetailModal
        visible={!!selectedTxn}
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
        card={selectedTxn?.cardId ? cardMap[selectedTxn.cardId] : undefined}
        isManual
        onPrev={handlePrev}
        onNext={handleNext}
        onUpdateTransaction={(txnId, updates) => {
          updateManualTransaction(txnId, updates);
          setSelectedTxn((prev) => prev ? { ...prev, ...updates } : null);
        }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xxxl,
    fontWeight: '600',
    lineHeight: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowDesc: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  rowDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  rowRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  rowAmount: {
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  indicators: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  cardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardTagText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
  },
  chipRow: {
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
    lineHeight: 16,
  },
  chipTextActive: {
    color: colors.accent,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sortLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortToggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
    marginLeft: spacing.xs,
  },
  listHeader: {
    paddingHorizontal: spacing.lg,
  },
  monthTotals: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  monthTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  monthTotalText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
});

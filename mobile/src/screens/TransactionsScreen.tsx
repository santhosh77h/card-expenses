import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, borderRadius, fontSize, formatCurrency, categoryColors, CurrencyCode } from '../theme';
import { useStore, Transaction, CreditCard } from '../store';
import { Card, StatRow, Badge, EmptyState, PrimaryButton } from '../components/ui';
import TransactionDetailModal from '../components/TransactionDetailModal';
import DailySpendingChart from '../components/DailySpendingChart';
import type { RootStackParamList, TabParamList } from '../navigation';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Transactions'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function TransactionsScreen() {
  const navigation = useNavigation<NavProp>();
  const { cards, manualTransactions, enrichments } = useStore();
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

  const usedCards = useMemo(() => {
    const ids = new Set(manualTransactions.map((t) => t.cardId).filter(Boolean));
    return Array.from(ids).map((id) => cardMap[id!]).filter(Boolean) as CreditCard[];
  }, [manualTransactions, cardMap]);

  const filteredTransactions = useMemo(() => {
    let result = [...manualTransactions];
    if (monthFilter) {
      result = result.filter((t) => t.date.startsWith(monthFilter));
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
  }, [manualTransactions, monthFilter, searchQuery, categoryFilter, cardFilter, enrichmentFilter, sortBy, enrichments]);

  const selectedIdx = selectedTxn
    ? filteredTransactions.findIndex((t) => t.id === selectedTxn.id)
    : -1;
  const handlePrev = selectedIdx > 0
    ? () => setSelectedTxn(filteredTransactions[selectedIdx - 1])
    : undefined;
  const handleNext = selectedIdx >= 0 && selectedIdx < filteredTransactions.length - 1
    ? () => setSelectedTxn(filteredTransactions[selectedIdx + 1])
    : undefined;

  // Group totals by currency
  const totals = React.useMemo(() => {
    const byCurrency: Record<string, { debits: number; credits: number }> = {};
    for (const t of manualTransactions) {
      const cur = t.currency ?? (t.cardId ? cardMap[t.cardId]?.currency : undefined) ?? 'INR';
      if (!byCurrency[cur]) byCurrency[cur] = { debits: 0, credits: 0 };
      if (t.type === 'debit') byCurrency[cur].debits += t.amount;
      else byCurrency[cur].credits += t.amount;
    }
    return byCurrency;
  }, [manualTransactions, cardMap]);
  const totalCurrencies = Object.keys(totals) as CurrencyCode[];

  const chartData = useMemo(() => {
    if (!monthFilter) return null;
    const source = manualTransactions.filter((t) => t.date.startsWith(monthFilter));
    const [year, month] = monthFilter.split('-').map(Number);
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
  }, [manualTransactions, monthFilter]);

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  };

  const renderItem = ({ item }: { item: Transaction }) => {
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
          <Text style={styles.rowDate}>{item.date}</Text>
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
          {formatCurrency(item.amount, item.currency ?? txnCard?.currency ?? 'INR')}
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
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      {manualTransactions.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="list"
            title="No Transactions Yet"
            subtitle="Add your first transaction to see it auto-categorized and tracked here."
          />
          <View style={{ paddingHorizontal: spacing.lg }}>
            <PrimaryButton
              title="Add Transaction"
              icon="plus"
              onPress={() => navigation.navigate('AddTransaction')}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Card>
                <StatRow
                  label="Total Transactions"
                  value={String(manualTransactions.length)}
                />
                {totalCurrencies.map((cur) => (
                  <React.Fragment key={cur}>
                    <StatRow
                      label={totalCurrencies.length > 1 ? `Debits (${cur})` : 'Total Debits'}
                      value={formatCurrency(totals[cur].debits, cur)}
                      valueColor={colors.debit}
                    />
                    <StatRow
                      label={totalCurrencies.length > 1 ? `Credits (${cur})` : 'Total Credits'}
                      value={formatCurrency(totals[cur].credits, cur)}
                      valueColor={colors.credit}
                    />
                  </React.Fragment>
                ))}
              </Card>
              <PrimaryButton
                title="Add Transaction"
                icon="plus"
                onPress={() => navigation.navigate('AddTransaction')}
              />

              {/* Month chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
              >
                <TouchableOpacity
                  style={[styles.chip, !monthFilter && styles.chipActive]}
                  onPress={() => setMonthFilter(null)}
                >
                  <Text style={[styles.chipText, !monthFilter && styles.chipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {availableMonths.map((ym) => (
                  <TouchableOpacity
                    key={ym}
                    style={[styles.chip, monthFilter === ym && styles.chipActive]}
                    onPress={() => setMonthFilter(monthFilter === ym ? null : ym)}
                  >
                    <Text style={[styles.chipText, monthFilter === ym && styles.chipTextActive]}>
                      {formatMonthLabel(ym)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

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
      )}

      <TransactionDetailModal
        visible={!!selectedTxn}
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
        card={selectedTxn?.cardId ? cardMap[selectedTxn.cardId] : undefined}
        isManual
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xxxl,
    fontWeight: '800',
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
    fontWeight: '600',
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
  },
  rowRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  rowAmount: {
    fontSize: fontSize.md,
    fontWeight: '700',
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
    fontWeight: '600',
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
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortToggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, formatCurrency, categoryColors, CurrencyCode } from '../theme';
import { useStore, Transaction, CreditCard, TransactionEnrichment } from '../store';
import { Card, StatRow, AmountText, Badge, SectionHeader, ProgressBar } from '../components/ui';
import { CategoryPieChart, CategoryBarChart } from '../components/CategoryChart';
import TransactionDetailModal from '../components/TransactionDetailModal';
import type { RootStackParamList } from '../navigation';

type Tab = 'overview' | 'transactions' | 'categories';

export default function AnalysisScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Analysis'>>();
  const { statementId, cardId } = route.params;
  const { statements, cards, importStatementTransactions, enrichments } = useStore();

  const statement = useMemo(() => {
    const cardStatements = statements[cardId] || [];
    return cardStatements.find((s) => s.id === statementId);
  }, [statements, cardId, statementId]);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [imported, setImported] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  if (!statement) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Statement not found.</Text>
      </View>
    );
  }

  const { transactions, summary, csv } = statement;

  const card = useMemo(() => cards.find((c) => c.id === cardId), [cards, cardId]);
  const currency: CurrencyCode = card?.currency ?? 'INR';

  const handleAddToTransactions = useCallback(() => {
    importStatementTransactions(statementId);
    setImported(true);
    Alert.alert(
      'Added Successfully',
      `${transactions.length} transactions have been added to your Transactions list.`,
    );
  }, [statementId, transactions.length, importStatementTransactions]);

  // Filtered & sorted transactions
  const filteredTxns = useMemo(() => {
    let result = [...transactions];
    if (categoryFilter) {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount;
      return b.date.localeCompare(a.date);
    });
    return result;
  }, [transactions, categoryFilter, sortBy, searchQuery]);

  const selectedIdx = selectedTxn
    ? filteredTxns.findIndex((t) => t.id === selectedTxn.id)
    : -1;
  const handlePrev = selectedIdx > 0
    ? () => setSelectedTxn(filteredTxns[selectedIdx - 1])
    : undefined;
  const handleNext = selectedIdx >= 0 && selectedIdx < filteredTxns.length - 1
    ? () => setSelectedTxn(filteredTxns[selectedIdx + 1])
    : undefined;

  const allCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  const largestTxn = useMemo(
    () =>
      transactions.reduce(
        (max, t) => (t.amount > max.amount ? t : max),
        transactions[0]
      ),
    [transactions]
  );

  const handleExportCSV = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web: use share API
        await Share.share({ message: csv, title: 'Statement Export' });
        return;
      }
      const path = `${FileSystem.cacheDirectory}vector-export.csv`;
      await FileSystem.writeAsStringAsync(path, csv);
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Statement CSV',
      });
    } catch {
      // Sharing cancelled or unavailable
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['overview', 'transactions', 'categories'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {activeTab === 'overview' && (
          <OverviewTab
            summary={summary}
            largestTxn={largestTxn}
            onExport={handleExportCSV}
            onAddToTransactions={handleAddToTransactions}
            imported={imported}
            currency={currency}
          />
        )}
        {activeTab === 'transactions' && (
          <TransactionsTab
            transactions={filteredTxns}
            allCategories={allCategories}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            card={card}
            currency={currency}
            enrichments={enrichments}
            onSelectTransaction={setSelectedTxn}
          />
        )}
        {activeTab === 'categories' && (
          <CategoriesTab categories={summary.categories} currency={currency} />
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <TransactionDetailModal
        visible={!!selectedTxn}
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
        card={card}
        isManual={false}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  summary,
  largestTxn,
  onExport,
  onAddToTransactions,
  imported,
  currency,
}: {
  summary: any;
  largestTxn: Transaction;
  onExport: () => void;
  onAddToTransactions: () => void;
  imported: boolean;
  currency: CurrencyCode;
}) {
  return (
    <View style={{ padding: spacing.lg }}>
      {/* Hero net spend */}
      <Card>
        <Text style={styles.overviewLabel}>Net Spending</Text>
        <Text style={styles.heroAmount}>{formatCurrency(summary.net, currency)}</Text>
        <View style={{ marginTop: spacing.lg }}>
          <StatRow
            label="Total Debits"
            value={formatCurrency(summary.total_debits, currency)}
            valueColor={colors.debit}
          />
          <StatRow
            label="Total Credits / Refunds"
            value={formatCurrency(summary.total_credits, currency)}
            valueColor={colors.credit}
          />
          <StatRow
            label="Transactions"
            value={summary.total_transactions.toString()}
          />
          <StatRow
            label="Statement Period"
            value={`${summary.statement_period.from || 'N/A'} to ${summary.statement_period.to || 'N/A'}`}
          />
        </View>
      </Card>

      {/* Largest transaction */}
      {largestTxn && (
        <Card>
          <Text style={styles.cardLabel}>Largest Transaction</Text>
          <Text style={styles.largestDesc}>{largestTxn.description}</Text>
          <View style={styles.largestRow}>
            <Badge
              text={largestTxn.category}
              color={categoryColors[largestTxn.category] || colors.textMuted}
            />
            <AmountText amount={largestTxn.amount} type={largestTxn.type} size="lg" currency={currency} />
          </View>
        </Card>
      )}

      {/* Action buttons */}
      <TouchableOpacity
        style={[
          styles.addToTxnBtn,
          imported && styles.addToTxnBtnDone,
        ]}
        onPress={onAddToTransactions}
        disabled={imported}
      >
        <Feather
          name={imported ? 'check-circle' : 'plus-circle'}
          size={18}
          color={imported ? colors.credit : '#fff'}
        />
        <Text style={[styles.addToTxnText, imported && styles.addToTxnTextDone]}>
          {imported ? 'Added to Transactions' : 'Add to My Transactions'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.exportBtn} onPress={onExport}>
        <Feather name="download" size={18} color={colors.accent} />
        <Text style={styles.exportBtnText}>Export CSV</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Transactions Tab
// ---------------------------------------------------------------------------

function TransactionsTab({
  transactions,
  allCategories,
  categoryFilter,
  setCategoryFilter,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
  card,
  currency,
  enrichments,
  onSelectTransaction,
}: {
  transactions: Transaction[];
  allCategories: string[];
  categoryFilter: string | null;
  setCategoryFilter: (c: string | null) => void;
  sortBy: 'date' | 'amount';
  setSortBy: (s: 'date' | 'amount') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  card?: CreditCard;
  currency: CurrencyCode;
  enrichments: Record<string, TransactionEnrichment>;
  onSelectTransaction: (txn: Transaction) => void;
}) {
  return (
    <View style={{ padding: spacing.lg }}>
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

      {/* Category filter chips */}
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

      {/* Sort toggle */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>{transactions.length} transactions</Text>
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

      {/* Transaction list */}
      {transactions.map((txn, i) => {
        const enrichment = enrichments[txn.id];
        return (
        <TouchableOpacity
          key={`${txn.date}-${txn.description}-${i}`}
          style={styles.txnRow}
          activeOpacity={0.7}
          onPress={() => onSelectTransaction(txn)}
        >
          <View
            style={[
              styles.txnCategoryDot,
              { backgroundColor: categoryColors[txn.category] || colors.textMuted },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.txnDesc} numberOfLines={1}>
              {txn.description}
            </Text>
            <View style={styles.txnMeta}>
              <Text style={styles.txnDate}>{txn.date}</Text>
              <Text style={styles.txnCategory}>{txn.category}</Text>
              {card && (
                <View style={styles.txnCardTag}>
                  <View style={[styles.txnCardDot, { backgroundColor: card.color }]} />
                  <Text style={styles.txnCardName}>
                    {card.nickname}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AmountText amount={txn.amount} type={txn.type} size="sm" currency={currency} />
            <View style={styles.txnIndicators}>
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
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Categories Tab
// ---------------------------------------------------------------------------

function CategoriesTab({
  categories,
  currency,
}: {
  categories: Record<string, { total: number; count: number }>;
  currency: CurrencyCode;
}) {
  const total = Object.values(categories).reduce((s, c) => s + c.total, 0);
  const sorted = Object.entries(categories).sort(
    ([, a], [, b]) => b.total - a.total
  );

  return (
    <View style={{ padding: spacing.lg }}>
      <Card>
        <CategoryPieChart categories={categories} currency={currency} />
      </Card>

      <Card>
        <CategoryBarChart categories={categories} currency={currency} />
      </Card>

      {/* Category breakdown with progress bars */}
      <SectionHeader title="All Categories" />
      {sorted.map(([name, data]) => {
        const pct = total > 0 ? data.total / total : 0;
        return (
          <Card key={name}>
            <View style={styles.catRow}>
              <View
                style={[
                  styles.catDot,
                  { backgroundColor: categoryColors[name] || colors.textMuted },
                ]}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.catHeader}>
                  <Text style={styles.catName}>{name}</Text>
                  <Text style={styles.catAmount}>{formatCurrency(data.total, currency)}</Text>
                </View>
                <ProgressBar
                  progress={pct}
                  color={categoryColors[name] || colors.textMuted}
                  height={4}
                  style={{ marginTop: spacing.sm }}
                />
                <Text style={styles.catMeta}>
                  {data.count} transaction{data.count !== 1 ? 's' : ''} /{' '}
                  {(pct * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.textMuted,
    fontSize: fontSize.lg,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.accent,
  },
  // Overview
  overviewLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.hero,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  largestDesc: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  largestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addToTxnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    backgroundColor: colors.accent,
  },
  addToTxnBtnDone: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.credit,
  },
  addToTxnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  addToTxnTextDone: {
    color: colors.credit,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  exportBtnText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  // Transactions
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
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
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txnCategoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  txnDesc: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  txnMeta: {
    flexDirection: 'row',
    marginTop: 2,
    gap: spacing.sm,
  },
  txnDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  txnCategory: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  txnCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txnCardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  txnCardName: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  txnIndicators: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  // Categories
  catRow: {
    flexDirection: 'row',
  },
  catDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
    marginTop: 4,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  catAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  catMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});

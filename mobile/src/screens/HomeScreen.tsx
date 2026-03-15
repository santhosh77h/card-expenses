import React, { useMemo, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize, formatCurrency, formatDate, dateFormatForCurrency, CurrencyCode, DateFormat } from '../theme';
import { useStore, StatementData, CreditCard } from '../store';
import { Card, SectionHeader, EmptyState, PrimaryButton, ProgressBar } from '../components/ui';
import ManageCardsSection from '../components/ManageCardsSection';
import { getMonthlyPortfolioData, MonthlyPortfolioEntry } from '../utils/cardAnalytics';
import type { RootStackParamList, TabParamList } from '../navigation';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ---------------------------------------------------------------------------
// Swipeable Monthly Portfolio Card
// ---------------------------------------------------------------------------

interface PortfolioCardProps {
  cards: CreditCard[];
  monthlyUsage: import('../store').MonthlyUsage[];
  primaryCurrency: CurrencyCode;
  totalAmountDue: number;
  paymentDueCards: CreditCard[];
  utilization: number;
  isSingleCurrency: boolean;
  primaryGroup: { totalSpent: number; totalLimit: number };
  currencyGroups: Record<string, { totalSpent: number; totalLimit: number }>;
  currencyKeys: CurrencyCode[];
}

function MonthlyPortfolioCard({
  cards,
  monthlyUsage,
  primaryCurrency,
  totalAmountDue,
  paymentDueCards,
  utilization,
  isSingleCurrency,
  primaryGroup,
  currencyGroups,
  currencyKeys,
}: PortfolioCardProps) {
  const portfolioData = useMemo(
    () => getMonthlyPortfolioData(cards, monthlyUsage),
    [cards, monthlyUsage],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // Fallback: no monthly data → show static card like before
  if (portfolioData.length === 0) {
    return (
      <View style={styles.paddedSection}>
        <Card>
          <Text style={styles.portfolioLabel}>
            {totalAmountDue > 0 ? 'Total Amount Due' : 'Total Outstanding'}
          </Text>
          {totalAmountDue > 0 ? (
            <Text style={styles.portfolioAmount}>
              {formatCurrency(totalAmountDue, primaryCurrency)}
            </Text>
          ) : isSingleCurrency ? (
            <Text style={styles.portfolioAmount}>
              {formatCurrency(primaryGroup.totalSpent, primaryCurrency)}
            </Text>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              {currencyKeys.map((cur) => (
                <Text key={cur} style={styles.portfolioAmount}>
                  {formatCurrency(currencyGroups[cur].totalSpent, cur)}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.utilizationRow}>
            <Text style={styles.utilizationLabel}>Credit Utilization</Text>
            <Text style={styles.utilizationPct}>{(utilization * 100).toFixed(0)}%</Text>
          </View>
          <ProgressBar
            progress={utilization}
            color={utilization > 0.6 ? colors.debit : utilization > 0.3 ? colors.warning : colors.accent}
            height={8}
          />
        </Card>
      </View>
    );
  }

  const renderPage = ({ item }: { item: MonthlyPortfolioEntry }) => (
    <View style={{ width: CARD_WIDTH, paddingHorizontal: 0 }}>
      <Card>
        {/* Month label */}
        <Text style={portfolioStyles.monthLabel}>{item.label}</Text>

        {/* Total */}
        <Text style={styles.portfolioLabel}>Total Amount Due</Text>
        <Text style={styles.portfolioAmount}>
          {formatCurrency(item.totalDue, item.currency)}
        </Text>

        {/* Per-card breakdown */}
        {item.cards.map((c) => (
          <View key={c.cardId} style={styles.dueCardRow}>
            <View style={[styles.dueCardDot, { backgroundColor: c.color }]} />
            <Text style={styles.dueCardName} numberOfLines={1}>{c.nickname}</Text>
            <Text style={styles.dueCardAmount}>
              {formatCurrency(c.amount, c.currency)}
            </Text>
          </View>
        ))}

        {/* Utilization */}
        <View style={styles.utilizationRow}>
          <Text style={styles.utilizationLabel}>Credit Utilization</Text>
          <Text style={styles.utilizationPct}>
            {(item.utilization * 100).toFixed(0)}%
          </Text>
        </View>
        <ProgressBar
          progress={item.utilization}
          color={
            item.utilization > 0.6
              ? colors.debit
              : item.utilization > 0.3
              ? colors.warning
              : colors.accent
          }
          height={8}
        />
      </Card>
    </View>
  );

  return (
    <View>
      <FlatList
        data={portfolioData}
        renderItem={renderPage}
        keyExtractor={(item) => item.month}
        horizontal
        pagingEnabled
        snapToInterval={CARD_WIDTH}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
          index,
        })}
      />
      {/* Pagination dots */}
      {portfolioData.length > 1 && (
        <View style={portfolioStyles.dotsRow}>
          {portfolioData.map((entry, idx) => (
            <View
              key={entry.month}
              style={[
                portfolioStyles.dot,
                idx === activeIndex && portfolioStyles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const portfolioStyles = StyleSheet.create({
  monthLabel: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
    opacity: 0.4,
  },
  dotActive: {
    backgroundColor: colors.accent,
    opacity: 1,
    width: 18,
    borderRadius: 3,
  },
});

// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { cards, statements, monthlyUsage, addCard, removeCard } = useStore();

  // Get all statements across all cards
  const allStatements = useMemo(() => {
    const result: (StatementData & { cardNickname: string; cardCurrency: CurrencyCode })[] = [];
    for (const card of cards) {
      const cardStatements = statements[card.id] || [];
      for (const stmt of cardStatements) {
        result.push({ ...stmt, cardNickname: card.nickname, cardCurrency: card.currency ?? 'INR' });
      }
    }
    result.sort(
      (a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime()
    );
    return result;
  }, [cards, statements]);

  // Group totals by currency
  const { currencyGroups, currencyKeys, isSingleCurrency, primaryCurrency, primaryGroup, utilization } = useMemo(() => {
    const groups: Record<string, { totalSpent: number; totalLimit: number }> = {};
    for (const card of cards) {
      const cur = card.currency ?? 'INR';
      if (!groups[cur]) groups[cur] = { totalSpent: 0, totalLimit: 0 };
      groups[cur].totalLimit += card.creditLimit;
      const cardStmts = allStatements.filter((s) => s.cardId === card.id);
      groups[cur].totalSpent += cardStmts.reduce((s, st) => s + (st.summary?.net || 0), 0);
    }
    const keys = Object.keys(groups) as CurrencyCode[];
    const single = keys.length <= 1;
    const primary = keys[0] ?? 'INR';
    const pGroup = groups[primary] ?? { totalSpent: 0, totalLimit: 0 };
    const util = pGroup.totalLimit > 0 ? pGroup.totalSpent / pGroup.totalLimit : 0;
    return { currencyGroups: groups, currencyKeys: keys, isSingleCurrency: single, primaryCurrency: primary, primaryGroup: pGroup, utilization: util };
  }, [cards, allStatements]);

  // Payment due info across cards
  const paymentDueCards = useMemo(() => {
    return cards
      .filter((c) => c.totalAmountDue != null && c.totalAmountDue > 0)
      .sort((a, b) => {
        if (a.paymentDueDate && b.paymentDueDate) return a.paymentDueDate.localeCompare(b.paymentDueDate);
        if (a.paymentDueDate) return -1;
        return 1;
      });
  }, [cards]);

  const totalAmountDue = useMemo(() => {
    if (!isSingleCurrency || paymentDueCards.length === 0) return 0;
    return paymentDueCards.reduce((sum, c) => sum + (c.totalAmountDue ?? 0), 0);
  }, [paymentDueCards, isSingleCurrency]);

  if (cards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.title}>Vector</Text>
          <Text style={styles.subtitle}>Your Money. Directed.</Text>
        </View>
        <EmptyState
          icon="credit-card"
          title="No Cards Yet"
          subtitle="Add your first credit card to start tracking your expenses."
        />
        <View style={styles.paddedSection}>
          <PrimaryButton
            title="Add Your First Card"
            icon="plus"
            onPress={() => navigation.navigate('Tabs', { screen: 'Cards' })}
          />
          <View style={{ height: spacing.md }} />
          <PrimaryButton
            title="Try Demo Mode"
            icon="play"
            variant="outline"
            onPress={() => navigation.navigate('Tabs', { screen: 'Upload' })}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Vector</Text>
        <Text style={styles.subtitle}>Your Money. Directed.</Text>
      </View>

      {/* Portfolio Card — swipeable by month */}
      <MonthlyPortfolioCard
        cards={cards}
        monthlyUsage={monthlyUsage}
        primaryCurrency={primaryCurrency}
        totalAmountDue={totalAmountDue}
        paymentDueCards={paymentDueCards}
        utilization={utilization}
        isSingleCurrency={isSingleCurrency}
        primaryGroup={primaryGroup}
        currencyGroups={currencyGroups}
        currencyKeys={currencyKeys}
      />

      {/* Manage Cards */}
      <SectionHeader title="Your Cards" />
      <ManageCardsSection
        cards={cards}
        statements={statements}
        monthlyUsage={monthlyUsage}
        addCard={addCard}
        removeCard={removeCard}
      />

      {/* Recent Statements */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title="Recent Statements" />
        {allStatements.length === 0 ? (
          <View style={styles.paddedSection}>
            <Card>
              <Text style={styles.noStatements}>
                No statements yet. Upload a PDF to get started.
              </Text>
            </Card>
          </View>
        ) : (
          allStatements.slice(0, 5).map((stmt) => (
            <TouchableOpacity
              key={stmt.id}
              style={styles.statementRow}
              onPress={() =>
                navigation.navigate('Analysis', {
                  statementId: stmt.id,
                  cardId: stmt.cardId,
                })
              }
            >
              <View style={styles.statementIcon}>
                <Feather name="file-text" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statementCard}>{stmt.cardNickname}</Text>
                <Text style={styles.statementDate}>
                  {formatDate(stmt.summary.statement_period.from ?? '', stmt.dateFormat ?? dateFormatForCurrency(stmt.cardCurrency))} to{' '}
                  {formatDate(stmt.summary.statement_period.to ?? '', stmt.dateFormat ?? dateFormatForCurrency(stmt.cardCurrency))}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.statementAmount}>
                  {formatCurrency(stmt.summary.net, stmt.cardCurrency)}
                </Text>
                <Text style={styles.statementCount}>
                  {stmt.summary.total_transactions} txns
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.textMuted}
                style={{ marginLeft: spacing.sm }}
              />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Upload CTA */}
      <View style={styles.ctaSection}>
        <PrimaryButton
          title="Upload Statement"
          icon="upload"
          onPress={() => navigation.navigate('Tabs', { screen: 'Upload' })}
        />
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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
  portfolioLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 16,
  },
  portfolioAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.hero,
    fontWeight: '700',
    marginVertical: spacing.sm,
    lineHeight: 40,
  },
  utilizationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  utilizationLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  utilizationPct: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  thresholds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  thresholdText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  noStatements: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    lineHeight: 20,
  },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statementIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statementCard: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  statementDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  statementAmount: {
    color: colors.debit,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  statementCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  dueCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  dueCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  dueCardName: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
  dueCardAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  dueCardDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  minDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    backgroundColor: colors.warning + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  minDueText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  paddedSection: {
    paddingHorizontal: spacing.lg,
  },
  bottomSpacer: {
    height: 40,
  },
  ctaSection: {
    padding: spacing.lg,
    marginTop: spacing.md,
  },
});

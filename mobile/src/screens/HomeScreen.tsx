import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../theme';
import { useStore, StatementData } from '../store';
import { Card, SectionHeader, ProgressBar, EmptyState, PrimaryButton } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import type { RootStackParamList, TabParamList } from '../navigation';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();
  const { cards, statements, activeCardId, setActiveCard, monthlyUsage } = useStore();

  // Get all statements across all cards
  const allStatements: (StatementData & { cardNickname: string; cardCurrency: CurrencyCode })[] = [];
  for (const card of cards) {
    const cardStatements = statements[card.id] || [];
    for (const stmt of cardStatements) {
      allStatements.push({ ...stmt, cardNickname: card.nickname, cardCurrency: card.currency ?? 'INR' });
    }
  }
  allStatements.sort(
    (a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime()
  );

  // Group totals by currency
  const currencyGroups: Record<string, { totalSpent: number; totalLimit: number }> = {};
  for (const card of cards) {
    const cur = card.currency ?? 'INR';
    if (!currencyGroups[cur]) currencyGroups[cur] = { totalSpent: 0, totalLimit: 0 };
    currencyGroups[cur].totalLimit += card.creditLimit;
    const cardStmts = allStatements.filter((s) => s.cardId === card.id);
    currencyGroups[cur].totalSpent += cardStmts.reduce((s, st) => s + (st.summary?.net || 0), 0);
  }
  const currencyKeys = Object.keys(currencyGroups) as CurrencyCode[];
  const isSingleCurrency = currencyKeys.length <= 1;
  const primaryCurrency = currencyKeys[0] ?? 'INR';
  const primaryGroup = currencyGroups[primaryCurrency] ?? { totalSpent: 0, totalLimit: 0 };
  const utilization = primaryGroup.totalLimit > 0 ? primaryGroup.totalSpent / primaryGroup.totalLimit : 0;

  if (cards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Vector</Text>
          <Text style={styles.subtitle}>Your Money. Directed.</Text>
        </View>
        <EmptyState
          icon="credit-card"
          title="No Cards Yet"
          subtitle="Add your first credit card to start tracking your expenses."
        />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <PrimaryButton
            title="Add Your First Card"
            icon="plus"
            onPress={() => navigation.navigate('Cards' as any)}
          />
          <View style={{ height: spacing.md }} />
          <PrimaryButton
            title="Try Demo Mode"
            icon="play"
            variant="outline"
            onPress={() => navigation.navigate('Upload' as any)}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Vector</Text>
        <Text style={styles.subtitle}>Your Money. Directed.</Text>
      </View>

      {/* Portfolio Card */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Card>
          <Text style={styles.portfolioLabel}>Total Outstanding</Text>
          {isSingleCurrency ? (
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

          {isSingleCurrency && (
            <>
              <View style={styles.utilizationRow}>
                <Text style={styles.utilizationLabel}>Credit Utilization</Text>
                <Text style={styles.utilizationPct}>
                  {(utilization * 100).toFixed(0)}%
                </Text>
              </View>
              <ProgressBar
                progress={utilization}
                color={
                  utilization > 0.6
                    ? colors.debit
                    : utilization > 0.3
                    ? colors.warning
                    : colors.accent
                }
                height={8}
              />
              {/* Threshold markers */}
              <View style={styles.thresholds}>
                <Text style={styles.thresholdText}>0%</Text>
                <Text style={[styles.thresholdText, { left: '30%' }]}>30%</Text>
                <Text style={[styles.thresholdText, { left: '60%' }]}>60%</Text>
                <Text style={[styles.thresholdText, { textAlign: 'right' }]}>100%</Text>
              </View>
            </>
          )}

          {!isSingleCurrency && (
            <View style={{ marginTop: spacing.md }}>
              {currencyKeys.map((cur) => {
                const grp = currencyGroups[cur];
                const util = grp.totalLimit > 0 ? grp.totalSpent / grp.totalLimit : 0;
                return (
                  <View key={cur} style={{ marginBottom: spacing.sm }}>
                    <View style={styles.utilizationRow}>
                      <Text style={styles.utilizationLabel}>{cur} Utilization</Text>
                      <Text style={styles.utilizationPct}>{(util * 100).toFixed(0)}%</Text>
                    </View>
                    <ProgressBar
                      progress={util}
                      color={util > 0.6 ? colors.debit : util > 0.3 ? colors.warning : colors.accent}
                      height={6}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </View>

      {/* Card Carousel */}
      <SectionHeader title="Your Cards" />
      <FlatList
        data={cards}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setActiveCard(item.id)}
            activeOpacity={0.9}
            style={
              activeCardId === item.id
                ? { borderWidth: 2, borderColor: colors.accent, borderRadius: borderRadius.xl }
                : undefined
            }
          >
            <CreditCardView card={item} compact />
          </TouchableOpacity>
        )}
      />

      {/* Monthly Usage */}
      {monthlyUsage.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Monthly Usage" />
          <View style={{ paddingHorizontal: spacing.lg }}>
            {cards.map((card) => {
              const latestUsage = monthlyUsage
                .filter((u) => u.cardId === card.id)
                .sort((a, b) => b.month.localeCompare(a.month))[0];
              if (!latestUsage) return null;
              const utilPct =
                card.creditLimit > 0
                  ? Math.min(latestUsage.totalDebits / card.creditLimit, 1)
                  : 0;
              return (
                <Card key={card.id}>
                  <View style={styles.usageRow}>
                    <View style={[styles.usageDot, { backgroundColor: card.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.usageCardName}>{card.nickname}</Text>
                      <Text style={styles.usageMonth}>{latestUsage.month}</Text>
                    </View>
                    <Text style={styles.usageAmount}>
                      {formatCurrency(latestUsage.totalDebits, card.currency ?? 'INR')}
                    </Text>
                  </View>
                  <View style={{ marginTop: spacing.sm }}>
                    <ProgressBar progress={utilPct} color={card.color} height={4} />
                  </View>
                  {card.creditLimit > 0 && (
                    <Text style={styles.usageLimit}>
                      Limit: {formatCurrency(card.creditLimit, card.currency ?? 'INR')}
                    </Text>
                  )}
                </Card>
              );
            })}
          </View>
        </View>
      )}

      {/* Recent Statements */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title="Recent Statements" />
        {allStatements.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
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
                  {stmt.summary.statement_period.from} to{' '}
                  {stmt.summary.statement_period.to}
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
      <View style={{ padding: spacing.lg, marginTop: spacing.md }}>
        <PrimaryButton
          title="Upload Statement"
          icon="upload"
          onPress={() => navigation.navigate('Upload' as any)}
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
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
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xxxl,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  portfolioLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  portfolioAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.hero,
    fontWeight: '800',
    marginVertical: spacing.sm,
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
  },
  utilizationPct: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  thresholds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  thresholdText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
  },
  noStatements: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    textAlign: 'center',
    paddingVertical: spacing.lg,
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
  },
  statementDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  statementAmount: {
    color: colors.debit,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  statementCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  usageCardName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  usageMonth: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  usageAmount: {
    color: colors.debit,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  usageLimit: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
});

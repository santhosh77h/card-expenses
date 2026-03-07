import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../theme';
import { useStore, Transaction, CreditCard } from '../store';
import { Card, StatRow, Badge, EmptyState, PrimaryButton } from '../components/ui';
import type { RootStackParamList, TabParamList } from '../navigation';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Transactions'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function TransactionsScreen() {
  const navigation = useNavigation<NavProp>();
  const { cards, manualTransactions, removeTransaction } = useStore();

  const cardMap = React.useMemo(() => {
    const map: Record<string, CreditCard> = {};
    for (const c of cards) map[c.id] = c;
    return map;
  }, [cards]);

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

  const renderItem = ({ item }: { item: Transaction }) => {
    const txnCard = item.cardId ? cardMap[item.cardId] : undefined;
    return (
    <View style={styles.row}>
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
        <TouchableOpacity
          onPress={() => removeTransaction(item.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.trashBtn}
        >
          <Feather name="trash-2" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
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
          data={manualTransactions}
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
              <View style={{ height: spacing.lg }} />
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
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
  trashBtn: {
    marginTop: 6,
    padding: 2,
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
});

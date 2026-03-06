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
import { colors, spacing, borderRadius, fontSize, formatINR } from '../theme';
import { useStore, Transaction } from '../store';
import { Card, StatRow, Badge, EmptyState, PrimaryButton } from '../components/ui';
import type { RootStackParamList, TabParamList } from '../navigation';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Transactions'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function TransactionsScreen() {
  const navigation = useNavigation<NavProp>();
  const { manualTransactions, removeTransaction } = useStore();

  const totalDebits = manualTransactions
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0);
  const totalCredits = manualTransactions
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: item.category_color }]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowDesc} numberOfLines={1}>
          {item.description}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowDate}>{item.date}</Text>
          <Badge text={item.category} color={item.category_color} />
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
          {formatINR(item.amount)}
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
                <StatRow
                  label="Total Debits"
                  value={formatINR(totalDebits)}
                  valueColor={colors.debit}
                />
                <StatRow
                  label="Total Credits"
                  value={formatINR(totalCredits)}
                  valueColor={colors.credit}
                />
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
});

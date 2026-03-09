import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import { useStore, CreditCard } from '../store';
import type { RootStackParamList } from '../navigation';
import type { CurrencyCode } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CardListScreen() {
  const navigation = useNavigation<Nav>();
  const { cards } = useStore();

  const renderCard = ({ item }: { item: CreditCard }) => {
    const currency = (item.currency || 'INR') as CurrencyCode;
    return (
      <TouchableOpacity
        style={styles.cardRow}
        onPress={() => navigation.navigate('EditCard', { cardId: item.id })}
        activeOpacity={0.7}
      >
        <View style={[styles.cardDot, { backgroundColor: item.color }]} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.nickname}</Text>
          <Text style={styles.cardMeta}>
            {item.issuer} · {item.network} · ····{item.last4}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardLimit}>{formatCurrency(item.creditLimit, currency)}</Text>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="credit-card" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySubtitle}>
              Cards are automatically created when you upload a statement, or you can add one from the Cards tab.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardLimit: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});

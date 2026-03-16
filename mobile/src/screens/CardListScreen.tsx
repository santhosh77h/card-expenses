import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, CreditCard } from '../store';
import ReminderDayPicker from '../components/ReminderDayPicker';
import { requestPermissions, scheduleGlobalReminder, cancelGlobalReminder } from '../utils/notifications';
import type { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CardListScreen() {
  const navigation = useNavigation<Nav>();
  const { cards, globalReminderDay, setGlobalReminderDay } = useStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleGlobalReminderChange = useCallback(async (day: number | null) => {
    if (day) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in your device settings to set reminders.');
        return;
      }
      await scheduleGlobalReminder(day);
    } else {
      await cancelGlobalReminder();
    }
    setGlobalReminderDay(day);
  }, [setGlobalReminderDay]);

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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={styles.cardMeta}>
              {item.issuer} · {item.network} · ····{item.last4}
            </Text>
            {item.reminderDay != null && (
              <View style={styles.reminderTag}>
                <Feather name="bell" size={10} color={colors.accent} />
                <Text style={styles.reminderTagText}>{item.reminderDay}{ordinal(item.reminderDay)}</Text>
              </View>
            )}
          </View>
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
        ListHeaderComponent={
          cards.length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <ReminderDayPicker
                label="Remind for All Cards"
                subtitle="Monthly reminder to upload all your statements"
                value={globalReminderDay}
                onChange={handleGlobalReminderChange}
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addCardBtn}
            onPress={() => navigation.navigate('AddCard')}
            activeOpacity={0.7}
          >
            <View style={styles.addCardIcon}>
              <Feather name="plus" size={18} color={colors.accent} />
            </View>
            <Text style={styles.addCardText}>Add New Card</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        }
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

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    lineHeight: 20,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  reminderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: spacing.sm,
    backgroundColor: colors.accent + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  reminderTagText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
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
    lineHeight: 18,
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  addCardText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
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
    fontWeight: '600',
    marginTop: spacing.lg,
    lineHeight: 26,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});

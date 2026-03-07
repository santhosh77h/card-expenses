import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, CURRENCY_CONFIG } from '../theme';
import { useStore, CreditCard } from '../store';
import { categorizeTransaction } from '../utils/api';
import { Badge, PrimaryButton } from '../components/ui';

export default function AddTransactionScreen() {
  const navigation = useNavigation();
  const { cards, addTransaction } = useStore();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(
    cards[0]?.id
  );

  const categoryInfo = useMemo(
    () => categorizeTransaction(description),
    [description]
  );

  const selectedCard = cards.find((c) => c.id === selectedCardId);
  const cardCurrency = selectedCard?.currency ?? 'INR';
  const currencySymbol = CURRENCY_CONFIG[cardCurrency].symbol;

  const canSave = description.trim().length > 0 && parseFloat(amount) > 0;

  function handleSave() {
    if (!canSave) return;
    addTransaction({
      id: Date.now().toString(),
      date,
      description: description.trim(),
      amount: parseFloat(amount),
      category: categoryInfo.category,
      category_color: categoryInfo.category_color,
      category_icon: categoryInfo.category_icon,
      type,
      cardId: selectedCardId,
      currency: cardCurrency,
    });
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Swiggy Order #123"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          autoFocus
        />

        {/* Live category preview */}
        {description.trim().length > 0 && (
          <View style={styles.categoryPreview}>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: categoryInfo.category_color },
              ]}
            />
            <Badge
              text={categoryInfo.category}
              color={categoryInfo.category_color}
            />
            {categoryInfo.category === 'Other' && (
              <Text style={styles.hint}>
                Tip: use keywords like "swiggy" or "uber" for auto-categorization
              </Text>
            )}
          </View>
        )}

        {/* Amount */}
        <Text style={styles.label}>Amount ({currencySymbol} {cardCurrency})</Text>
        <TextInput
          style={styles.input}
          placeholder={`e.g. ${currencySymbol}450`}
          placeholderTextColor={colors.textMuted}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          value={date}
          onChangeText={setDate}
        />

        {/* Card selector */}
        {cards.length > 0 && (
          <>
            <Text style={styles.label}>Card</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.sm }}
            >
              <TouchableOpacity
                style={[
                  styles.cardChip,
                  !selectedCardId && styles.cardChipActive,
                ]}
                onPress={() => setSelectedCardId(undefined)}
              >
                <Text style={[styles.cardChipText, !selectedCardId && styles.cardChipTextActive]}>
                  None
                </Text>
              </TouchableOpacity>
              {cards.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.cardChip,
                    selectedCardId === c.id && styles.cardChipActive,
                  ]}
                  onPress={() => setSelectedCardId(c.id)}
                >
                  <View style={[styles.cardChipDot, { backgroundColor: c.color }]} />
                  <Text style={[styles.cardChipText, selectedCardId === c.id && styles.cardChipTextActive]}>
                    {c.nickname} (*{c.last4})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Type toggle */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              type === 'debit' && styles.toggleActive,
              type === 'debit' && { borderColor: colors.debit },
            ]}
            onPress={() => setType('debit')}
          >
            <Feather
              name="arrow-up-right"
              size={16}
              color={type === 'debit' ? colors.debit : colors.textMuted}
            />
            <Text
              style={[
                styles.toggleText,
                type === 'debit' && { color: colors.debit },
              ]}
            >
              Debit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              type === 'credit' && styles.toggleActive,
              type === 'credit' && { borderColor: colors.credit },
            ]}
            onPress={() => setType('credit')}
          >
            <Feather
              name="arrow-down-left"
              size={16}
              color={type === 'credit' ? colors.credit : colors.textMuted}
            />
            <Text
              style={[
                styles.toggleText,
                type === 'credit' && { color: colors.credit },
              ]}
            >
              Credit
            </Text>
          </TouchableOpacity>
        </View>

        {/* Save button */}
        <View style={{ marginTop: spacing.xxl }}>
          <PrimaryButton
            title="Save Transaction"
            icon="check"
            onPress={handleSave}
            disabled={!canSave}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    flexBasis: '100%',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    gap: 6,
  },
  cardChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  cardChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cardChipTextActive: {
    color: colors.accent,
  },
  cardChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

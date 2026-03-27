/**
 * EditTransactionSheet — Monarch-style edit form that slides up as a modal.
 *
 * Uses React Native Modal (no external bottom sheet library).
 * Shows a full edit form with "Original: ..." annotations, per-field revert,
 * and "Revert All" action.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, CURRENCY_CONFIG, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction, CreditCard } from '../store';
import { PrimaryButton } from './ui';
import DatePickerField from './DatePickerField';
import { CATEGORIES } from '../utils/api';
import { getOriginalTransaction } from '../db/transactions';
import { getEditedFieldsMap } from '../db/transactionEdits';
import LabelPicker from './LabelPicker';

interface Props {
  visible: boolean;
  transaction: Transaction | null;
  card?: CreditCard;
  onClose: () => void;
  onSave: (txnId: string, updates: Partial<Transaction>) => void;
}

export default function EditTransactionSheet({ visible, transaction, card, onClose, onSave }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    enrichments, updateEnrichment, revertTransactionField, revertAllTransactionEdits,
    defaultCurrency, cards, transactionLabels, addLabelToTransaction, removeLabelFromTransaction,
  } = useStore();

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [categoryColor, setCategoryColor] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('');
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [notes, setNotes] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(undefined);
  const [editedFields, setEditedFields] = useState<Record<string, { oldValue: string; newValue: string }>>({});

  const amountRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput>(null);

  const selectedCard = cards.find((c) => c.id === selectedCardId);
  const currency: CurrencyCode = selectedCard?.currency ?? transaction?.currency ?? card?.currency ?? defaultCurrency;
  const currencySymbol = CURRENCY_CONFIG[currency].symbol;

  // Quick amount presets
  const quickAmounts = useMemo(() => {
    if (currency === 'INR') return [100, 500, 1000, 5000];
    return [10, 50, 100, 500];
  }, [currency]);
  const incrementStep = currency === 'INR' ? 100 : 10;

  // Populate form when transaction changes or sheet opens
  useEffect(() => {
    if (!transaction || !visible) return;
    setDescription(transaction.description);
    setAmount(transaction.amount.toString());
    setDate(transaction.date);
    setCategory(transaction.category);
    setCategoryColor(transaction.category_color);
    setCategoryIcon(transaction.category_icon);
    setType(transaction.type);
    setSelectedCardId(transaction.cardId);
    setNotes(enrichments[transaction.id]?.notes ?? '');
    try {
      setEditedFields(getEditedFieldsMap(transaction.id));
    } catch {
      setEditedFields({});
    }
  }, [transaction?.id, visible]);

  const handleSave = useCallback(() => {
    if (!transaction) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number.');
      return;
    }
    onSave(transaction.id, {
      description: description.trim() || transaction.description,
      amount: parsedAmount,
      date: date || transaction.date,
      category,
      category_color: categoryColor,
      category_icon: categoryIcon,
      type,
      cardId: selectedCardId,
    });
    // Save notes
    const currentNotes = enrichments[transaction.id]?.notes ?? '';
    if (notes.trim() !== currentNotes) {
      updateEnrichment(transaction.id, { notes: notes.trim() || undefined });
    }
    onClose();
  }, [transaction, description, amount, date, category, categoryColor, categoryIcon, type, notes, onSave, onClose, enrichments, updateEnrichment]);

  const handleRevertField = useCallback((field: string, oldValue: string) => {
    if (!transaction) return;
    revertTransactionField(transaction.id, field);
    switch (field) {
      case 'description': setDescription(oldValue); break;
      case 'amount': setAmount(oldValue); break;
      case 'date': setDate(oldValue); break;
      case 'category': {
        const cat = CATEGORIES.find((c) => c.name === oldValue);
        if (cat) { setCategory(cat.name); setCategoryColor(cat.color); setCategoryIcon(cat.icon); }
        break;
      }
      case 'type': setType(oldValue as 'debit' | 'credit'); break;
    }
    setEditedFields((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }, [transaction, revertTransactionField]);

  const handleRevertAll = useCallback(() => {
    if (!transaction) return;
    Alert.alert(
      'Revert All Edits',
      'Restore this transaction to its original imported values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert All',
          style: 'destructive',
          onPress: () => {
            revertAllTransactionEdits(transaction.id);
            const orig = getOriginalTransaction(transaction.id);
            if (orig) {
              setDescription(orig.description);
              setAmount(orig.amount.toString());
              setDate(orig.date);
              setCategory(orig.category);
              setCategoryColor(orig.category_color);
              setCategoryIcon(orig.category_icon);
              setType(orig.type);
            }
            setEditedFields({});
            onClose();
          },
        },
      ],
    );
  }, [transaction, revertAllTransactionEdits, onClose]);

  if (!transaction) return null;

  const hasEdits = Object.keys(editedFields).length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Edit Transaction</Text>
              {transaction.isEdited && (
                <View style={styles.editedPill}>
                  <Text style={styles.editedPillText}>edited</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => amountRef.current?.focus()}
            />
            {editedFields.description && (
              <OriginalHint
                value={editedFields.description.oldValue}
                onRevert={() => handleRevertField('description', editedFields.description.oldValue)}
                colors={colors}
              />
            )}

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => {
                const isActive = category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => { setCategory(cat.name); setCategoryColor(cat.color); setCategoryIcon(cat.icon); }}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]} numberOfLines={1}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {editedFields.category && (
              <OriginalHint
                value={editedFields.category.oldValue}
                onRevert={() => handleRevertField('category', editedFields.category.oldValue)}
                colors={colors}
              />
            )}

            {/* Amount */}
            <Text style={styles.label}>Amount ({currencySymbol} {currency})</Text>
            <TextInput
              ref={amountRef}
              style={[styles.input, { color: type === 'debit' ? colors.debit : colors.credit }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => dateRef.current?.focus()}
            />
            {editedFields.amount && (
              <OriginalHint
                value={editedFields.amount.oldValue}
                onRevert={() => handleRevertField('amount', editedFields.amount.oldValue)}
                colors={colors}
              />
            )}

            {/* Quick amount pills */}
            <View style={styles.quickAmountRow}>
              {quickAmounts.map((qa) => (
                <TouchableOpacity
                  key={qa}
                  style={[
                    styles.quickAmountBtn,
                    parseFloat(amount) === qa && styles.quickAmountBtnActive,
                  ]}
                  onPress={() => setAmount(qa.toString())}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      parseFloat(amount) === qa && styles.quickAmountTextActive,
                    ]}
                  >
                    {currencySymbol}{qa >= 1000 ? `${qa / 1000}K` : qa}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.incrementBtn}
                onPress={() => {
                  const current = parseFloat(amount) || 0;
                  setAmount(Math.max(0, current - incrementStep).toString());
                }}
              >
                <Feather name="minus" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.incrementBtn}
                onPress={() => {
                  const current = parseFloat(amount) || 0;
                  setAmount((current + incrementStep).toString());
                }}
              >
                <Feather name="plus" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Type toggle */}
            <Text style={styles.label}>Type</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, type === 'debit' && styles.toggleActive, type === 'debit' && { borderColor: colors.debit }]}
                onPress={() => setType('debit')}
              >
                <Feather name="arrow-up-right" size={16} color={type === 'debit' ? colors.debit : colors.textMuted} />
                <Text style={[styles.toggleText, type === 'debit' && { color: colors.debit }]}>Debit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, type === 'credit' && styles.toggleActive, type === 'credit' && { borderColor: colors.credit }]}
                onPress={() => setType('credit')}
              >
                <Feather name="arrow-down-left" size={16} color={type === 'credit' ? colors.credit : colors.textMuted} />
                <Text style={[styles.toggleText, type === 'credit' && { color: colors.credit }]}>Credit</Text>
              </TouchableOpacity>
            </View>

            {/* Date */}
            <Text style={styles.label}>Date</Text>
            <DatePickerField value={date} onChange={setDate} />
            {editedFields.date && (
              <OriginalHint
                value={editedFields.date.oldValue}
                onRevert={() => handleRevertField('date', editedFields.date.oldValue)}
                colors={colors}
              />
            )}

            {/* Card selector */}
            <Text style={styles.label}>Card</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.xs }}
            >
              <TouchableOpacity
                style={[styles.cardChip, !selectedCardId && styles.cardChipActive]}
                onPress={() => setSelectedCardId(undefined)}
              >
                <Text style={[styles.cardChipText, !selectedCardId && styles.cardChipTextActive]}>None</Text>
              </TouchableOpacity>
              {cards.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.cardChip, selectedCardId === c.id && styles.cardChipActive]}
                  onPress={() => setSelectedCardId(c.id)}
                >
                  <View style={[styles.cardChipDot, { backgroundColor: c.color }]} />
                  <Text style={[styles.cardChipText, selectedCardId === c.id && styles.cardChipTextActive]}>
                    {c.nickname} (*{c.last4})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Labels */}
            <Text style={styles.label}>Labels</Text>
            <LabelPicker
              selectedIds={transaction ? (transactionLabels[transaction.id] ?? []) : []}
              onChange={(ids) => {
                if (!transaction) return;
                const current = transactionLabels[transaction.id] ?? [];
                for (const id of ids) {
                  if (!current.includes(id)) addLabelToTransaction(transaction.id, id);
                }
                for (const id of current) {
                  if (!ids.includes(id)) removeLabelFromTransaction(transaction.id, id);
                }
              }}
            />

            {/* Notes */}
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            {/* Actions */}
            <View style={styles.actions}>
              <PrimaryButton title="Save Changes" icon="check" onPress={handleSave} />
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {hasEdits && (
              <TouchableOpacity style={styles.revertAllBtn} onPress={handleRevertAll}>
                <Feather name="rotate-ccw" size={14} color={colors.warning} />
                <Text style={styles.revertAllText}>Revert All Edits</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Original value hint with revert button
// ---------------------------------------------------------------------------

function OriginalHint({ value, onRevert, colors }: { value: string; onRevert: () => void; colors: ThemeColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontStyle: 'italic', flex: 1 }} numberOfLines={1}>
        Original: {value}
      </Text>
      <TouchableOpacity onPress={onRevert} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="rotate-ccw" size={12} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  editedPill: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  editedPillText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 18,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryScroll: {
    marginBottom: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: colors.accent + '15',
    borderColor: colors.accent,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: colors.accent,
  },
  quickAmountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  quickAmountBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountBtnActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  quickAmountText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  quickAmountTextActive: {
    color: colors.accent,
  },
  incrementBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
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
    fontWeight: '500',
    lineHeight: 18,
  },
  cardChipTextActive: {
    color: colors.accent,
  },
  cardChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    backgroundColor: colors.surfaceElevated,
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
    fontWeight: '500',
    lineHeight: 20,
  },
  actions: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  revertAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.warning + '50',
    marginTop: spacing.lg,
  },
  revertAllText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { spacing, borderRadius, fontSize, CURRENCY_CONFIG, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction } from '../store';
import { PrimaryButton } from '../components/ui';
import DatePickerField from '../components/DatePickerField';
import LabelPicker from '../components/LabelPicker';
import { CATEGORIES } from '../utils/api';
import { getOriginalTransaction } from '../db/transactions';
import { getEditedFieldsMap } from '../db/transactionEdits';
import { pickReceiptImage, captureReceiptPhoto, saveReceipt, deleteReceipt } from '../utils/receipts';
import type { RootStackParamList } from '../navigation';

type EditRoute = RouteProp<RootStackParamList, 'EditTransaction'>;

export default function EditTransactionScreen() {
  const { params } = useRoute<EditRoute>();
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    manualTransactions, enrichments, updateEnrichment, toggleFlag,
    updateManualTransaction, revertTransactionField, revertAllTransactionEdits,
    removeTransaction, removeEnrichment, defaultCurrency, cards,
    transactionLabels, addLabelToTransaction, removeLabelFromTransaction,
  } = useStore();

  // Find transaction from store
  const transaction = manualTransactions.find((t) => t.id === params.transactionId) ?? null;
  const enrichment = transaction ? enrichments[transaction.id] : undefined;
  const card = transaction?.cardId ? cards.find((c) => c.id === transaction.cardId) : undefined;

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

  const selectedCard = cards.find((c) => c.id === selectedCardId);
  const currency: CurrencyCode = selectedCard?.currency ?? transaction?.currency ?? card?.currency ?? defaultCurrency;
  const currencySymbol = CURRENCY_CONFIG[currency].symbol;
  const isFlagged = enrichment?.flagged ?? false;

  const quickAmounts = useMemo(() => currency === 'INR' ? [100, 500, 1000, 5000] : [10, 50, 100, 500], [currency]);
  const incrementStep = currency === 'INR' ? 100 : 10;

  // Populate form
  useEffect(() => {
    if (!transaction) return;
    setDescription(transaction.description);
    setAmount(transaction.amount.toString());
    setDate(transaction.date);
    setCategory(transaction.category);
    setCategoryColor(transaction.category_color);
    setCategoryIcon(transaction.category_icon);
    setType(transaction.type);
    setSelectedCardId(transaction.cardId);
    setNotes(enrichment?.notes ?? '');
    try { setEditedFields(getEditedFieldsMap(transaction.id)); } catch { setEditedFields({}); }
  }, [transaction?.id]);

  const handleSave = useCallback(() => {
    if (!transaction) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number.');
      return;
    }
    updateManualTransaction(transaction.id, {
      description: description.trim() || transaction.description,
      amount: parsedAmount,
      date: date || transaction.date,
      category, category_color: categoryColor, category_icon: categoryIcon,
      type,
    });
    const currentNotes = enrichment?.notes ?? '';
    if (notes.trim() !== currentNotes) {
      updateEnrichment(transaction.id, { notes: notes.trim() || undefined });
    }
    navigation.goBack();
  }, [transaction, description, amount, date, category, categoryColor, categoryIcon, type, selectedCardId, notes, enrichment, updateManualTransaction, updateEnrichment, navigation]);

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
    Alert.alert('Revert All Edits', 'Restore this transaction to its original imported values?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revert All', style: 'destructive',
        onPress: () => {
          revertAllTransactionEdits(transaction.id);
          const orig = getOriginalTransaction(transaction.id);
          if (orig) {
            setDescription(orig.description); setAmount(orig.amount.toString());
            setDate(orig.date); setCategory(orig.category);
            setCategoryColor(orig.category_color); setCategoryIcon(orig.category_icon);
            setType(orig.type);
          }
          setEditedFields({});
          navigation.goBack();
        },
      },
    ]);
  }, [transaction, revertAllTransactionEdits, navigation]);

  const handleDelete = useCallback(() => {
    if (!transaction) return;
    Alert.alert('Delete Transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          if (enrichment?.receiptUri) deleteReceipt(enrichment.receiptUri).catch(() => {});
          removeTransaction(transaction.id);
          // Go back twice (edit → detail → list)
          navigation.goBack();
          setTimeout(() => navigation.goBack(), 100);
        },
      },
    ]);
  }, [transaction, enrichment, removeTransaction, navigation]);

  const handlePickPhoto = async () => {
    if (!transaction) return;
    const uri = await pickReceiptImage();
    if (uri) {
      const saved = await saveReceipt(uri, transaction.id);
      updateEnrichment(transaction.id, { receiptUri: saved });
    }
  };

  const handleCapturePhoto = async () => {
    if (!transaction) return;
    const uri = await captureReceiptPhoto();
    if (uri) {
      const saved = await saveReceipt(uri, transaction.id);
      updateEnrichment(transaction.id, { receiptUri: saved });
    }
  };

  const handleRemoveReceipt = () => {
    if (!transaction || !enrichment?.receiptUri) return;
    Alert.alert('Remove Receipt', 'Delete the attached receipt photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteReceipt(enrichment.receiptUri!);
          updateEnrichment(transaction.id, { receiptUri: undefined });
        },
      },
    ]);
  };

  if (!transaction) return null;

  const hasEdits = Object.keys(editedFields).length > 0;
  const isManual = true; // Only manual transactions can be edited via this screen

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Description */}
        <View style={styles.surfaceCard}>
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
            <OriginalHint value={editedFields.description.oldValue} onRevert={() => handleRevertField('description', editedFields.description.oldValue)} colors={colors} />
          )}

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.name;
              return (
                <TouchableOpacity key={cat.name} style={[styles.categoryChip, isActive && styles.categoryChipActive]} onPress={() => { setCategory(cat.name); setCategoryColor(cat.color); setCategoryIcon(cat.icon); }}>
                  <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]} numberOfLines={1}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {editedFields.category && (
            <OriginalHint value={editedFields.category.oldValue} onRevert={() => handleRevertField('category', editedFields.category.oldValue)} colors={colors} />
          )}
        </View>

        {/* Amount & Type */}
        <View style={styles.surfaceCard}>
          <Text style={styles.label}>Amount ({currencySymbol} {currency})</Text>
          <TextInput
            ref={amountRef}
            style={[styles.input, { color: type === 'debit' ? colors.debit : colors.credit }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
          />
          {editedFields.amount && (
            <OriginalHint value={editedFields.amount.oldValue} onRevert={() => handleRevertField('amount', editedFields.amount.oldValue)} colors={colors} />
          )}
          <View style={styles.quickAmountRow}>
            {quickAmounts.map((qa) => (
              <TouchableOpacity key={qa} style={[styles.quickAmountBtn, parseFloat(amount) === qa && styles.quickAmountBtnActive]} onPress={() => setAmount(qa.toString())}>
                <Text style={[styles.quickAmountText, parseFloat(amount) === qa && styles.quickAmountTextActive]}>
                  {currencySymbol}{qa >= 1000 ? `${qa / 1000}K` : qa}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.incrementBtn} onPress={() => setAmount(Math.max(0, (parseFloat(amount) || 0) - incrementStep).toString())}>
              <Feather name="minus" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.incrementBtn} onPress={() => setAmount(((parseFloat(amount) || 0) + incrementStep).toString())}>
              <Feather name="plus" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Type</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, type === 'debit' && styles.toggleActive, type === 'debit' && { borderColor: colors.debit }]} onPress={() => setType('debit')}>
              <Feather name="arrow-up-right" size={16} color={type === 'debit' ? colors.debit : colors.textMuted} />
              <Text style={[styles.toggleText, type === 'debit' && { color: colors.debit }]}>Debit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, type === 'credit' && styles.toggleActive, type === 'credit' && { borderColor: colors.credit }]} onPress={() => setType('credit')}>
              <Feather name="arrow-down-left" size={16} color={type === 'credit' ? colors.credit : colors.textMuted} />
              <Text style={[styles.toggleText, type === 'credit' && { color: colors.credit }]}>Credit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Card */}
        <View style={styles.surfaceCard}>
          <Text style={styles.label}>Date</Text>
          <DatePickerField value={date} onChange={setDate} />
          {editedFields.date && (
            <OriginalHint value={editedFields.date.oldValue} onRevert={() => handleRevertField('date', editedFields.date.oldValue)} colors={colors} />
          )}

          <Text style={styles.label}>Card</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
            <TouchableOpacity style={[styles.cardChip, !selectedCardId && styles.cardChipActive]} onPress={() => setSelectedCardId(undefined)}>
              <Text style={[styles.cardChipText, !selectedCardId && styles.cardChipTextActive]}>None</Text>
            </TouchableOpacity>
            {cards.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.cardChip, selectedCardId === c.id && styles.cardChipActive]} onPress={() => setSelectedCardId(c.id)}>
                <View style={[styles.cardChipDot, { backgroundColor: c.color }]} />
                <Text style={[styles.cardChipText, selectedCardId === c.id && styles.cardChipTextActive]}>{c.nickname} (*{c.last4})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Labels & Notes & Flag */}
        <View style={styles.surfaceCard}>
          <Text style={styles.label}>Labels</Text>
          <LabelPicker
            selectedIds={transactionLabels[transaction.id] ?? []}
            onChange={(ids) => {
              const current = transactionLabels[transaction.id] ?? [];
              for (const id of ids) { if (!current.includes(id)) addLabelToTransaction(transaction.id, id); }
              for (const id of current) { if (!ids.includes(id)) removeLabelFromTransaction(transaction.id, id); }
            }}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note..."
            placeholderTextColor={colors.textMuted}
            multiline
          />

          {/* Flag toggle */}
          <TouchableOpacity style={styles.flagRow} onPress={() => toggleFlag(transaction.id)} activeOpacity={0.7}>
            <Feather name="star" size={18} color={isFlagged ? colors.warning : colors.textMuted} />
            <Text style={[styles.flagText, isFlagged && { color: colors.warning }]}>
              {isFlagged ? 'Flagged' : 'Flag this transaction'}
            </Text>
            <View style={[styles.flagToggle, isFlagged && styles.flagToggleActive]}>
              <View style={[styles.flagToggleKnob, isFlagged && styles.flagToggleKnobActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Receipt */}
        <View style={styles.surfaceCard}>
          <Text style={styles.label}>Receipt</Text>
          {enrichment?.receiptUri ? (
            <View>
              <Image source={{ uri: enrichment.receiptUri }} style={styles.receiptImage} />
              <TouchableOpacity style={styles.removeReceiptBtn} onPress={handleRemoveReceipt}>
                <Feather name="x" size={14} color={colors.debit} />
                <Text style={[styles.removeReceiptText, { color: colors.debit }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.receiptButtons}>
              <TouchableOpacity style={styles.receiptBtn} onPress={handleCapturePhoto}>
                <Feather name="camera" size={18} color={colors.accent} />
                <Text style={styles.receiptBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.receiptBtn} onPress={handlePickPhoto}>
                <Feather name="image" size={18} color={colors.accent} />
                <Text style={styles.receiptBtnText}>Library</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <PrimaryButton title="Save Changes" icon="check" onPress={handleSave} />
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          {hasEdits && (
            <TouchableOpacity style={styles.revertAllBtn} onPress={handleRevertAll}>
              <Feather name="rotate-ccw" size={14} color={colors.warning} />
              <Text style={styles.revertAllText}>Revert All Edits</Text>
            </TouchableOpacity>
          )}

          {isManual && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Feather name="trash-2" size={16} color={colors.debit} />
              <Text style={[styles.deleteBtnText, { color: colors.debit }]}>Delete Transaction</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Original value hint
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  surfaceCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    borderWidth: 2,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '500',
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
  },
  cardChipTextActive: {
    color: colors.accent,
  },
  cardChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  flagText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  flagToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceElevated,
    padding: 3,
    justifyContent: 'center',
  },
  flagToggleActive: {
    backgroundColor: colors.warning,
  },
  flagToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
  },
  flagToggleKnobActive: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
  },
  removeReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  removeReceiptText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  receiptButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  receiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  receiptBtnText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
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
    marginTop: spacing.md,
  },
  revertAllText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.debit,
    marginTop: spacing.md,
  },
  deleteBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

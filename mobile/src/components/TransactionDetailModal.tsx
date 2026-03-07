import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../theme';
import { useStore, Transaction, CreditCard } from '../store';
import { Badge } from './ui';
import { pickReceiptImage, captureReceiptPhoto, saveReceipt, deleteReceipt } from '../utils/receipts';

interface Props {
  visible: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  card?: CreditCard;
  isManual?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function TransactionDetailModal({
  visible,
  transaction,
  onClose,
  card,
  isManual = false,
  onNext,
  onPrev,
}: Props) {
  const { enrichments, updateEnrichment, toggleFlag, removeTransaction, removeEnrichment } = useStore();

  const enrichment = transaction ? enrichments[transaction.id] : undefined;
  const [notes, setNotes] = useState(enrichment?.notes ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync notes when transaction changes
  useEffect(() => {
    setNotes(enrichment?.notes ?? '');
  }, [transaction?.id, enrichment?.notes]);

  const saveNotes = useCallback(
    (text: string) => {
      if (!transaction) return;
      updateEnrichment(transaction.id, { notes: text || undefined });
    },
    [transaction, updateEnrichment],
  );

  const handleNotesChange = (text: string) => {
    setNotes(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(text), 300);
  };

  const handleNotesBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    saveNotes(notes);
  };

  const handleToggleFlag = () => {
    if (!transaction) return;
    toggleFlag(transaction.id);
  };

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
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(enrichment.receiptUri!);
          updateEnrichment(transaction.id, { receiptUri: undefined });
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!transaction) return;
    Alert.alert('Delete Transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (enrichment?.receiptUri) {
            deleteReceipt(enrichment.receiptUri).catch(() => {});
          }
          removeTransaction(transaction.id);
          onClose();
        },
      },
    ]);
  };

  if (!transaction) return null;

  const currency: CurrencyCode = transaction.currency ?? card?.currency ?? 'INR';
  const isFlagged = enrichment?.flagged ?? false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handleBar} />

          {/* Prev / Next navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navBtn, !onPrev && styles.navBtnDisabled]}
              onPress={onPrev}
              disabled={!onPrev}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-left" size={18} color={onPrev ? colors.textPrimary : colors.textMuted} />
              <Text style={[styles.navBtnText, !onPrev && styles.navBtnTextDisabled]}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtn, !onNext && styles.navBtnDisabled]}
              onPress={onNext}
              disabled={!onNext}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.navBtnText, !onNext && styles.navBtnTextDisabled]}>Next</Text>
              <Feather name="chevron-right" size={18} color={onNext ? colors.textPrimary : colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.xxxl }}
          >
            {/* Header: description + flag */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.categoryDot, { backgroundColor: transaction.category_color }]} />
                <Text style={styles.description} numberOfLines={2}>
                  {transaction.description}
                </Text>
              </View>
              <TouchableOpacity onPress={handleToggleFlag} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Feather
                  name="star"
                  size={22}
                  color={isFlagged ? colors.warning : colors.textMuted}
                  style={isFlagged ? { opacity: 1 } : undefined}
                />
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <Text
              style={[
                styles.amount,
                { color: transaction.type === 'debit' ? colors.debit : colors.credit },
              ]}
            >
              {transaction.type === 'debit' ? '-' : '+'}
              {formatCurrency(transaction.amount, currency)}
            </Text>

            {/* Details */}
            <View style={styles.detailsSection}>
              <View style={styles.detailRow}>
                <Feather name="calendar" size={14} color={colors.textMuted} />
                <Text style={styles.detailText}>{transaction.date}</Text>
              </View>
              <View style={styles.detailRow}>
                <Feather name="tag" size={14} color={colors.textMuted} />
                <Badge text={transaction.category} color={transaction.category_color} />
              </View>
              {card && (
                <View style={styles.detailRow}>
                  <Feather name="credit-card" size={14} color={colors.textMuted} />
                  <View style={[styles.cardDot, { backgroundColor: card.color }]} />
                  <Text style={styles.detailText}>{card.nickname}</Text>
                </View>
              )}
            </View>

            {/* Notes */}
            <Text style={styles.sectionLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={handleNotesChange}
              onBlur={handleNotesBlur}
              multiline
              textAlignVertical="top"
            />

            {/* Receipt */}
            <Text style={styles.sectionLabel}>Receipt</Text>
            {enrichment?.receiptUri ? (
              <View style={styles.receiptContainer}>
                <Image source={{ uri: enrichment.receiptUri }} style={styles.receiptImage} />
                <TouchableOpacity style={styles.removeReceiptBtn} onPress={handleRemoveReceipt}>
                  <Feather name="x" size={14} color={colors.debit} />
                  <Text style={styles.removeReceiptText}>Remove</Text>
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
                  <Text style={styles.receiptBtnText}>Choose from Library</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Delete (manual only) */}
            {isManual && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Feather name="trash-2" size={16} color={colors.debit} />
                <Text style={styles.deleteText}>Delete Transaction</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  navBtnTextDisabled: {
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  description: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    flex: 1,
  },
  amount: {
    fontSize: fontSize.hero,
    fontWeight: '800',
    marginBottom: spacing.lg,
  },
  detailsSection: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    minHeight: 80,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptContainer: {
    marginBottom: spacing.lg,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
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
    color: colors.debit,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  receiptButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  receiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  receiptBtnText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.debit,
    marginTop: spacing.md,
  },
  deleteText: {
    color: colors.debit,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});

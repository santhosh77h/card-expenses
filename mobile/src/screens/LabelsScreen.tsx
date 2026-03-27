import React, { useMemo, useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Label, Transaction } from '../store';
import { EmptyState } from '../components/ui';
import TransactionDetailModal from '../components/TransactionDetailModal';

const LABEL_COLORS = [
  '#FF6B6B', '#F472B6', '#A78BFA', '#818CF8',
  '#22D3EE', '#34D399', '#4ADE80', '#FBBF24',
  '#FFB547', '#60A5FA', '#94A3B8', '#E879F9',
];

const LABEL_ICONS: (keyof typeof Feather.glyphMap)[] = [
  'tag', 'briefcase', 'map-pin', 'globe', 'gift',
  'heart', 'home', 'coffee', 'sun', 'zap',
  'users', 'flag', 'folder', 'bookmark', 'star',
  'truck',
];

export default function LabelsScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    labels,
    transactionLabels,
    manualTransactions,
    statements,
    enrichments,
    cards,
    defaultCurrency,
    deleteLabel,
    updateLabel,
    updateManualTransaction,
  } = useStore();

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const selectedLabel = labels.find((l) => l.id === selectedLabelId);

  // Dynamic navigation header
  useLayoutEffect(() => {
    if (selectedLabelId && selectedLabel) {
      navigation.setOptions({
        headerTitle: selectedLabel.name,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => setSelectedLabelId(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginLeft: Platform.OS === 'ios' ? 0 : spacing.sm }}
          >
            <Feather name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setShowEditModal(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: spacing.lg }}
          >
            <Text style={{ color: colors.accent, fontSize: fontSize.md, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerTitle: 'Labels',
        headerLeft: undefined,
        headerRight: undefined,
      });
    }
  }, [navigation, selectedLabelId, selectedLabel, colors]);

  // Build a quick lookup: txnId → Transaction
  const allTransactions = useMemo(() => {
    const map = new Map<string, Transaction>();
    for (const t of manualTransactions) map.set(t.id, t);
    for (const stmts of Object.values(statements)) {
      for (const stmt of stmts) {
        for (const t of stmt.transactions) map.set(t.id, t);
      }
    }
    return map;
  }, [manualTransactions, statements]);

  // Reverse index: labelId → Transaction[]
  const labelTransactions = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const [txnId, labelIds] of Object.entries(transactionLabels)) {
      const txn = allTransactions.get(txnId);
      if (!txn) continue;
      for (const lid of labelIds) {
        if (!map[lid]) map[lid] = [];
        map[lid].push(txn);
      }
    }
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => b.date.localeCompare(a.date));
    }
    return map;
  }, [transactionLabels, allTransactions]);

  // Label stats
  const labelStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; currency: CurrencyCode }> = {};
    for (const label of labels) {
      const txns = labelTransactions[label.id] ?? [];
      let total = 0;
      for (const t of txns) {
        total += t.type === 'debit' ? t.amount : -t.amount;
      }
      stats[label.id] = {
        total,
        count: txns.length,
        currency: txns[0]?.currency ?? defaultCurrency,
      };
    }
    return stats;
  }, [labels, labelTransactions, defaultCurrency]);

  const selectedTxns = selectedLabelId ? (labelTransactions[selectedLabelId] ?? []) : [];
  const selectedStats = selectedLabelId ? labelStats[selectedLabelId] : null;

  const handleDeleteLabel = useCallback(
    (label: Label) => {
      Alert.alert(
        'Delete Label',
        `Remove "${label.name}"? Transactions won't be deleted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              if (selectedLabelId === label.id) setSelectedLabelId(null);
              deleteLabel(label.id);
            },
          },
        ],
      );
    },
    [selectedLabelId, deleteLabel],
  );

  const detailCard = detailTxn?.cardId
    ? cards.find((c) => c.id === detailTxn.cardId)
    : undefined;

  // -------------------------------------------------------------------------
  // List view — all labels
  // -------------------------------------------------------------------------
  if (!selectedLabelId) {
    return (
      <View style={styles.container}>
        {labels.length === 0 ? (
          <EmptyState
            icon="tag"
            title="No labels yet"
            subtitle="Create labels in the Add Transaction screen to group related spending"
          />
        ) : (
          <FlatList
            data={labels}
            keyExtractor={(l) => l.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: label }) => {
              const stats = labelStats[label.id];
              return (
                <TouchableOpacity
                  style={styles.labelRow}
                  onPress={() => setSelectedLabelId(label.id)}
                  onLongPress={() => handleDeleteLabel(label)}
                >
                  <View style={[styles.labelIcon, { backgroundColor: label.color + '20' }]}>
                    <Feather
                      name={label.icon as keyof typeof Feather.glyphMap}
                      size={18}
                      color={label.color}
                    />
                  </View>
                  <View style={styles.labelInfo}>
                    <Text style={styles.labelName}>{label.name}</Text>
                    <Text style={styles.labelSub}>
                      {stats?.count ?? 0} transaction{(stats?.count ?? 0) !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.labelRight}>
                    <Text style={[styles.labelTotal, { color: colors.debit }]}>
                      {formatCurrency(stats?.total ?? 0, stats?.currency ?? defaultCurrency)}
                    </Text>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Detail view — transactions under a label
  // -------------------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Label info badge */}
      <View style={styles.labelBadgeRow}>
        <View style={[styles.labelBadge, { backgroundColor: selectedLabel!.color + '20', borderColor: selectedLabel!.color }]}>
          <Feather
            name={selectedLabel!.icon as keyof typeof Feather.glyphMap}
            size={14}
            color={selectedLabel!.color}
          />
          <Text style={[styles.labelBadgeText, { color: selectedLabel!.color }]}>
            {selectedLabel!.name}
          </Text>
        </View>
      </View>

      {/* Summary card */}
      {selectedStats && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={[styles.summaryValue, { color: colors.debit }]}>
              {formatCurrency(selectedStats.total, selectedStats.currency)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Transactions</Text>
            <Text style={styles.summaryValue}>{selectedStats.count}</Text>
          </View>
        </View>
      )}

      {/* Transaction list */}
      <FlatList
        data={selectedTxns}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="inbox"
            title="No transactions"
            subtitle="Add this label to transactions to see them here"
          />
        }
        renderItem={({ item: txn }) => {
          const card = txn.cardId ? cards.find((c) => c.id === txn.cardId) : undefined;
          return (
            <TouchableOpacity style={styles.txnRow} onPress={() => setDetailTxn(txn)}>
              <View style={[styles.txnDot, { backgroundColor: txn.category_color }]} />
              <View style={styles.txnInfo}>
                <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
                <Text style={styles.txnSub}>
                  {txn.date}{card ? ` \u00b7 ${card.nickname}` : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.txnAmount,
                  { color: txn.type === 'debit' ? colors.debit : colors.credit },
                ]}
              >
                {txn.type === 'debit' ? '-' : '+'}
                {formatCurrency(txn.amount, txn.currency ?? defaultCurrency)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Edit label modal */}
      {selectedLabel && (
        <EditLabelModal
          visible={showEditModal}
          label={selectedLabel}
          onClose={() => setShowEditModal(false)}
          onSave={(updates) => {
            updateLabel(selectedLabel.id, updates);
            setShowEditModal(false);
          }}
          colors={colors}
        />
      )}

      {/* Transaction detail modal */}
      <TransactionDetailModal
        visible={!!detailTxn}
        transaction={detailTxn}
        onClose={() => setDetailTxn(null)}
        card={detailCard}
        isManual={detailTxn?.cardId === undefined}
        onUpdateTransaction={(txnId, updates) => updateManualTransaction(txnId, updates)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Edit Label Modal
// ---------------------------------------------------------------------------

function EditLabelModal({
  visible,
  label,
  onClose,
  onSave,
  colors,
}: {
  visible: boolean;
  label: Label;
  onClose: () => void;
  onSave: (updates: Partial<Pick<Label, 'name' | 'color' | 'icon'>>) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createModalStyles(colors), [colors]);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [icon, setIcon] = useState(label.icon);

  // Reset form when label changes
  React.useEffect(() => {
    if (visible) {
      setName(label.name);
      setColor(label.color);
      setIcon(label.icon);
    }
  }, [label.id, visible]);

  const canSave = name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          <Text style={styles.title}>Edit Label</Text>

          {/* Name */}
          <TextInput
            style={styles.input}
            placeholder="Label name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* Color */}
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorGrid}>
            {LABEL_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  color === c && styles.colorSwatchActive,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && <Feather name="check" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Icon */}
          <Text style={styles.label}>Icon</Text>
          <View style={styles.iconGrid}>
            {LABEL_ICONS.map((ic) => (
              <TouchableOpacity
                key={ic}
                style={[
                  styles.iconBtn,
                  icon === ic && { backgroundColor: color + '20', borderColor: color },
                ]}
                onPress={() => setIcon(ic)}
              >
                <Feather
                  name={ic}
                  size={18}
                  color={icon === ic ? color : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          <View style={styles.previewRow}>
            <View style={[styles.previewChip, { backgroundColor: color + '20', borderColor: color }]}>
              <Feather name={icon as keyof typeof Feather.glyphMap} size={12} color={color} />
              <Text style={[styles.previewChipText, { color }]}>
                {name.trim() || 'Label'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}
              onPress={() => {
                if (!canSave) return;
                onSave({ name: name.trim(), color, icon });
              }}
              disabled={!canSave}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles — main screen
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      padding: spacing.lg,
      paddingBottom: 40,
    },
    // Label list
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    labelIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    labelInfo: {
      flex: 1,
    },
    labelName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
    labelSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    labelRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    labelTotal: {
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
    // Detail view
    labelBadgeRow: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    labelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    labelBadgeText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    // Summary card
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    summaryValue: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
    // Transaction rows
    txnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    txnDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    txnInfo: {
      flex: 1,
    },
    txnDesc: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      lineHeight: 20,
    },
    txnSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    txnAmount: {
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
  });

// ---------------------------------------------------------------------------
// Styles — edit modal
// ---------------------------------------------------------------------------

const createModalStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      paddingBottom: 40,
    },
    handleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      marginBottom: spacing.lg,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.lg,
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
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    colorSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchActive: {
      borderWidth: 3,
      borderColor: '#fff',
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewRow: {
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    previewChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    previewChipText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    cancelBtn: {
      flex: 1,
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
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.accent,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  });

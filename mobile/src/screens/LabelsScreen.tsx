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
  Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Label, Transaction } from '../store';
import { EmptyState } from '../components/ui';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { LABEL_COLORS, LABEL_ICONS, LABEL_ICON_SECTIONS } from '../constants/labels';

export default function LabelsScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    labels,
    transactionLabels,
    manualTransactions,
    statements,
    cards,
    defaultCurrency,
    deleteLabel,
    updateLabel,
    addLabel,
    updateManualTransaction,
  } = useStore();

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Feather name="chevron-left" size={24} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: fontSize.lg, fontWeight: '500' }}>Labels</Text>
            </View>
          </TouchableOpacity>
        ),
        headerRight: undefined,
      });
    } else {
      navigation.setOptions({
        headerTitle: 'Labels',
        headerLeft: undefined,
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: spacing.lg }}
          >
            <Feather name="plus" size={22} color={colors.accent} />
          </TouchableOpacity>
        ),
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

  // Label stats — grouped by currency
  const labelStats = useMemo(() => {
    const stats: Record<string, { totals: Record<string, number>; count: number }> = {};
    for (const label of labels) {
      const txns = labelTransactions[label.id] ?? [];
      const totals: Record<string, number> = {};
      for (const t of txns) {
        const cur = t.currency ?? defaultCurrency;
        if (!totals[cur]) totals[cur] = 0;
        totals[cur] += t.type === 'debit' ? t.amount : -t.amount;
      }
      stats[label.id] = { totals, count: txns.length };
    }
    return stats;
  }, [labels, labelTransactions, defaultCurrency]);

  // Global stats for list header
  const globalStats = useMemo(() => {
    let txnCount = 0;
    const totals: Record<string, number> = {};
    for (const label of labels) {
      const s = labelStats[label.id];
      if (!s) continue;
      txnCount += s.count;
      for (const [cur, amt] of Object.entries(s.totals)) {
        if (!totals[cur]) totals[cur] = 0;
        totals[cur] += amt;
      }
    }
    return { labelCount: labels.length, txnCount, totals };
  }, [labels, labelStats]);

  const selectedTxns = selectedLabelId ? (labelTransactions[selectedLabelId] ?? []) : [];
  const selectedStats = selectedLabelId ? labelStats[selectedLabelId] : null;

  // Group selected transactions by date
  const daySections = useMemo(() => {
    if (!selectedTxns.length) return [];
    const grouped: Record<string, Transaction[]> = {};
    for (const txn of selectedTxns) {
      const day = txn.date.substring(0, 10);
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(txn);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => {
        const totals: Record<string, number> = {};
        for (const t of data) {
          const cur = t.currency ?? defaultCurrency;
          if (!totals[cur]) totals[cur] = 0;
          totals[cur] += t.type === 'debit' ? t.amount : -t.amount;
        }
        return { date, totals, data };
      });
  }, [selectedTxns, defaultCurrency]);

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

  const handleExport = useCallback(async () => {
    if (!selectedLabel || !selectedTxns.length) return;
    try {
      const header = 'Date,Description,Category,Amount,Type,Currency\n';
      const rows = selectedTxns
        .map(
          (t) =>
            `${t.date},"${t.description.replace(/"/g, '""')}",${t.category},${t.amount},${t.type},${t.currency ?? defaultCurrency}`,
        )
        .join('\n');
      const path = `${FileSystem.cacheDirectory}vector-${selectedLabel.name.replace(/\s+/g, '-')}.csv`;
      await FileSystem.writeAsStringAsync(path, header + rows);
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${selectedLabel.name}`,
      });
    } catch {
      // Sharing cancelled
    }
  }, [selectedLabel, selectedTxns, defaultCurrency]);

  const handleCopy = useCallback(() => {
    if (!selectedLabel || !selectedStats) return;
    const lines = [`${selectedLabel.name}`];
    for (const [cur, total] of Object.entries(selectedStats.totals)) {
      lines.push(`Total: ${formatCurrency(total, cur as CurrencyCode)}`);
    }
    lines.push(`Transactions: ${selectedStats.count}`);
    if (selectedStats.count > 0) {
      for (const [cur, total] of Object.entries(selectedStats.totals)) {
        const avg = total / selectedStats.count;
        lines.push(`Avg/Txn: ${formatCurrency(avg, cur as CurrencyCode)}`);
      }
    }
    Share.share({ message: lines.join('\n') });
  }, [selectedLabel, selectedStats]);

  const detailCard = detailTxn?.cardId
    ? cards.find((c) => c.id === detailTxn.cardId)
    : undefined;

  const globalTotalEntries = Object.entries(globalStats.totals) as [CurrencyCode, number][];

  // -------------------------------------------------------------------------
  // List view — all labels
  // -------------------------------------------------------------------------
  if (!selectedLabelId) {
    const subtitleParts = [
      `${globalStats.labelCount} label${globalStats.labelCount !== 1 ? 's' : ''}`,
      ...globalTotalEntries.map(([cur, amt]) => formatCurrency(amt, cur)),
    ];

    const listHeader = labels.length > 0 ? (
      <>
        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {subtitleParts.join(' · ')} tracked
        </Text>

        {/* Three stat tiles */}
        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Labels</Text>
            <Text style={styles.statValue}>{globalStats.labelCount}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statValue}>{globalStats.txnCount}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Total</Text>
            {globalTotalEntries.length > 0 ? (
              globalTotalEntries.map(([cur, amt]) => (
                <Text key={cur} style={[styles.statValue, { color: colors.debit }]} numberOfLines={1}>
                  {formatCurrency(amt, cur)}
                </Text>
              ))
            ) : (
              <Text style={[styles.statValue, { color: colors.debit }]} numberOfLines={1}>
                {formatCurrency(0, defaultCurrency as CurrencyCode)}
              </Text>
            )}
          </View>
        </View>
      </>
    ) : null;

    return (
      <View style={styles.container}>
        {labels.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Visual showcase: example label chips ── */}
            <View style={styles.emptyChipCloud}>
              {[
                { icon: 'navigation' as const, name: 'Dubai Trip', color: '#22D3EE' },
                { icon: 'briefcase' as const, name: 'Office Supplies', color: '#A78BFA' },
                { icon: 'repeat' as const, name: 'Monthly Bills', color: '#FFB547' },
                { icon: 'shopping-cart' as const, name: 'Groceries', color: '#4ADE80' },
              ].map((example, i) => (
                <View
                  key={example.name}
                  style={[
                    styles.emptyChip,
                    { backgroundColor: example.color + '14', borderColor: example.color + '30' },
                    i === 0 && { transform: [{ rotate: '-2deg' }] },
                    i === 1 && { transform: [{ rotate: '1.5deg' }], marginTop: -6 },
                    i === 2 && { transform: [{ rotate: '-1deg' }] },
                    i === 3 && { transform: [{ rotate: '2deg' }], marginTop: -4 },
                  ]}
                >
                  <Feather name={example.icon} size={14} color={example.color} />
                  <Text style={[styles.emptyChipText, { color: example.color }]}>
                    {example.name}
                  </Text>
                </View>
              ))}
            </View>

            {/* ��─ Headline ── */}
            <Text style={styles.emptyHeadline}>
              Organize spending{'\n'}your way
            </Text>

            {/* ── Supporting text ── */}
            <Text style={styles.emptyBody}>
              Labels let you group transactions across cards and statements — perfect for tracking
              project budgets, trips, or recurring costs.
            </Text>

            {/* ── Use-case hints ── */}
            <View style={styles.emptyHints}>
              {[
                { icon: 'globe' as const, text: 'Track a trip like "Japan 2025" across all cards' },
                { icon: 'briefcase' as const, text: 'Separate work expenses for easy reimbursement' },
                { icon: 'pie-chart' as const, text: 'Compare spending across projects over time' },
              ].map((hint) => (
                <View key={hint.text} style={styles.emptyHintRow}>
                  <View style={styles.emptyHintIcon}>
                    <Feather name={hint.icon} size={15} color={colors.accent} />
                  </View>
                  <Text style={styles.emptyHintText}>{hint.text}</Text>
                </View>
              ))}
            </View>

            {/* ── CTA button ── */}
            <TouchableOpacity
              style={styles.emptyCta}
              activeOpacity={0.8}
              onPress={() => setShowCreateModal(true)}
            >
              <Feather name="plus" size={18} color={colors.textOnAccent} />
              <Text style={styles.emptyCtaText}>Create Your First Label</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <FlatList
            data={labels}
            keyExtractor={(l) => l.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={listHeader}
            renderItem={({ item: label }) => {
              const stats = labelStats[label.id];
              return (
                <TouchableOpacity
                  style={styles.labelRow}
                  onPress={() => setSelectedLabelId(label.id)}
                  onLongPress={() => handleDeleteLabel(label)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.labelIcon, { backgroundColor: label.color + '18' }]}>
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
                    {Object.entries(stats?.totals ?? {}).map(([cur, total]) => (
                      <Text key={cur} style={[styles.labelTotal, { color: label.color }]}>
                        {formatCurrency(total, cur as CurrencyCode)}
                      </Text>
                    ))}
                    <Feather name="chevron-right" size={16} color={colors.textMuted + '40'} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <LabelFormModal
          visible={showCreateModal}
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSave={(data) => {
            addLabel({
              id: Date.now().toString(),
              name: data.name,
              color: data.color,
              icon: data.icon,
              createdAt: new Date().toISOString(),
            });
            setShowCreateModal(false);
          }}
          colors={colors}
        />
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // Detail view — transactions under a label
  // -------------------------------------------------------------------------
  const detailTotalEntries = Object.entries(selectedStats?.totals ?? {}) as [CurrencyCode, number][];
  const txnCount = selectedStats?.count ?? 0;

  const detailHeader = (
    <>
      {/* Hero — large icon + pill + three-stat strip */}
      <View style={styles.heroSection}>
        <View style={[styles.heroIconWrap, { backgroundColor: selectedLabel!.color + '15' }]}>
          <Feather
            name={selectedLabel!.icon as keyof typeof Feather.glyphMap}
            size={52}
            color={selectedLabel!.color}
          />
        </View>

        <View style={[styles.heroPill, { backgroundColor: selectedLabel!.color + '18', borderColor: selectedLabel!.color }]}>
          <Feather name={selectedLabel!.icon as keyof typeof Feather.glyphMap} size={12} color={selectedLabel!.color} />
          <Text style={[styles.heroPillText, { color: selectedLabel!.color }]}>{selectedLabel!.name}</Text>
        </View>

        {/* Three-stat strip */}
        <View style={styles.heroStatStrip}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Total</Text>
            {detailTotalEntries.length > 0 ? (
              detailTotalEntries.map(([cur, amt]) => (
                <Text key={cur} style={[styles.heroStatValue, { color: colors.debit }]} numberOfLines={1}>
                  {formatCurrency(amt, cur)}
                </Text>
              ))
            ) : (
              <Text style={[styles.heroStatValue, { color: colors.debit }]} numberOfLines={1}>
                {formatCurrency(0, defaultCurrency as CurrencyCode)}
              </Text>
            )}
          </View>
          <View style={[styles.heroStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Transactions</Text>
            <Text style={styles.heroStatValue}>{txnCount}</Text>
          </View>
          <View style={[styles.heroStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Avg/Txn</Text>
            {detailTotalEntries.length > 0 ? (
              detailTotalEntries.map(([cur, amt]) => (
                <Text key={cur} style={styles.heroStatValue} numberOfLines={1}>
                  {formatCurrency(txnCount ? amt / txnCount : 0, cur)}
                </Text>
              ))
            ) : (
              <Text style={styles.heroStatValue} numberOfLines={1}>
                {formatCurrency(0, defaultCurrency as CurrencyCode)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Four action tiles */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionTile} onPress={() => setShowEditModal(true)}>
          <Feather name="edit-2" size={18} color={colors.accent} />
          <Text style={styles.actionTileLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionTile} onPress={handleExport}>
          <Feather name="upload" size={18} color={colors.accent} />
          <Text style={styles.actionTileLabel}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionTile} onPress={handleCopy}>
          <Feather name="copy" size={18} color={colors.accent} />
          <Text style={styles.actionTileLabel}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionTile, styles.actionTileDestructive]}
          onPress={() => handleDeleteLabel(selectedLabel!)}
        >
          <Feather name="trash-2" size={18} color={colors.debit} />
          <Text style={[styles.actionTileLabel, { color: colors.debit }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {daySections.length === 0 ? (
        <ScrollView>
          {detailHeader}
          <View style={styles.list}>
            <EmptyState
              icon="inbox"
              title="No transactions"
              subtitle="Add this label to transactions to see them here"
            />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={daySections}
          keyExtractor={(s) => s.date}
          contentContainerStyle={styles.list}
          ListHeaderComponent={detailHeader}
          renderItem={({ item: section }) => {
            const d = new Date(section.date + 'T00:00:00');
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const fullDate = d.toLocaleDateString('en-US', {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
            return (
              <View style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayHeaderDate}>{fullDate}</Text>
                    <Text style={styles.dayHeaderDay}>{dayName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {Object.entries(section.totals).map(([cur, total]) => (
                      <Text key={cur} style={[styles.dayHeaderTotal, { color: colors.debit }]}>
                        {formatCurrency(total as number, cur as CurrencyCode)}
                      </Text>
                    ))}
                    <Text style={styles.dayHeaderSub}>
                      {section.data.length} transaction{section.data.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {section.data.map((txn, idx) => (
                  <TouchableOpacity
                    key={txn.id}
                    style={[
                      styles.txnRow,
                      idx === section.data.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => setDetailTxn(txn)}
                  >
                    <View style={[styles.txnIcon, { backgroundColor: txn.category_color + '20' }]}>
                      <Feather
                        name={txn.category_icon as keyof typeof Feather.glyphMap}
                        size={16}
                        color={txn.category_color}
                      />
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnDesc} numberOfLines={1}>
                        {txn.description}
                      </Text>
                      <Text style={styles.txnSub}>{txn.category}</Text>
                    </View>
                    <Text
                      style={[
                        styles.txnAmount,
                        { color: txn.type === 'debit' ? colors.debit : colors.credit },
                      ]}
                    >
                      {txn.type === 'debit' ? '\u2013' : '+'}
                      {formatCurrency(txn.amount, txn.currency ?? defaultCurrency)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          }}
        />
      )}

      {/* Edit label modal */}
      {selectedLabel && (
        <LabelFormModal
          visible={showEditModal}
          mode="edit"
          initialValues={{ name: selectedLabel.name, color: selectedLabel.color, icon: selectedLabel.icon }}
          onClose={() => setShowEditModal(false)}
          onSave={(data) => {
            updateLabel(selectedLabel.id, data);
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
// Label Form Modal — shared for Create / Edit
// ---------------------------------------------------------------------------

function LabelFormModal({
  visible,
  mode,
  initialValues,
  onClose,
  onSave,
  colors,
}: {
  visible: boolean;
  mode: 'create' | 'edit';
  initialValues?: { name: string; color: string; icon: string };
  onClose: () => void;
  onSave: (data: { name: string; color: string; icon: string }) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createModalStyles(colors), [colors]);
  const [name, setName] = useState(initialValues?.name ?? '');
  const [color, setColor] = useState(initialValues?.color ?? LABEL_COLORS[0]);
  const [icon, setIcon] = useState(initialValues?.icon ?? LABEL_ICONS[0]);
  const [inputFocused, setInputFocused] = useState(false);

  // Reset form when initialValues change (edit mode)
  React.useEffect(() => {
    if (visible) {
      setName(initialValues?.name ?? '');
      setColor(initialValues?.color ?? LABEL_COLORS[0]);
      setIcon(initialValues?.icon ?? LABEL_ICONS[0]);
    }
  }, [visible, initialValues?.name, initialValues?.color, initialValues?.icon]);

  const canSave = name.trim().length > 0;
  const title = mode === 'create' ? 'New Label' : 'Edit Label';

  function handleDone() {
    if (!canSave) return;
    onSave({ name: name.trim(), color, icon });
    if (mode === 'create') {
      setName('');
      setColor(LABEL_COLORS[0]);
      setIcon(LABEL_ICONS[0]);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          {/* Sheet nav bar: Cancel | Title | Done */}
          <View style={styles.sheetNav}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.sheetNavCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetNavTitle}>{title}</Text>
            <TouchableOpacity
              onPress={handleDone}
              disabled={!canSave}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.sheetNavDone, !canSave && { opacity: 0.35 }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Live preview — pinned below nav bar, always visible */}
          <View style={styles.previewRow}>
            <View style={[styles.previewChip, { backgroundColor: color + '18', borderColor: color }]}>
              <Feather name={icon as keyof typeof Feather.glyphMap} size={14} color={color} />
              <Text style={[styles.previewChipText, { color }]}>{name.trim() || 'Label'}</Text>
            </View>
          </View>

          {/* Scrollable form */}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name input with icon + clear + focus state */}
            <View style={[styles.inputWrapper, inputFocused && styles.inputWrapperFocused]}>
              <Feather name="tag" size={16} color={inputFocused ? colors.accent : colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={mode === 'create' ? 'e.g. USA Trip' : 'Label name'}
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleDone}
              />
              {name.length > 0 && (
                <TouchableOpacity
                  onPress={() => setName('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Color — 6-column grid, double-ring selection */}
            <Text style={styles.sectionLabel}>COLOR</Text>
            <View style={styles.colorGrid}>
              {LABEL_COLORS.map((c) => {
                const isSelected = color === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatchOuter, isSelected && { borderColor: c }]}
                    onPress={() => setColor(c)}
                  >
                    <View style={[styles.colorSwatchInner, { backgroundColor: c }]}>
                      {isSelected && <Feather name="check" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Icons — grouped semantically */}
            <Text style={styles.sectionLabel}>ICON</Text>
            {LABEL_ICON_SECTIONS.map((section) => (
              <View key={section.title}>
                <Text style={styles.iconSectionTitle}>{section.title.toUpperCase()}</Text>
                <View style={styles.iconGrid}>
                  {section.icons.map((ic) => (
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
              </View>
            ))}

            <View style={{ height: spacing.xxl }} />
          </ScrollView>
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
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
    },

    // ── Empty state ──
    emptyContainer: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
      paddingBottom: 60,
    },
    emptyChipCloud: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xxxl,
      paddingHorizontal: spacing.lg,
    },
    emptyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    emptyChipText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    emptyHeadline: {
      color: colors.textPrimary,
      fontSize: fontSize.hero,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 38,
      letterSpacing: -0.5,
      marginBottom: spacing.md,
    },
    emptyBody: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 320,
      marginBottom: spacing.xxl,
    },
    emptyHints: {
      width: '100%',
      gap: spacing.lg,
      marginBottom: spacing.xxxl,
    },
    emptyHintRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    emptyHintIcon: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.md,
      backgroundColor: colors.accent + '14',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    emptyHintText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.full,
    },
    emptyCtaText: {
      color: colors.textOnAccent,
      fontSize: fontSize.md,
      fontWeight: '700',
    },

    // Subtitle below header
    subtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
      paddingBottom: spacing.md,
    },

    // Three stat tiles
    statRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginBottom: spacing.xs,
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      lineHeight: 24,
    },

    // Label rows
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

    // Hero section
    heroSection: {
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    heroIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    heroPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      marginBottom: spacing.lg,
    },
    heroPillText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    heroStatStrip: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      width: '100%',
    },
    heroStat: {
      flex: 1,
      alignItems: 'center',
    },
    heroStatLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginBottom: spacing.xs,
    },
    heroStatValue: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
      lineHeight: 20,
    },
    heroStatDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginHorizontal: spacing.sm,
    },

    // Action tiles
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    actionTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionTileDestructive: {
      backgroundColor: colors.debit + '10',
    },
    actionTileLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },

    // Day card
    dayCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dayHeaderDate: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    dayHeaderDay: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      lineHeight: 28,
    },
    dayHeaderTotal: {
      fontSize: fontSize.md,
      fontWeight: '700',
      lineHeight: 20,
    },
    dayHeaderSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },

    // Transaction rows
    txnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    txnIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
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
// Styles — form modal
// ---------------------------------------------------------------------------

const createModalStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      maxHeight: '85%',
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted + '60',
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    // Sheet nav bar — Cancel | Title | Done
    sheetNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    sheetNavCancel: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    sheetNavTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetNavDone: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    // Live preview — pinned
    previewRow: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    // Input
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    inputWrapperFocused: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '08',
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      paddingVertical: spacing.md,
    },
    // Section labels
    sectionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    // Color grid — 6-column, double-ring at 5.5px
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    colorSwatchOuter: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 3,
      borderColor: 'transparent',
      padding: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchInner: {
      width: '100%',
      height: '100%',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Icon sections
    iconSectionTitle: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xs,
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
  });

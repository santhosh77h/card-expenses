import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore } from '../store';
import { computeStatementDiff, TxnDiff } from '../utils/statementDiff';
import { PrimaryButton, Card } from '../components/ui';
import type { RootStackParamList } from '../navigation';
import type { Transaction } from '../store';

type DiffRouteProp = RouteProp<RootStackParamList, 'StatementDiff'>;
type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function StatementDiffScreen() {
  const route = useRoute<DiffRouteProp>();
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { statementId, cardId, newParsed } = route.params;
  const { statements, replaceStatementTransactions, defaultCurrency } = useStore();

  // Get old transactions from the existing statement
  const oldStatement = useMemo(
    () => (statements[cardId] || []).find((s) => s.id === statementId),
    [statements, cardId, statementId],
  );

  const currency = (oldStatement?.currency ?? defaultCurrency) as CurrencyCode;

  const diff: TxnDiff = useMemo(() => {
    if (!oldStatement) return { added: [], modified: [], removed: [], unchanged: [] };
    return computeStatementDiff(oldStatement.transactions, newParsed.transactions);
  }, [oldStatement, newParsed.transactions]);

  // Selection state - added & modified default checked, removed default unchecked
  const [selectedAdded, setSelectedAdded] = useState<Set<string>>(
    () => new Set(diff.added.map((t) => t.id)),
  );
  const [selectedModified, setSelectedModified] = useState<Set<string>>(
    () => new Set(diff.modified.map((m) => m.new.id)),
  );
  const [selectedRemoved, setSelectedRemoved] = useState<Set<string>>(new Set());

  const toggleSet = (
    set: Set<string>,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const totalChanges = selectedAdded.size + selectedModified.size + selectedRemoved.size;
  const noChanges = diff.added.length === 0 && diff.modified.length === 0 && diff.removed.length === 0;

  const handleApply = () => {
    const addedTxns = diff.added.filter((t) => selectedAdded.has(t.id));
    const modifiedTxns = diff.modified.filter((m) => selectedModified.has(m.new.id));
    const removedIds = diff.removed.filter((t) => selectedRemoved.has(t.id)).map((t) => t.id);

    replaceStatementTransactions(cardId, statementId, addedTxns, modifiedTxns, removedIds);
    navigation.replace('Analysis', { statementId, cardId });
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  const renderCheckbox = (checked: boolean) => (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked && <Feather name="check" size={12} color="#fff" />}
    </View>
  );

  const renderAmount = (amount: number, type: 'debit' | 'credit') => {
    const color = type === 'debit' ? colors.debit : colors.credit;
    const prefix = type === 'debit' ? '-' : '+';
    return (
      <Text style={[styles.amount, { color }]}>
        {prefix}{formatCurrency(amount, currency)}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Summary badge */}
        {noChanges ? (
          <Card>
            <View style={styles.summaryRow}>
              <Feather name="check-circle" size={24} color={colors.accent} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={styles.summaryTitle}>No Changes Detected</Text>
                <Text style={styles.summarySubtitle}>
                  The re-parsed statement is identical to the existing one.
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <View style={styles.summaryRow}>
              <Feather name="git-merge" size={24} color={colors.accent} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={styles.summaryTitle}>Changes Found</Text>
                <Text style={styles.summarySubtitle}>
                  {diff.added.length} added, {diff.modified.length} modified, {diff.removed.length} removed
                  {diff.unchanged.length > 0 && `, ${diff.unchanged.length} unchanged`}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Added section */}
        {diff.added.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: colors.accent + '20' }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.accent }]}>
                  +{diff.added.length} Added
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (selectedAdded.size === diff.added.length) {
                    setSelectedAdded(new Set());
                  } else {
                    setSelectedAdded(new Set(diff.added.map((t) => t.id)));
                  }
                }}
              >
                <Text style={styles.selectAllText}>
                  {selectedAdded.size === diff.added.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {diff.added.map((txn) => (
              <TouchableOpacity
                key={txn.id}
                style={styles.txnRow}
                onPress={() => toggleSet(selectedAdded, setSelectedAdded, txn.id)}
                activeOpacity={0.7}
              >
                {renderCheckbox(selectedAdded.has(txn.id))}
                <View style={styles.txnInfo}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
                  <Text style={styles.txnMeta}>{txn.date} · {txn.category}</Text>
                </View>
                {renderAmount(txn.amount, txn.type)}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Modified section */}
        {diff.modified.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.warning }]}>
                  ~{diff.modified.length} Modified
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (selectedModified.size === diff.modified.length) {
                    setSelectedModified(new Set());
                  } else {
                    setSelectedModified(new Set(diff.modified.map((m) => m.new.id)));
                  }
                }}
              >
                <Text style={styles.selectAllText}>
                  {selectedModified.size === diff.modified.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            {diff.modified.map(({ old: oldTxn, new: newTxn }) => (
              <TouchableOpacity
                key={newTxn.id}
                style={styles.txnRow}
                onPress={() => toggleSet(selectedModified, setSelectedModified, newTxn.id)}
                activeOpacity={0.7}
              >
                {renderCheckbox(selectedModified.has(newTxn.id))}
                <View style={styles.txnInfo}>
                  <Text style={styles.txnDesc} numberOfLines={1}>{newTxn.description}</Text>
                  <Text style={styles.txnMeta}>{newTxn.date} · {newTxn.category}</Text>
                  {/* Show what changed */}
                  <View style={styles.diffDetails}>
                    {oldTxn.amount !== newTxn.amount && (
                      <Text style={styles.diffLine}>
                        Amount: {formatCurrency(oldTxn.amount, currency)} → {formatCurrency(newTxn.amount, currency)}
                      </Text>
                    )}
                    {oldTxn.type !== newTxn.type && (
                      <Text style={styles.diffLine}>
                        Type: {oldTxn.type} → {newTxn.type}
                      </Text>
                    )}
                    {oldTxn.category !== newTxn.category && (
                      <Text style={styles.diffLine}>
                        Category: {oldTxn.category} → {newTxn.category}
                      </Text>
                    )}
                  </View>
                </View>
                {renderAmount(newTxn.amount, newTxn.type)}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Removed section */}
        {diff.removed.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: colors.debit + '20' }]}>
                <Text style={[styles.sectionBadgeText, { color: colors.debit }]}>
                  -{diff.removed.length} Removed
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (selectedRemoved.size === diff.removed.length) {
                    setSelectedRemoved(new Set());
                  } else {
                    setSelectedRemoved(new Set(diff.removed.map((t) => t.id)));
                  }
                }}
              >
                <Text style={styles.selectAllText}>
                  {selectedRemoved.size === diff.removed.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.removedNote}>
              These transactions exist in the old statement but not in the new parse. Check to delete them.
            </Text>

            {diff.removed.map((txn) => (
              <TouchableOpacity
                key={txn.id}
                style={styles.txnRow}
                onPress={() => toggleSet(selectedRemoved, setSelectedRemoved, txn.id)}
                activeOpacity={0.7}
              >
                {renderCheckbox(selectedRemoved.has(txn.id))}
                <View style={styles.txnInfo}>
                  <Text style={[styles.txnDesc, { opacity: 0.6 }]} numberOfLines={1}>
                    {txn.description}
                  </Text>
                  <Text style={styles.txnMeta}>{txn.date} · {txn.category}</Text>
                </View>
                {renderAmount(txn.amount, txn.type)}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Unchanged info */}
        {diff.unchanged.length > 0 && (
          <View style={[styles.section, { opacity: 0.5 }]}>
            <Text style={styles.unchangedText}>
              {diff.unchanged.length} transaction{diff.unchanged.length !== 1 ? 's' : ''} unchanged
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {noChanges ? (
          <PrimaryButton title="Done" icon="check" onPress={handleSkip} />
        ) : (
          <View style={styles.bottomButtons}>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
            <View style={{ flex: 2 }}>
              <PrimaryButton
                title={`Apply ${totalChanges} Change${totalChanges !== 1 ? 's' : ''}`}
                icon="check"
                onPress={handleApply}
                disabled={totalChanges === 0}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
      lineHeight: 22,
    },
    summarySubtitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: 2,
      lineHeight: 18,
    },
    section: {
      marginTop: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    sectionBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    sectionBadgeText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      lineHeight: 18,
    },
    selectAllText: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: '500',
      lineHeight: 18,
    },
    txnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: borderRadius.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    checkboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    txnInfo: {
      flex: 1,
      marginRight: spacing.sm,
    },
    txnDesc: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      lineHeight: 20,
    },
    txnMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      lineHeight: 16,
    },
    amount: {
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
    diffDetails: {
      marginTop: spacing.xs,
    },
    diffLine: {
      color: colors.warning,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    removedNote: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginBottom: spacing.sm,
      lineHeight: 16,
    },
    unchangedText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.md,
      lineHeight: 18,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bottomButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    skipBtn: {
      flex: 1,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    skipBtnText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '600',
      lineHeight: 22,
    },
  });

import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { spacing, borderRadius, fontSize } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction } from '../store';
import { Card, PrimaryButton, StatRow } from './ui';
import {
  exportBackup,
  importBackup,
  restoreBackup,
  decryptBackup,
  type BackupData,
  type EncryptedBackup,
} from '../utils/backup';

const MIN_PASSWORD_LENGTH = 6;

export default function BackupView() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cards, statements, manualTransactions, enrichments } = useStore();
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<BackupData | null>(null);

  // Export password states
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirm, setExportConfirm] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);

  // Import decrypt states
  const [pendingEncrypted, setPendingEncrypted] = useState<EncryptedBackup | null>(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [showDecryptPassword, setShowDecryptPassword] = useState(false);
  const [decryptError, setDecryptError] = useState('');

  const statementCount = Object.values(statements).reduce((sum, arr) => sum + arr.length, 0);
  const txnCount = Object.values(statements).reduce(
    (sum, arr) => sum + arr.reduce((s, st) => s + st.transactions.length, 0),
    0,
  );

  const hasData = cards.length > 0 || statementCount > 0 || manualTransactions.length > 0;
  const passwordValid = exportPassword.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = exportPassword === exportConfirm;
  const canExport = hasData && passwordValid && passwordsMatch;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportBackup(exportPassword);
      setExportPassword('');
      setExportConfirm('');
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'An unexpected error occurred.');
    } finally {
      setExporting(false);
    }
  };

  // Collect all transactions for CSV export
  const allTransactions = useMemo(() => {
    const txns: Transaction[] = [...manualTransactions];
    for (const card of cards) {
      const cardStmts = statements[card.id] || [];
      for (const stmt of cardStmts) {
        for (const t of stmt.transactions) {
          txns.push({ ...t, cardId: card.id, currency: t.currency ?? stmt.currency ?? card.currency });
        }
      }
    }
    // Deduplicate by id (imported statement txns already appear in manualTransactions)
    const seen = new Set<string>();
    return txns.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [cards, statements, manualTransactions]);

  const handleExportCsv = async () => {
    if (allTransactions.length === 0) {
      Alert.alert('No Transactions', 'There are no transactions to export.');
      return;
    }
    setExportingCsv(true);
    try {
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const header = 'Date,Description,Amount,Category,Type,Currency,Card';
      const rows = allTransactions.map((t) => {
        const cardName = cards.find((c) => c.id === t.cardId)?.nickname ?? '';
        return [
          t.date,
          escape(t.description),
          t.amount.toFixed(2),
          escape(t.category),
          t.type,
          t.currency ?? '',
          escape(cardName),
        ].join(',');
      });
      const csv = [header, ...rows].join('\n');

      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filePath = `${FileSystem.cacheDirectory}vector-transactions-${ts}.csv`;
      await FileSystem.writeAsStringAsync(filePath, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(filePath, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'An unexpected error occurred.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const encrypted = await importBackup();
      if (!encrypted) {
        setImporting(false);
        return;
      }
      setPendingEncrypted(encrypted);
      setDecryptPassword('');
      setDecryptError('');
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'An unexpected error occurred.');
    } finally {
      setImporting(false);
    }
  };

  const handleDecrypt = () => {
    if (!pendingEncrypted || !decryptPassword) return;
    try {
      const data = decryptBackup(pendingEncrypted, decryptPassword);
      setPreview(data);
      setPendingEncrypted(null);
      setDecryptPassword('');
      setDecryptError('');
    } catch (e: any) {
      setDecryptError(e.message || 'Incorrect password.');
    }
  };

  const handleRestore = () => {
    if (!preview) return;
    Alert.alert(
      'Replace All Data?',
      'This will permanently replace all your current data with the backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            try {
              restoreBackup(preview);
              setPreview(null);
              Alert.alert('Restore Complete', 'Your data has been restored from backup.');
            } catch (e: any) {
              Alert.alert('Restore Failed', e.message || 'Your data has not been changed.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Current data summary */}
      <Card>
        <View style={styles.cardHeader}>
          <Feather name="database" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Current Data</Text>
        </View>
        <StatRow label="Cards" value={String(cards.length)} />
        <StatRow label="Statements" value={String(statementCount)} />
        <StatRow label="Statement transactions" value={String(txnCount)} />
        <StatRow label="Manual transactions" value={String(manualTransactions.length)} />
        <StatRow label="Enrichments" value={String(Object.keys(enrichments).length)} />
      </Card>

      {/* Export */}
      <Card>
        <View style={styles.cardHeader}>
          <Feather name="upload" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Export Backup</Text>
        </View>
        <Text style={styles.desc}>
          Your backup is encrypted with a password to protect your financial data. Remember this password — you'll need it to restore.
        </Text>

        {/* Password */}
        <PasswordField
          icon="lock"
          placeholder="Set backup password"
          value={exportPassword}
          onChangeText={(t) => { setExportPassword(t); }}
          visible={showExportPassword}
          onToggle={() => setShowExportPassword(!showExportPassword)}
        />
        {exportPassword.length > 0 && !passwordValid && (
          <Text style={styles.passwordHint}>At least {MIN_PASSWORD_LENGTH} characters required</Text>
        )}

        {/* Confirm password */}
        {passwordValid && (
          <PasswordField
            icon="check-circle"
            placeholder="Confirm password"
            value={exportConfirm}
            onChangeText={setExportConfirm}
            visible={showExportPassword}
            onToggle={() => setShowExportPassword(!showExportPassword)}
          />
        )}
        {passwordValid && exportConfirm.length > 0 && !passwordsMatch && (
          <Text style={styles.errorText}>Passwords do not match</Text>
        )}

        <View style={{ height: spacing.sm }} />
        <PrimaryButton
          title="Export Encrypted Backup"
          icon="lock"
          onPress={handleExport}
          loading={exporting}
          disabled={!canExport}
        />
      </Card>

      {/* Export CSV */}
      <Card>
        <View style={styles.cardHeader}>
          <Feather name="file-text" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Export to CSV</Text>
        </View>
        <Text style={styles.desc}>
          Export all your transactions as a plain CSV file. No encryption — great for spreadsheets and personal analysis.
        </Text>
        <StatRow label="Total transactions" value={String(allTransactions.length)} />
        <View style={{ height: spacing.sm }} />
        <PrimaryButton
          title="Export CSV"
          icon="download"
          onPress={handleExportCsv}
          loading={exportingCsv}
          disabled={allTransactions.length === 0}
          variant="outline"
        />
      </Card>

      {/* Import */}
      <Card>
        <View style={styles.cardHeader}>
          <Feather name="download" size={18} color={colors.accent} />
          <Text style={styles.cardTitle}>Import Backup</Text>
        </View>
        <Text style={styles.desc}>
          Restore from a previously exported backup file. You'll need the password used during export.
        </Text>
        {importing ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
        ) : (
          <PrimaryButton title="Select Backup File" icon="file-text" onPress={handleImport} variant="outline" />
        )}
      </Card>

      {/* Decrypt prompt */}
      {pendingEncrypted && (
        <Card style={styles.decryptCard}>
          <View style={styles.cardHeader}>
            <Feather name="lock" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Unlock Backup</Text>
          </View>
          <Text style={styles.previewDate}>
            Exported: {new Date(pendingEncrypted.exportedAt).toLocaleDateString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          <View style={styles.previewDivider} />
          <StatRow label="Cards" value={String(pendingEncrypted.summary.cardCount)} />
          <StatRow label="Statements" value={String(pendingEncrypted.summary.statementCount)} />
          <StatRow label="Transactions" value={String(pendingEncrypted.summary.transactionCount)} />
          <View style={styles.previewDivider} />

          <PasswordField
            icon="key"
            placeholder="Enter backup password"
            value={decryptPassword}
            onChangeText={(t) => { setDecryptPassword(t); setDecryptError(''); }}
            visible={showDecryptPassword}
            onToggle={() => setShowDecryptPassword(!showDecryptPassword)}
            autoFocus
          />
          {decryptError ? <Text style={styles.errorText}>{decryptError}</Text> : null}
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Unlock" icon="unlock" onPress={handleDecrypt} disabled={!decryptPassword} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton
            title="Cancel"
            icon="x"
            onPress={() => { setPendingEncrypted(null); setDecryptPassword(''); setDecryptError(''); }}
            variant="outline"
          />
        </Card>
      )}

      {/* Preview card */}
      {preview && (
        <Card style={styles.previewCard}>
          <View style={styles.cardHeader}>
            <Feather name="package" size={18} color={colors.warning} />
            <Text style={[styles.cardTitle, { color: colors.warning }]}>Backup Preview</Text>
          </View>
          <Text style={styles.previewDate}>
            Exported: {new Date(preview.exportedAt).toLocaleDateString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
          <View style={styles.previewDivider} />
          <StatRow label="Cards" value={String(preview.summary.cardCount)} />
          <StatRow label="Statements" value={String(preview.summary.statementCount)} />
          <StatRow label="Statement transactions" value={String(preview.summary.transactionCount)} />
          <StatRow label="Manual transactions" value={String(preview.summary.manualTransactionCount)} />
          <StatRow label="Enrichments" value={String(preview.summary.enrichmentCount)} />
          <View style={{ height: spacing.md }} />
          <PrimaryButton title="Restore This Backup" icon="refresh-cw" onPress={handleRestore} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Cancel" icon="x" onPress={() => setPreview(null)} variant="outline" />
        </Card>
      )}

      {/* Privacy note */}
      <View style={styles.privacyNote}>
        <Feather name="shield" size={14} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <Text style={styles.privacyText}>
          All backups are AES-encrypted. Data stays on your device and is never uploaded.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reusable password input row
// ---------------------------------------------------------------------------

function PasswordField({
  icon,
  placeholder,
  value,
  onChangeText,
  visible,
  onToggle,
  autoFocus,
}: {
  icon: keyof typeof Feather.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.passwordRow}>
      <View style={styles.passwordInputWrap}>
        <Feather name={icon} size={14} color={colors.textMuted} style={styles.passwordIcon} />
        <TextInput
          style={styles.passwordInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
        />
        <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    lineHeight: 22,
  },
  desc: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  passwordRow: {
    marginBottom: spacing.md,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  passwordIcon: {
    marginRight: spacing.sm,
  },
  passwordInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    height: 44,
  },
  passwordHint: {
    color: colors.warning,
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
    lineHeight: 16,
  },
  errorText: {
    color: colors.debit,
    fontSize: fontSize.sm,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  decryptCard: {
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  previewCard: {
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  previewDate: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  previewDivider: {
    height: 1,
    backgroundColor: colors.surfaceElevated,
    marginVertical: spacing.md,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  privacyText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    flex: 1,
    lineHeight: 16,
  },
});

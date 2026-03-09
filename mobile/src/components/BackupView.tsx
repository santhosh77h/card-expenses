import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { useStore } from '../store';
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
  const { cards, statements, manualTransactions, enrichments } = useStore();
  const [exporting, setExporting] = useState(false);
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

const styles = StyleSheet.create({
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

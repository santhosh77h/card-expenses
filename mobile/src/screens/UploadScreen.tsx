import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { colors, spacing, borderRadius, fontSize, CurrencyCode } from '../theme';
import { useStore, StatementData, CreditCard } from '../store';
import { parseStatement, parseDemoStatement, CardInfo } from '../utils/api';
import { findByHash, insertFileHash } from '../db/fileHashes';
import { isStatementImported } from '../db/transactions';
import { ENTITLEMENT_ID } from '../utils/revenueCat';
import { Badge, Card, PrimaryButton } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import type { RootStackParamList } from '../navigation';

const FREE_TIER_UPLOAD_LIMIT = 3;

const BANK_TO_ISSUER: Record<string, string> = {
  hdfc: 'HDFC Bank', icici: 'ICICI Bank', sbi: 'SBI Card',
  axis: 'Axis Bank', chase: 'Chase', amex: 'American Express',
  citi: 'Citi', generic: 'Other', demo: 'Other',
};
const CARD_COLORS = ['#1E3A5F','#2D1B69','#1B4332','#4A1942','#1C1C1C','#0F3460','#3C1518','#1A535C'];

function pickUnusedColor(existingCards: CreditCard[]): string {
  const used = new Set(existingCards.map((c) => c.color));
  return CARD_COLORS.find((c) => !used.has(c)) || CARD_COLORS[0];
}

function normalizeNetwork(network: string | null): string {
  if (!network) return 'Visa';
  const lower = network.toLowerCase();
  if (lower.includes('master')) return 'Mastercard';
  if (lower.includes('amex') || lower.includes('american')) return 'American Express';
  if (lower.includes('rupay')) return 'RuPay';
  return 'Visa';
}

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error';

export default function UploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { cards, activeCardId, addStatement, addCard, updateCard, addMonthlyUsage, isPremium, uploadsThisMonth, _refreshUploadCount } = useStore();
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>(
    activeCardId || cards[0]?.id || ''
  );
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string } | null>(null);
  const [resolvedCard, setResolvedCard] = useState<CreditCard | null>(null);
  const [resolvedAutoCreated, setResolvedAutoCreated] = useState(false);
  const [lastNavParams, setLastNavParams] = useState<{ statementId: string; cardId: string } | null>(null);

  const computeFileHash = async (fileUri: string): Promise<string> => {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64,
    );
  };

  const checkDuplicate = (hash: string): boolean => {
    if (__DEV__) return false;

    const existing = findByHash(hash);
    if (!existing) return false;

    const cardName =
      cards.find((c) => c.id === existing.cardId)?.nickname ?? 'a card';
    const imported = isStatementImported(existing.statementId);

    let message = `This statement has already been uploaded for ${cardName}.`;
    if (imported) {
      message += '\nTransactions have also been added to your records.';
    }

    Alert.alert('Statement Already Uploaded', message, [
      { text: 'OK', onPress: () => setState('idle') },
    ]);
    return true;
  };

  const checkUploadAllowed = async (): Promise<boolean> => {
    if (__DEV__ || isPremium) return true;
    _refreshUploadCount();
    const current = useStore.getState().uploadsThisMonth;
    if (current < FREE_TIER_UPLOAD_LIMIT) return true;
    // Show paywall
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
    });
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  };

  const handlePick = async () => {
    try {
      const allowed = await checkUploadAllowed();
      if (!allowed) return;

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setState('uploading');
      setError('');

      try {
        const fileHash = await computeFileHash(file.uri);
        if (checkDuplicate(fileHash)) return;

        setState('parsing');
        const parsed = await parseStatement(file.uri, file.name);
        saveAndNavigate(parsed, fileHash);
      } catch (err: any) {
        const errorCode = err?.response?.data?.detail?.error_code;
        if (errorCode === 'password_required' || errorCode === 'incorrect_password') {
          setPendingFile({ uri: file.uri, name: file.name });
          setPasswordError(errorCode === 'incorrect_password' ? 'Incorrect password. Please try again.' : '');
          setPassword('');
          setPasswordModalVisible(true);
          setState('idle');
          return;
        }
        const detail = err?.response?.data?.detail;
        const msg =
          (typeof detail === 'string' ? detail : detail?.message) ||
          err?.message ||
          'Failed to parse statement.';
        setState('error');
        setError(msg);
      }
    } catch {
      setState('error');
      setError('Could not open file picker.');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!pendingFile || !password.trim()) return;
    setPasswordModalVisible(false);
    setState('parsing');
    setError('');
    try {
      const fileHash = await computeFileHash(pendingFile.uri);
      if (checkDuplicate(fileHash)) {
        setPendingFile(null);
        setPassword('');
        setPasswordError('');
        return;
      }

      const parsed = await parseStatement(pendingFile.uri, pendingFile.name, password);
      setPendingFile(null);
      setPassword('');
      setPasswordError('');
      saveAndNavigate(parsed, fileHash);
    } catch (err: any) {
      const errorCode = err?.response?.data?.detail?.error_code;
      if (errorCode === 'incorrect_password') {
        setPasswordError('Incorrect password. Please try again.');
        setPassword('');
        setPasswordModalVisible(true);
        setState('idle');
      } else {
        setPendingFile(null);
        setPassword('');
        setPasswordError('');
        const detail = err?.response?.data?.detail;
        const msg =
          (typeof detail === 'string' ? detail : detail?.message) ||
          err?.message ||
          'Failed to parse statement.';
        setState('error');
        setError(msg);
      }
    }
  };

  const handlePasswordCancel = () => {
    setPasswordModalVisible(false);
    setPendingFile(null);
    setPassword('');
    setPasswordError('');
  };

  const handleDemo = async () => {
    setState('parsing');
    setError('');

    const demoHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'vector-demo-statement-v1',
    );
    if (checkDuplicate(demoHash)) return;

    // Small delay to show parsing state
    setTimeout(() => {
      try {
        const parsed = parseDemoStatement();
        saveAndNavigate(parsed, demoHash);
      } catch {
        setState('error');
        setError('Demo failed unexpectedly.');
      }
    }, 800);
  };

  const saveAndNavigate = (parsed: any, fileHash?: string) => {
    const cardInfo: CardInfo | null = parsed.card_info ?? null;
    const bankDetected: string = parsed.bank_detected || 'generic';
    const issuerName = BANK_TO_ISSUER[bankDetected] || 'Other';
    const detectedCurrency = (cardInfo?.currency || parsed.currency_detected || 'INR') as CurrencyCode;

    // --- Resolve card ---
    let cardId: string;
    let wasAutoCreated = false;
    let matched: CreditCard | undefined;

    if (cardInfo?.card_last4) {
      // Try to find existing card by last4 + issuer
      const existing = cards.find(
        (c) =>
          c.last4 === cardInfo.card_last4 &&
          c.issuer.toLowerCase() === issuerName.toLowerCase()
      );

      if (existing) {
        cardId = existing.id;
        matched = existing;
        // Update metadata from latest statement
        const updates: Partial<CreditCard> = {};
        if (cardInfo.credit_limit != null) updates.creditLimit = cardInfo.credit_limit;
        if (cardInfo.total_amount_due != null) updates.totalAmountDue = cardInfo.total_amount_due;
        if (cardInfo.minimum_amount_due != null) updates.minimumAmountDue = cardInfo.minimum_amount_due;
        if (cardInfo.payment_due_date) updates.paymentDueDate = cardInfo.payment_due_date;
        if (Object.keys(updates).length > 0) updateCard(cardId, updates);
      } else {
        // Auto-create new card
        cardId = `auto-${Date.now()}`;
        wasAutoCreated = true;
        const network = normalizeNetwork(cardInfo.card_network);
        const newCard: CreditCard = {
          id: cardId,
          nickname: `${issuerName} •${cardInfo.card_last4}`,
          last4: cardInfo.card_last4,
          issuer: issuerName,
          network,
          creditLimit: cardInfo.credit_limit ?? 0,
          billingCycle: '1',
          color: pickUnusedColor(cards),
          totalAmountDue: cardInfo.total_amount_due ?? undefined,
          minimumAmountDue: cardInfo.minimum_amount_due ?? undefined,
          paymentDueDate: cardInfo.payment_due_date ?? undefined,
          autoCreated: true,
          currency: detectedCurrency,
        };
        addCard(newCard);
        matched = newCard;
      }
    } else {
      // Fallback to manual selection
      cardId = selectedCardId || 'demo';
      matched = cards.find((c) => c.id === cardId);
    }

    const statementId = Date.now().toString();
    const statement: StatementData = {
      id: statementId,
      cardId,
      parsedAt: new Date().toISOString(),
      transactions: parsed.transactions,
      summary: parsed.summary,
      csv: parsed.csv,
      bankDetected: bankDetected,
      currency: detectedCurrency,
    };

    addStatement(cardId, statement);

    if (fileHash) {
      insertFileHash(fileHash, statementId, cardId);
    }

    // --- Track monthly usage ---
    const periodTo = parsed.summary?.statement_period?.to;
    if (periodTo) {
      const month = periodTo.substring(0, 7); // "YYYY-MM"
      const totalDebits = parsed.transactions
        .filter((t: any) => t.type === 'debit')
        .reduce((s: number, t: any) => s + t.amount, 0);
      const totalCredits = parsed.transactions
        .filter((t: any) => t.type === 'credit')
        .reduce((s: number, t: any) => s + t.amount, 0);
      addMonthlyUsage({
        cardId,
        month,
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        net: Math.round((totalDebits - totalCredits) * 100) / 100,
        statementId,
      });
    }

    setResolvedCard(matched ?? null);
    setResolvedAutoCreated(wasAutoCreated);
    setLastNavParams({ statementId: statement.id, cardId });
    setState('done');
  };

  return (
    <>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Statement</Text>
        <Text style={styles.subtitle}>Parse your credit card PDF statement</Text>
      </View>

      {/* Privacy badge */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
        <Badge text="Your PDF is processed in memory and never stored" color={colors.accent} />
      </View>

      {/* Free tier usage indicator */}
      {!__DEV__ && !isPremium && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Card>
            <View style={styles.usageRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.usageTitle}>
                  {Math.max(0, FREE_TIER_UPLOAD_LIMIT - uploadsThisMonth)} of {FREE_TIER_UPLOAD_LIMIT} uploads remaining
                </Text>
                <Text style={styles.usageSubtitle}>Resets monthly</Text>
              </View>
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={async () => {
                  try {
                    await RevenueCatUI.presentPaywallIfNeeded({
                      requiredEntitlementIdentifier: ENTITLEMENT_ID,
                    });
                  } catch {}
                }}
              >
                <Feather name="zap" size={14} color="#fff" />
                <Text style={styles.upgradeBtnText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.usageBarBg}>
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${Math.min(100, (uploadsThisMonth / FREE_TIER_UPLOAD_LIMIT) * 100)}%`,
                    backgroundColor: uploadsThisMonth >= FREE_TIER_UPLOAD_LIMIT ? colors.debit : colors.accent,
                  },
                ]}
              />
            </View>
          </Card>
        </View>
      )}

      {/* Card selector */}
      {cards.length > 1 && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text style={styles.label}>Select Card</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.sm }}
          >
            {cards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.cardChip,
                  selectedCardId === card.id && styles.cardChipActive,
                ]}
                onPress={() => setSelectedCardId(card.id)}
              >
                <Text
                  style={[
                    styles.cardChipText,
                    selectedCardId === card.id && styles.cardChipTextActive,
                  ]}
                >
                  {card.nickname} (*{card.last4})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Upload area */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <TouchableOpacity
          style={[
            styles.uploadArea,
            state === 'error' && { borderColor: colors.debit },
            (state === 'uploading' || state === 'parsing') && { borderColor: colors.accent },
          ]}
          onPress={state === 'idle' || state === 'error' ? handlePick : undefined}
          activeOpacity={0.8}
          disabled={state === 'uploading' || state === 'parsing'}
        >
          {state === 'idle' && (
            <>
              <Feather name="upload-cloud" size={48} color={colors.textMuted} />
              <Text style={styles.uploadTitle}>Tap to Upload PDF</Text>
              <Text style={styles.uploadSubtitle}>
                Select your credit card statement (max 10 MB)
              </Text>
            </>
          )}
          {(state === 'uploading' || state === 'parsing') && (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.uploadTitle, { color: colors.accent }]}>
                {state === 'uploading' ? 'Uploading...' : 'Parsing Statement...'}
              </Text>
              <Text style={styles.uploadSubtitle}>
                Your data is being processed securely
              </Text>
            </>
          )}
          {state === 'done' && (
            <>
              <Feather name="check-circle" size={48} color={colors.accent} />
              <Text style={[styles.uploadTitle, { color: colors.accent }]}>
                Done!
              </Text>
              <Text style={styles.uploadSubtitle}>
                Tap below to continue
              </Text>
            </>
          )}
          {state === 'error' && (
            <>
              <Feather name="alert-circle" size={48} color={colors.debit} />
              <Text style={[styles.uploadTitle, { color: colors.debit }]}>
                Upload Failed
              </Text>
              <Text style={styles.uploadSubtitle}>{error}</Text>
              <Text style={[styles.uploadSubtitle, { color: colors.accent, marginTop: spacing.sm }]}>
                Tap to try again
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Resolved card + actions after successful parse */}
      {state === 'done' && resolvedCard && lastNavParams && (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Card>
            <View style={styles.detectedHeader}>
              <Feather
                name={resolvedAutoCreated ? 'plus-circle' : 'check-circle'}
                size={16}
                color={colors.accent}
              />
              <Text style={styles.detectedLabel}>
                {resolvedAutoCreated ? 'Card Auto-Created' : 'Card Detected'}
              </Text>
            </View>
            <View style={{ alignItems: 'center', marginTop: spacing.md }}>
              <CreditCardView card={resolvedCard} compact />
            </View>
            <View style={styles.doneButtons}>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  setResolvedCard(null);
                  setLastNavParams(null);
                  setState('idle');
                  navigation.navigate('Analysis', lastNavParams);
                }}
              >
                <Feather name="bar-chart-2" size={16} color={colors.accent} />
                <Text style={styles.doneBtnText}>View Analysis</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  setResolvedCard(null);
                  setLastNavParams(null);
                  setState('idle');
                  (navigation as any).navigate('Cards');
                }}
              >
                <Feather name="credit-card" size={16} color={colors.accent} />
                <Text style={styles.doneBtnText}>View Card</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      )}

      {/* Demo button */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <PrimaryButton
          title="Try Demo"
          icon="play"
          variant="outline"
          onPress={handleDemo}
          disabled={state === 'uploading' || state === 'parsing' || state === 'done'}
        />
      </View>

      {/* Privacy info */}
      <View style={{ padding: spacing.lg, marginTop: spacing.lg }}>
        <Card>
          <View style={styles.privacyRow}>
            <Feather name="shield" size={20} color={colors.accent} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.privacyTitle}>Privacy First</Text>
              <Text style={styles.privacyText}>
                Your PDF is parsed in-memory on our server and immediately discarded.
                No financial data is ever stored, logged, or shared.
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>

    <Modal
      visible={passwordModalVisible}
      transparent
      animationType="fade"
      onRequestClose={handlePasswordCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Feather name="lock" size={36} color={colors.accent} style={{ alignSelf: 'center' }} />
          <Text style={styles.modalTitle}>Password Required</Text>
          <Text style={styles.modalSubtitle}>
            This PDF is password-protected. Common passwords are your date of birth, PAN number, or card last 4 digits.
          </Text>
          {!!passwordError && (
            <Text style={styles.modalError}>{passwordError}</Text>
          )}
          <TextInput
            style={styles.modalInput}
            placeholder="Enter PDF password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoFocus
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handlePasswordSubmit}
            returnKeyType="done"
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={handlePasswordCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalUnlockBtn, !password.trim() && { opacity: 0.5 }]}
              onPress={handlePasswordSubmit}
              disabled={!password.trim()}
            >
              <Feather name="unlock" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.modalUnlockText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xxxl,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cardChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.sm,
  },
  cardChipActive: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
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
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  uploadTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  uploadSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  detectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detectedLabel: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doneButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  doneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  doneBtnText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  privacyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  privacyText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usageTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  usageSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  usageBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.md,
    overflow: 'hidden' as const,
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  modalError: {
    color: colors.debit,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  modalUnlockBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalUnlockText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});

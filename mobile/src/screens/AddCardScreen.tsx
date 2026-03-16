import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius, fontSize, SUPPORTED_CURRENCIES, CURRENCY_CONFIG, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, CreditCard } from '../store';
import { Card, PrimaryButton } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import { scanCardImage } from '../utils/api';
import { ISSUERS, NETWORKS, ISSUER_CURRENCY, CARD_COLORS } from '../constants/cards';

function matchIssuer(scanned: string | null): string {
  if (!scanned) return ISSUERS[ISSUERS.length - 1]; // "Other"
  const lower = scanned.toLowerCase();
  for (const iss of ISSUERS) {
    if (lower.includes(iss.toLowerCase().split(' ')[0])) return iss;
  }
  // Common aliases
  if (lower.includes('hdfc')) return 'HDFC Bank';
  if (lower.includes('icici')) return 'ICICI Bank';
  if (lower.includes('sbi')) return 'SBI Card';
  if (lower.includes('axis')) return 'Axis Bank';
  if (lower.includes('chase')) return 'Chase';
  if (lower.includes('amex') || lower.includes('american express')) return 'American Express';
  if (lower.includes('citi')) return 'Citi';
  return ISSUERS[ISSUERS.length - 1];
}

function matchNetwork(scanned: string | null): string {
  if (!scanned) return NETWORKS[0];
  const lower = scanned.toLowerCase();
  if (lower.includes('master')) return 'Mastercard';
  if (lower.includes('amex') || lower.includes('american')) return 'American Express';
  if (lower.includes('rupay')) return 'RuPay';
  return 'Visa';
}

export default function AddCardScreen() {
  const navigation = useNavigation();
  const { addCard } = useStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [nickname, setNickname] = useState('');
  const [last4, setLast4] = useState('');
  const [issuer, setIssuer] = useState(ISSUERS[0]);
  const [network, setNetwork] = useState(NETWORKS[0]);
  const [creditLimit, setCreditLimit] = useState('');
  const [billingCycle, setBillingCycle] = useState('');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [showIssuerPicker, setShowIssuerPicker] = useState(false);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [scanning, setScanning] = useState(false);

  const previewCard: CreditCard = {
    id: 'preview',
    nickname: nickname || 'My Card',
    last4: last4 || '0000',
    issuer,
    network,
    creditLimit: parseFloat(creditLimit) || 100000,
    billingCycle: billingCycle || '1st of month',
    color: cardColor,
    currency,
  };

  const handleScanCard = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Camera access is required to scan your card.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const imageUri = result.assets[0].uri;
    setScanning(true);

    try {
      const scanned = await scanCardImage(imageUri);

      // Pre-fill form fields from scanned data
      if (scanned.last4) setLast4(scanned.last4);

      const detectedIssuer = matchIssuer(scanned.issuer);
      setIssuer(detectedIssuer);
      setCurrency(ISSUER_CURRENCY[detectedIssuer] || 'INR');

      setNetwork(matchNetwork(scanned.network));

      if (scanned.cardholder_name) {
        // Use cardholder name as nickname suggestion if nickname is empty
        if (!nickname) setNickname(scanned.cardholder_name);
      }

      Alert.alert(
        'Card Scanned',
        `Detected: ${scanned.last4 ? `····${scanned.last4}` : 'No number found'} · ${scanned.issuer || 'Unknown issuer'} · ${scanned.network || 'Unknown network'}\n\nReview and fill in the remaining fields.`,
      );
    } catch (e: any) {
      Alert.alert('Scan Failed', e?.response?.data?.detail || e?.message || 'Could not read card details. Try again or enter manually.');
    } finally {
      setScanning(false);
    }

    // Image is never saved — expo-image-picker's temp file will be cleaned up by OS
  };

  const handleSave = () => {
    if (!nickname.trim()) {
      Alert.alert('Validation', 'Please enter a card nickname.');
      return;
    }
    if (last4.length !== 4 || !/^\d{4}$/.test(last4)) {
      Alert.alert('Validation', 'Please enter 4 digits for the card number.');
      return;
    }
    if (!creditLimit || isNaN(parseFloat(creditLimit))) {
      Alert.alert('Validation', 'Please enter a valid credit limit.');
      return;
    }

    const card: CreditCard = {
      id: Date.now().toString(),
      nickname: nickname.trim(),
      last4,
      issuer,
      network,
      creditLimit: parseFloat(creditLimit),
      billingCycle: billingCycle || 'Not set',
      color: cardColor,
      currency,
    };

    addCard(card);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Scan Card button */}
      <TouchableOpacity
        style={styles.scanBtn}
        onPress={handleScanCard}
        disabled={scanning}
        activeOpacity={0.7}
      >
        {scanning ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Feather name="camera" size={20} color={colors.accent} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.scanBtnTitle}>
            {scanning ? 'Reading card...' : 'Scan Card with Camera'}
          </Text>
          <Text style={styles.scanBtnSubtitle}>
            Auto-fill card details from a photo
          </Text>
        </View>
        {!scanning && <Feather name="chevron-right" size={18} color={colors.textMuted} />}
      </TouchableOpacity>

      {/* Live card preview */}
      <View style={styles.previewContainer}>
        <CreditCardView card={previewCard} />
      </View>

      {/* Form */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Card>
          <InputField label="Card Nickname" value={nickname} onChangeText={setNickname} placeholder="e.g. HDFC Regalia" />
          <InputField label="Last 4 Digits" value={last4} onChangeText={(t) => setLast4(t.replace(/\D/g, '').slice(0, 4))} placeholder="1234" keyboardType="number-pad" maxLength={4} />

          {/* Issuer picker */}
          <Text style={styles.inputLabel}>Issuer</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowIssuerPicker(!showIssuerPicker)}>
            <Text style={styles.pickerText}>{issuer}</Text>
            <Feather name={showIssuerPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {showIssuerPicker && (
            <View style={styles.pickerList}>
              {ISSUERS.map((i) => (
                <TouchableOpacity key={i} style={[styles.pickerItem, issuer === i && styles.pickerItemActive]} onPress={() => { setIssuer(i); setCurrency(ISSUER_CURRENCY[i] || 'INR'); setShowIssuerPicker(false); }}>
                  <Text style={[styles.pickerItemText, issuer === i && { color: colors.accent }]}>{i}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Network picker */}
          <Text style={styles.inputLabel}>Network</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowNetworkPicker(!showNetworkPicker)}>
            <Text style={styles.pickerText}>{network}</Text>
            <Feather name={showNetworkPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {showNetworkPicker && (
            <View style={styles.pickerList}>
              {NETWORKS.map((n) => (
                <TouchableOpacity key={n} style={[styles.pickerItem, network === n && styles.pickerItemActive]} onPress={() => { setNetwork(n); setShowNetworkPicker(false); }}>
                  <Text style={[styles.pickerItemText, network === n && { color: colors.accent }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Currency picker */}
          <Text style={styles.inputLabel}>Currency</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}>
            <Text style={styles.pickerText}>{CURRENCY_CONFIG[currency].symbol} {currency} — {CURRENCY_CONFIG[currency].label}</Text>
            <Feather name={showCurrencyPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {showCurrencyPicker && (
            <View style={styles.pickerList}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.pickerItem, currency === c && styles.pickerItemActive]} onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}>
                  <Text style={[styles.pickerItemText, currency === c && { color: colors.accent }]}>
                    {CURRENCY_CONFIG[c].symbol} {c} — {CURRENCY_CONFIG[c].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <InputField label="Credit Limit" value={creditLimit} onChangeText={setCreditLimit} placeholder="e.g. 200000" keyboardType="number-pad" />
          <InputField label="Billing Cycle" value={billingCycle} onChangeText={setBillingCycle} placeholder="e.g. 1st of every month" />

          {/* Color picker */}
          <Text style={styles.inputLabel}>Card Color</Text>
          <View style={styles.colorRow}>
            {CARD_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  cardColor === c && styles.colorSwatchActive,
                ]}
                onPress={() => setCardColor(c)}
              >
                {cardColor === c && (
                  <Feather name="check" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton title="Save Card" icon="plus" onPress={handleSave} />
          </View>
        </Card>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Input field sub-component
// ---------------------------------------------------------------------------

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </>
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
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '10',
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  scanBtnTitle: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  scanBtnSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  previewContainer: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  pickerText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  pickerList: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemActive: {
    backgroundColor: colors.accent + '10',
  },
  pickerItemText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
});

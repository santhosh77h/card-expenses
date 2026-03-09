import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius, fontSize, CurrencyCode, CURRENCY_CONFIG, SUPPORTED_CURRENCIES } from '../theme';
import { useStore } from '../store';
import { Card, PrimaryButton } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import { ISSUERS, NETWORKS, ISSUER_CURRENCY, CARD_COLORS } from '../constants/cards';
import type { RootStackParamList } from '../navigation';

type RouteParams = RouteProp<RootStackParamList, 'EditCard'>;

export default function EditCardScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { cards, updateCard, removeCard } = useStore();

  const card = cards.find((c) => c.id === route.params.cardId);
  if (!card) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Card not found</Text>
      </View>
    );
  }

  return <EditForm card={card} updateCard={updateCard} removeCard={removeCard} goBack={() => navigation.goBack()} />;
}

// Separate component so hooks are always called
function EditForm({
  card,
  updateCard,
  removeCard,
  goBack,
}: {
  card: { id: string; nickname: string; last4: string; issuer: string; network: string; creditLimit: number; billingCycle: string; color: string; currency?: CurrencyCode };
  updateCard: (id: string, updates: Record<string, any>) => void;
  removeCard: (id: string) => void;
  goBack: () => void;
}) {
  const [nickname, setNickname] = useState(card.nickname);
  const [last4, setLast4] = useState(card.last4);
  const [issuer, setIssuer] = useState(card.issuer);
  const [network, setNetwork] = useState(card.network);
  const [creditLimit, setCreditLimit] = useState(String(card.creditLimit));
  const [billingCycle, setBillingCycle] = useState(card.billingCycle);
  const [cardColor, setCardColor] = useState(card.color);
  const [currency, setCurrency] = useState<CurrencyCode>(card.currency || 'INR');
  const [showIssuerPicker, setShowIssuerPicker] = useState(false);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const previewCard = {
    id: card.id,
    nickname: nickname || 'My Card',
    last4: last4 || '0000',
    issuer,
    network,
    creditLimit: parseFloat(creditLimit) || 0,
    billingCycle: billingCycle || 'Not set',
    color: cardColor,
    currency,
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

    updateCard(card.id, {
      nickname: nickname.trim(),
      last4,
      issuer,
      network,
      creditLimit: parseFloat(creditLimit),
      billingCycle: billingCycle || 'Not set',
      color: cardColor,
      currency,
    });

    goBack();
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove Card',
      `Remove "${card.nickname}"? This will delete all associated statements and data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeCard(card.id);
            goBack();
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Live card preview */}
      <View style={styles.previewContainer}>
        <CreditCardView card={previewCard} />
      </View>

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
                style={[styles.colorSwatch, { backgroundColor: c }, cardColor === c && styles.colorSwatchActive]}
                onPress={() => setCardColor(c)}
              >
                {cardColor === c && <Feather name="check" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton title="Save Changes" icon="check" onPress={handleSave} />
          </View>
        </Card>

        {/* Delete button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Feather name="trash-2" size={16} color={colors.debit} />
          <Text style={styles.deleteBtnText}>Remove Card</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Input field
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  notFound: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
  previewContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  pickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerItemActive: {
    backgroundColor: colors.accent + '15',
  },
  pickerItemText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  colorRow: {
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
    borderWidth: 2,
    borderColor: colors.accent,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  deleteBtnText: {
    color: colors.debit,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

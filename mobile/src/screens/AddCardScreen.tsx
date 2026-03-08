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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, SUPPORTED_CURRENCIES, CURRENCY_CONFIG, CurrencyCode } from '../theme';
import { useStore, CreditCard } from '../store';
import { Card, PrimaryButton, SectionHeader } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import { ISSUERS, NETWORKS, ISSUER_CURRENCY, CARD_COLORS } from '../constants/cards';

export default function AddCardScreen() {
  const insets = useSafeAreaInsets();
  const { cards, addCard, removeCard } = useStore();

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
    // Reset form
    setNickname('');
    setLast4('');
    setCreditLimit('');
    setBillingCycle('');
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Remove Card',
      `Are you sure you want to remove "${name}"? This will also delete associated statement history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeCard(id),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Cards</Text>
        <Text style={styles.subtitle}>Manage your credit cards</Text>
      </View>

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

      {/* Existing cards list */}
      {cards.length > 0 && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Your Cards" />
          {cards.map((card) => (
            <View key={card.id} style={styles.existingCard}>
              <View style={[styles.cardColorBar, { backgroundColor: card.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.existingCardName}>{card.nickname}</Text>
                <Text style={styles.existingCardMeta}>
                  {card.issuer} / {card.network} / ****{card.last4} / {card.currency ?? 'INR'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(card.id, card.nickname)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="trash-2" size={18} color={colors.debit} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

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
  header: {
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
  existingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardColorBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  existingCardName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  existingCardMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});

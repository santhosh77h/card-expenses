import React, { useState, useMemo } from 'react';
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, borderRadius, fontSize, CurrencyCode, CURRENCY_CONFIG, SUPPORTED_CURRENCIES, formatCurrency, formatDate, dateFormatForCurrency } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, StatementData } from '../store';
import { Card, PrimaryButton, EmptyState } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import ReminderDayPicker from '../components/ReminderDayPicker';
import { ISSUERS, NETWORKS, ISSUER_CURRENCY, CARD_COLORS } from '../constants/cards';
import { requestPermissions, scheduleCardReminder, cancelCardReminder } from '../utils/notifications';
import type { RootStackParamList } from '../navigation';

type RouteParams = RouteProp<RootStackParamList, 'EditCard'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'details' | 'statements';

export default function EditCardScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const { cards, statements, updateCard, removeCard } = useStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  const card = cards.find((c) => c.id === route.params.cardId);
  if (!card) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Card not found</Text>
      </View>
    );
  }

  const cardStatements = useMemo(() => {
    const stmts = statements[card.id] || [];
    return [...stmts].sort(
      (a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime(),
    );
  }, [statements, card.id]);

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['details', 'statements'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Feather
              name={tab === 'details' ? 'edit-2' : 'file-text'}
              size={14}
              color={activeTab === tab ? colors.accent : colors.textMuted}
              style={{ marginRight: spacing.xs }}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'details' ? 'Details' : `Statements (${cardStatements.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'details' ? (
        <EditForm
          card={card}
          updateCard={updateCard}
          removeCard={removeCard}
          goBack={() => navigation.goBack()}
        />
      ) : (
        <StatementsTab
          cardStatements={cardStatements}
          cardId={card.id}
          currency={(card.currency || 'INR') as CurrencyCode}
          navigation={navigation}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Statements Tab
// ---------------------------------------------------------------------------

function StatementsTab({
  cardStatements,
  cardId,
  currency,
  navigation,
}: {
  cardStatements: StatementData[];
  cardId: string;
  currency: CurrencyCode;
  navigation: Nav;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (cardStatements.length === 0) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <EmptyState
          icon="file-text"
          title="No Statements"
          subtitle="Upload a statement for this card to see it here."
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingVertical: spacing.md }}>
        {cardStatements.map((stmt) => {
          const dateFormat = stmt.dateFormat ?? dateFormatForCurrency(currency);
          return (
            <TouchableOpacity
              key={stmt.id}
              style={styles.stmtRow}
              onPress={() => navigation.navigate('Analysis', { statementId: stmt.id, cardId })}
              activeOpacity={0.7}
            >
              <View style={styles.stmtIcon}>
                <Feather name="file-text" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stmtPeriod}>
                  {formatDate(stmt.summary.statement_period.from ?? '', dateFormat)} to{' '}
                  {formatDate(stmt.summary.statement_period.to ?? '', dateFormat)}
                </Text>
                <Text style={styles.stmtMeta}>
                  {stmt.summary.total_transactions} transactions · {stmt.bankDetected || 'Unknown bank'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.stmtNet}>
                  {formatCurrency(stmt.summary.net, currency)}
                </Text>
                <View style={styles.stmtBreakdown}>
                  <Text style={[styles.stmtBreakdownText, { color: colors.debit }]}>
                    -{formatCurrency(stmt.summary.total_debits, currency)}
                  </Text>
                </View>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.textMuted}
                style={{ marginLeft: spacing.sm }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Edit Form (Details Tab)
// ---------------------------------------------------------------------------

function EditForm({
  card,
  updateCard,
  removeCard,
  goBack,
}: {
  card: { id: string; nickname: string; last4: string; issuer: string; network: string; creditLimit: number; billingCycle: string; color: string; currency?: CurrencyCode; reminderDay?: number };
  updateCard: (id: string, updates: Record<string, any>) => void;
  removeCard: (id: string) => void;
  goBack: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const handleReminderChange = async (day: number | null) => {
    if (day) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in your device settings to set reminders.');
        return;
      }
      await scheduleCardReminder(card, day);
    } else {
      await cancelCardReminder(card.id);
    }
    updateCard(card.id, { reminderDay: day ?? undefined });
  };

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
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.pickerText}>{CURRENCY_CONFIG[currency].symbol} {currency} - {CURRENCY_CONFIG[currency].label}</Text>
            <Feather name={showCurrencyPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          {showCurrencyPicker && (
            <View style={styles.pickerList}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.pickerItem, currency === c && styles.pickerItemActive]} onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}>
                  <Text style={[styles.pickerItemText, currency === c && { color: colors.accent }]}>
                    {CURRENCY_CONFIG[c].symbol} {c} - {CURRENCY_CONFIG[c].label}
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

        {/* Statement Reminder */}
        <View style={{ marginTop: spacing.sm }}>
          <ReminderDayPicker
            label="Statement Reminder"
            subtitle="Get notified monthly to upload this card's statement"
            value={card.reminderDay}
            onChange={handleReminderChange}
          />
        </View>

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
  notFound: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    textAlign: 'center',
    marginTop: spacing.xxxl,
    lineHeight: 22,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  tabTextActive: {
    color: colors.accent,
  },

  // Details tab
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
    lineHeight: 18,
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
    lineHeight: 20,
  },

  // Statements tab
  stmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stmtIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stmtPeriod: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  stmtMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  stmtNet: {
    color: colors.debit,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  stmtBreakdown: {
    flexDirection: 'row',
    marginTop: 2,
  },
  stmtBreakdownText: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
});

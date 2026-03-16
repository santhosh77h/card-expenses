import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, formatCurrency, SUPPORTED_CURRENCIES, CURRENCY_CONFIG, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore } from '../store';
import type { CreditCard, StatementData, MonthlyUsage } from '../store';
import { Card, PrimaryButton, EmptyState } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import {
  getCardMonthlyBills,
  getCardQuickStats,
  type CardMonthlyBill,
} from '../utils/cardAnalytics';
import { ISSUERS, NETWORKS, ISSUER_CURRENCY, CARD_COLORS } from '../constants/cards';

// ---------------------------------------------------------------------------
// ManageCardsSection — card carousel + detail + add form
// ---------------------------------------------------------------------------

interface Props {
  cards: CreditCard[];
  statements: Record<string, StatementData[]>;
  monthlyUsage: MonthlyUsage[];
  addCard?: (card: CreditCard) => void;
  removeCard?: (id: string) => void;
  /** Hide delete button and add-card form */
  readOnly?: boolean;
}

export default function ManageCardsSection({
  cards,
  statements,
  monthlyUsage,
  addCard,
  removeCard,
  readOnly,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { defaultCurrency } = useStore();
  const [manageCardId, setManageCardId] = useState<string | null>(cards[0]?.id ?? null);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeCard = manageCardId ? cards.find((c) => c.id === manageCardId) ?? null : null;

  const bills = useMemo(
    () => activeCard ? getCardMonthlyBills(activeCard.id, activeCard.creditLimit, monthlyUsage) : [],
    [activeCard, monthlyUsage],
  );

  const quickStats = useMemo(
    () => activeCard ? getCardQuickStats(activeCard.id, statements, monthlyUsage) : null,
    [activeCard, statements, monthlyUsage],
  );

  // If no cards, show add form directly (unless readOnly)
  if (cards.length === 0) {
    if (readOnly) return null;
    return (
      <>
        <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
          <EmptyState
            icon="credit-card"
            title="No cards yet"
            subtitle="Add your first credit card to get started."
          />
        </View>
        {addCard && <AddCardForm addCard={addCard} onDone={() => {}} />}
      </>
    );
  }

  const currency = (activeCard?.currency || defaultCurrency) as CurrencyCode;
  const latestBill = bills[bills.length - 1];
  const utilization = latestBill?.utilization ?? 0;
  const utilizationColor = utilization > 0.75 ? colors.debit : utilization > 0.5 ? colors.warning : colors.accent;

  return (
    <>
      {/* Horizontal card carousel */}
      <FlatList
        data={cards}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setManageCardId(item.id)}
            activeOpacity={0.9}
            style={
              manageCardId === item.id
                ? { borderWidth: 2, borderColor: colors.accent, borderRadius: borderRadius.xl }
                : undefined
            }
          >
            <CreditCardView card={item} compact />
          </TouchableOpacity>
        )}
      />

      {/* Selected card detail */}
      {activeCard && (
        <View style={{ marginTop: spacing.sm }}>
          {/* Card info header */}
          <View style={styles.manageCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.manageCardName}>{activeCard.nickname}</Text>
              <Text style={styles.manageCardInfo}>
                {activeCard.issuer} · {activeCard.network} · ····{activeCard.last4}
              </Text>
            </View>
            {!readOnly && removeCard && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Remove Card',
                    `Remove "${activeCard.nickname}"? This will delete all associated statements and data.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => {
                        removeCard(activeCard.id);
                        setManageCardId(cards.find((c) => c.id !== activeCard.id)?.id ?? null);
                      }},
                    ],
                  );
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.deleteBtn}
              >
                <Feather name="trash-2" size={16} color={colors.debit} />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Feather name="credit-card" size={16} color={colors.accent} />
              <Text style={styles.statValue}>
                {formatCurrency(activeCard.creditLimit, currency)}
              </Text>
              <Text style={styles.statLabel}>Credit Limit</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="file-text" size={16} color={colors.accent} />
              <Text style={styles.statValue}>{quickStats?.totalStatements ?? 0}</Text>
              <Text style={styles.statLabel}>Statements</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="trending-up" size={16} color={colors.accent} />
              <Text style={styles.statValue}>
                {quickStats ? formatCurrency(quickStats.avgMonthlySpend, currency) : '-'}
              </Text>
              <Text style={styles.statLabel}>Avg/Month</Text>
            </View>
          </View>

          {/* Credit utilization gauge */}
          {latestBill && activeCard.creditLimit > 0 && (
            <View style={styles.manageSection}>
              <Text style={styles.manageSectionTitle}>Credit Utilization</Text>
              <Card>
                <View style={styles.utilizationHeader}>
                  <Text style={styles.utilizationAmount}>
                    {formatCurrency(latestBill.totalDebits, currency)}
                  </Text>
                  <Text style={styles.utilizationLimit}>
                    of {formatCurrency(activeCard.creditLimit, currency)}
                  </Text>
                </View>
                <View style={styles.utilizationBarTrack}>
                  <View
                    style={[
                      styles.utilizationBarFill,
                      { width: `${Math.max(utilization * 100, 1)}%`, backgroundColor: utilizationColor },
                    ]}
                  />
                </View>
                <View style={styles.utilizationFooter}>
                  <Text style={[styles.utilizationPct, { color: utilizationColor }]}>
                    {(utilization * 100).toFixed(0)}% used
                  </Text>
                  <Text style={styles.utilizationAvail}>
                    {formatCurrency(Math.max(activeCard.creditLimit - latestBill.totalDebits, 0), currency)} available
                  </Text>
                </View>
                {utilization > 0.75 && (
                  <View style={styles.utilizationWarning}>
                    <Feather name="alert-triangle" size={12} color={colors.debit} />
                    <Text style={styles.utilizationWarningText}>
                      High utilization may impact your credit score
                    </Text>
                  </View>
                )}
              </Card>
            </View>
          )}

          {/* Payment info */}
          {(activeCard.paymentDueDate || activeCard.totalAmountDue != null) && (
            <View style={styles.manageSection}>
              <Card>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentItem}>
                    <Feather name="calendar" size={16} color={colors.warning} />
                    <View>
                      <Text style={styles.paymentLabel}>Due Date</Text>
                      <Text style={styles.paymentValue}>
                        {activeCard.paymentDueDate || 'Not set'}
                      </Text>
                    </View>
                  </View>
                  {activeCard.totalAmountDue != null && (
                    <View style={styles.paymentItem}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.debit }}>{CURRENCY_CONFIG[currency].symbol}</Text>
                      <View>
                        <Text style={styles.paymentLabel}>Amount Due</Text>
                        <Text style={styles.paymentValue}>
                          {formatCurrency(activeCard.totalAmountDue, currency)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                {activeCard.billingCycle && (
                  <View style={styles.billingCycleRow}>
                    <Feather name="repeat" size={12} color={colors.textMuted} />
                    <Text style={styles.billingCycleText}>Billing: {activeCard.billingCycle}</Text>
                  </View>
                )}
              </Card>
            </View>
          )}

          {/* Statement History — scrollable monthly bar chart */}
          {bills.length > 0 && (
            <View style={styles.manageSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.manageSectionTitle}>Statement History</Text>
                <Text style={styles.sectionHeaderMeta}>{bills.length} month{bills.length !== 1 ? 's' : ''}</Text>
              </View>

              <StatementBarChart
                bills={bills}
                currency={currency}
                cardColor={activeCard.color}
                creditLimit={activeCard.creditLimit}
              />

              {quickStats?.highestMonth && quickStats?.lowestMonth && bills.length > 1 && (
                <View style={styles.billSummary}>
                  <View style={styles.billSummaryItem}>
                    <Feather name="arrow-up" size={12} color={colors.debit} />
                    <Text style={styles.billSummaryText}>
                      Highest: {formatCurrency(quickStats.highestMonth.amount, currency)} ({quickStats.highestMonth.month})
                    </Text>
                  </View>
                  <View style={styles.billSummaryItem}>
                    <Feather name="arrow-down" size={12} color={colors.accent} />
                    <Text style={styles.billSummaryText}>
                      Lowest: {formatCurrency(quickStats.lowestMonth.amount, currency)} ({quickStats.lowestMonth.month})
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* No data for this card */}
          {bills.length === 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState
                icon="upload"
                title="No statements"
                subtitle="Upload a statement for this card to see billing history and utilization."
              />
            </View>
          )}
        </View>
      )}

      {/* Add new card toggle/form */}
      {!readOnly && addCard && (
        <View style={styles.addCardSection}>
          {!showAddForm ? (
            <TouchableOpacity
              style={styles.addCardBtn}
              onPress={() => setShowAddForm(true)}
              activeOpacity={0.7}
            >
              <View style={styles.addCardIconCircle}>
                <Feather name="plus" size={20} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.addCardBtnTitle}>Add New Card</Text>
                <Text style={styles.addCardBtnSubtitle}>Set up another credit card</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          ) : (
            <AddCardForm
              addCard={(card) => {
                addCard(card);
                setShowAddForm(false);
                setManageCardId(card.id);
              }}
              onDone={() => setShowAddForm(false)}
            />
          )}
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Statement Bar Chart
// ---------------------------------------------------------------------------

const BAR_WIDTH = 48;
const BAR_GAP = 8;
const CHART_HEIGHT = 180;
const BAR_MAX_HEIGHT = 130;

function StatementBarChart({
  bills,
  currency,
  cardColor,
  creditLimit,
}: {
  bills: CardMonthlyBill[];
  currency: CurrencyCode;
  cardColor: string;
  creditLimit: number;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const maxDebit = Math.max(...bills.map((b) => b.totalDebits), 1);
  const contentWidth = bills.length * (BAR_WIDTH + BAR_GAP) + spacing.lg;

  const selected = selectedIdx !== null ? bills[selectedIdx] : null;

  return (
    <View>
      {selected && (
        <View style={styles.chartTooltip}>
          <Text style={styles.chartTooltipMonth}>{selected.labelYear}</Text>
          <View style={styles.chartTooltipRow}>
            <View style={styles.chartTooltipStat}>
              <Text style={styles.chartTooltipLabel}>Debits</Text>
              <Text style={[styles.chartTooltipValue, { color: colors.debit }]}>
                {formatCurrency(selected.totalDebits, currency)}
              </Text>
            </View>
            <View style={styles.chartTooltipStat}>
              <Text style={styles.chartTooltipLabel}>Credits</Text>
              <Text style={[styles.chartTooltipValue, { color: colors.credit }]}>
                {formatCurrency(selected.totalCredits, currency)}
              </Text>
            </View>
            {creditLimit > 0 && (
              <View style={styles.chartTooltipStat}>
                <Text style={styles.chartTooltipLabel}>Utilization</Text>
                <Text style={[styles.chartTooltipValue, {
                  color: selected.utilization > 0.75 ? colors.debit : selected.utilization > 0.5 ? colors.warning : colors.accent,
                }]}>
                  {(selected.utilization * 100).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.sm, alignItems: 'flex-end', height: CHART_HEIGHT }}
      >
        {creditLimit > 0 && maxDebit > 0 && (
          <View
            style={[
              styles.chartLimitLine,
              {
                bottom: (creditLimit / maxDebit) * BAR_MAX_HEIGHT > BAR_MAX_HEIGHT
                  ? BAR_MAX_HEIGHT + 20
                  : (creditLimit / maxDebit) * BAR_MAX_HEIGHT + 20,
                width: contentWidth,
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.chartLimitDash} />
            <Text style={styles.chartLimitLabel}>Limit</Text>
          </View>
        )}

        {bills.map((bill, idx) => {
          const barH = Math.max((bill.totalDebits / maxDebit) * BAR_MAX_HEIGHT, 4);
          const isSelected = selectedIdx === idx;
          const barColor = bill.utilization > 0.75
            ? colors.debit
            : bill.utilization > 0.5
              ? colors.warning
              : cardColor;

          return (
            <TouchableOpacity
              key={bill.month}
              activeOpacity={0.7}
              onPress={() => setSelectedIdx(isSelected ? null : idx)}
              style={styles.chartBarCol}
            >
              {isSelected && (
                <Text style={styles.chartBarAmount} numberOfLines={1}>
                  {formatCurrency(bill.totalDebits, currency)}
                </Text>
              )}
              <View
                style={[
                  styles.chartBar,
                  {
                    height: barH,
                    backgroundColor: barColor,
                    opacity: selectedIdx !== null && !isSelected ? 0.4 : 1,
                  },
                  isSelected && { borderWidth: 1.5, borderColor: colors.textPrimary },
                ]}
              />
              <Text style={[
                styles.chartBarLabel,
                isSelected && { color: colors.textPrimary, fontWeight: '700' },
              ]}>
                {bill.labelYear}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add Card Form
// ---------------------------------------------------------------------------

function AddCardForm({
  addCard,
  onDone,
}: {
  addCard: (card: CreditCard) => void;
  onDone: () => void;
}) {
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
  };

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <TouchableOpacity onPress={onDone} style={styles.collapseBtn}>
        <Feather name="x" size={18} color={colors.textSecondary} />
        <Text style={styles.collapseBtnText}>Cancel</Text>
      </TouchableOpacity>

      <View style={styles.previewContainer}>
        <CreditCardView card={previewCard} />
      </View>

      <Card>
        <InputField label="Card Nickname" value={nickname} onChangeText={setNickname} placeholder="e.g. HDFC Regalia" />
        <InputField label="Last 4 Digits" value={last4} onChangeText={(t) => setLast4(t.replace(/\D/g, '').slice(0, 4))} placeholder="1234" keyboardType="number-pad" maxLength={4} />

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
          <PrimaryButton title="Save Card" icon="plus" onPress={handleSave} />
        </View>
      </Card>
    </View>
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
  manageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  manageCardName: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '600',
    lineHeight: 26,
  },
  manageCardInfo: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: 2,
    lineHeight: 18,
  },
  deleteBtn: {
    padding: spacing.sm,
    backgroundColor: colors.debit + '15',
    borderRadius: borderRadius.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  manageSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  manageSectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  utilizationHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  utilizationAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    lineHeight: 28,
  },
  utilizationLimit: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  utilizationBarTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  utilizationBarFill: {
    height: 8,
    borderRadius: 4,
  },
  utilizationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  utilizationPct: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  utilizationAvail: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  utilizationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    backgroundColor: colors.debit + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  utilizationWarningText: {
    color: colors.debit,
    fontSize: fontSize.xs,
    fontWeight: '500',
    lineHeight: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  paymentValue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  billingCycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  billingCycleText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  sectionHeaderMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  chartTooltip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTooltipMonth: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  chartTooltipRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  chartTooltipStat: {
    gap: 2,
  },
  chartTooltipLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  chartTooltipValue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  chartLimitLine: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  chartLimitDash: {
    flex: 1,
    height: 1,
    borderTopWidth: 1,
    borderTopColor: colors.textMuted,
    borderStyle: 'dashed',
  },
  chartLimitLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 4,
  },
  chartBarCol: {
    width: BAR_WIDTH,
    marginRight: BAR_GAP,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: BAR_WIDTH - 8,
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarAmount: {
    color: colors.textPrimary,
    fontSize: 8,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  chartBarLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  billSummary: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  billSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  billSummaryText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  addCardSection: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addCardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardBtnTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  addCardBtnSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  collapseBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  previewContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
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

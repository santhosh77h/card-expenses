import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius, fontSize, CURRENCY_CONFIG, SUPPORTED_CURRENCIES } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, CreditCard } from '../store';
import { categorizeTransaction, CATEGORIES } from '../utils/api';
import { Badge, PrimaryButton } from '../components/ui';
import DatePickerField from '../components/DatePickerField';
import { capture, AnalyticsEvents } from '../utils/analytics';
import { pickReceiptImage, captureReceiptPhoto, saveReceipt } from '../utils/receipts';
import LabelPicker from '../components/LabelPicker';

export default function AddTransactionScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cards, addTransaction, updateEnrichment, addLabelToTransaction, defaultCurrency, manualTransactions, statements } = useStore();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(
    cards[0]?.id
  );
  const [notes, setNotes] = useState('');
  const [categoryExpanded, setCategoryExpanded] = useState(false);
  const [manualCategory, setManualCategory] = useState<{
    category: string;
    category_color: string;
    category_icon: string;
  } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [receiptTempUri, setReceiptTempUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [currencyOverride, setCurrencyOverride] = useState<CurrencyCode | null>(null);

  const amountRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  const categoryInfo = useMemo(
    () => categorizeTransaction(description),
    [description]
  );
  const effectiveCategory = manualCategory ?? categoryInfo;

  const selectedCard = cards.find((c) => c.id === selectedCardId);
  const baseCurrency = selectedCard?.currency ?? defaultCurrency;
  const activeCurrency = currencyOverride ?? baseCurrency;
  const currencySymbol = CURRENCY_CONFIG[activeCurrency].symbol;

  // Cycle to next currency
  const cycleCurrency = () => {
    const idx = SUPPORTED_CURRENCIES.indexOf(activeCurrency);
    const next = SUPPORTED_CURRENCIES[(idx + 1) % SUPPORTED_CURRENCIES.length];
    setCurrencyOverride(next === baseCurrency ? null : next);
  };

  // Currency-aware quick amount presets
  const quickAmounts = useMemo(() => {
    if (activeCurrency === 'INR') return [100, 500, 1000, 5000];
    return [10, 50, 100, 500];
  }, [activeCurrency]);
  const incrementStep = activeCurrency === 'INR' ? 100 : 10;

  // Autocomplete: deduplicated descriptions, manual-first then statements
  const allDescriptions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const t of manualTransactions) {
      const key = t.description.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t.description);
      }
    }
    for (const stmts of Object.values(statements)) {
      for (const stmt of stmts) {
        for (const t of stmt.transactions) {
          const key = t.description.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            result.push(t.description);
          }
        }
      }
    }
    return result;
  }, [manualTransactions, statements]);

  const suggestions = useMemo(() => {
    if (!description.trim()) return [];
    const lower = description.toLowerCase();
    return allDescriptions
      .filter((d) => d.toLowerCase().includes(lower) && d.toLowerCase() !== lower)
      .slice(0, 5);
  }, [description, allDescriptions]);

  // Star/flag in header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginLeft: spacing.xs }}
        >
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setFlagged((f) => !f)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginRight: spacing.sm }}
        >
          <Feather
            name="star"
            size={22}
            color={flagged ? colors.warning : colors.textMuted}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, flagged, colors]);

  const canSave = description.trim().length > 0 && parseFloat(amount) > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const txnId = Date.now().toString();
      addTransaction({
        id: txnId,
        date,
        description: description.trim(),
        amount: parseFloat(amount),
        category: effectiveCategory.category,
        category_color: effectiveCategory.category_color,
        category_icon: effectiveCategory.category_icon,
        type,
        cardId: selectedCardId,
        currency: activeCurrency,
      });
      // Consolidate all enrichment writes
      const enrichmentPatch: { notes?: string; flagged?: boolean; receiptUri?: string } = {};
      if (notes.trim()) enrichmentPatch.notes = notes.trim();
      if (flagged) enrichmentPatch.flagged = true;
      if (receiptTempUri) {
        try {
          const savedUri = await saveReceipt(receiptTempUri, txnId);
          enrichmentPatch.receiptUri = savedUri;
        } catch (e) {
          console.error('Failed to save receipt:', e);
        }
      }
      if (Object.keys(enrichmentPatch).length > 0) {
        updateEnrichment(txnId, enrichmentPatch);
      }
      // Assign labels
      for (const labelId of selectedLabelIds) {
        addLabelToTransaction(txnId, labelId);
      }
      capture(AnalyticsEvents.TRANSACTION_ADDED, {
        category: effectiveCategory.category,
        type,
        currency: activeCurrency,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <View style={{ zIndex: 10 }}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Swiggy Order #123"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => {
              setShowSuggestions(false);
              amountRef.current?.focus();
            }}
          />

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => {
                      setDescription(item);
                      setShowSuggestions(false);
                    }}
                  >
                    <Feather name="clock" size={14} color={colors.textMuted} />
                    <Text style={styles.suggestionText} numberOfLines={1}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* Category preview + picker */}
        {description.trim().length > 0 && (
          <View>
            <TouchableOpacity
              style={styles.categoryPreview}
              onPress={() => setCategoryExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: effectiveCategory.category_color },
                ]}
              />
              <Badge
                text={effectiveCategory.category}
                color={effectiveCategory.category_color}
              />
              <Feather
                name={categoryExpanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.textMuted}
              />
              {manualCategory && (
                <TouchableOpacity
                  onPress={() => {
                    setManualCategory(null);
                    setCategoryExpanded(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.autoResetBtn}
                >
                  <Feather name="refresh-cw" size={12} color={colors.accent} />
                  <Text style={styles.autoResetText}>Auto</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {!categoryExpanded && effectiveCategory.category === 'Other' && !manualCategory && (
              <Text style={styles.hint}>
                Tip: use keywords like "swiggy" or "uber" for auto-categorization
              </Text>
            )}
            {categoryExpanded && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {CATEGORIES.map((cat) => {
                  const isActive = effectiveCategory.category === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.name}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                      onPress={() => {
                        setManualCategory({
                          category: cat.name,
                          category_color: cat.color,
                          category_icon: cat.icon,
                        });
                        setCategoryExpanded(false);
                      }}
                    >
                      <View style={[styles.catChipDot, { backgroundColor: cat.color }]} />
                      <Text
                        style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* Amount + Currency */}
        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountRow}>
          <TouchableOpacity
            style={styles.currencyPill}
            onPress={cycleCurrency}
            activeOpacity={0.7}
          >
            <Text style={styles.currencyPillSymbol}>{currencySymbol}</Text>
            <Text style={styles.currencyPillCode}>{activeCurrency}</Text>
            <Feather name="chevron-down" size={12} color={colors.textMuted} />
          </TouchableOpacity>
          <TextInput
            ref={amountRef}
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => dateRef.current?.focus()}
          />
        </View>

        {/* Quick amount pills */}
        <View style={styles.quickAmountRow}>
          {quickAmounts.map((qa) => (
            <TouchableOpacity
              key={qa}
              style={[
                styles.quickAmountBtn,
                parseFloat(amount) === qa && styles.quickAmountBtnActive,
              ]}
              onPress={() => setAmount(qa.toString())}
            >
              <Text
                style={[
                  styles.quickAmountText,
                  parseFloat(amount) === qa && styles.quickAmountTextActive,
                ]}
              >
                {currencySymbol}{qa >= 1000 ? `${qa / 1000}K` : qa}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.incrementBtn}
            onPress={() => {
              const current = parseFloat(amount) || 0;
              setAmount(Math.max(0, current - incrementStep).toString());
            }}
          >
            <Feather name="minus" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.incrementBtn}
            onPress={() => {
              const current = parseFloat(amount) || 0;
              setAmount((current + incrementStep).toString());
            }}
          >
            <Feather name="plus" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <DatePickerField value={date} onChange={setDate} />

        {/* Card selector — always visible */}
        <Text style={styles.label}>Card</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.sm }}
        >
          <TouchableOpacity
            style={[
              styles.cardChip,
              !selectedCardId && styles.cardChipActive,
            ]}
            onPress={() => { setSelectedCardId(undefined); setCurrencyOverride(null); }}
          >
            <Text style={[styles.cardChipText, !selectedCardId && styles.cardChipTextActive]}>
              None
            </Text>
          </TouchableOpacity>
          {cards.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.cardChip,
                selectedCardId === c.id && styles.cardChipActive,
              ]}
              onPress={() => { setSelectedCardId(c.id); setCurrencyOverride(null); }}
            >
              <View style={[styles.cardChipDot, { backgroundColor: c.color }]} />
              <Text style={[styles.cardChipText, selectedCardId === c.id && styles.cardChipTextActive]}>
                {c.nickname} (*{c.last4})
              </Text>
            </TouchableOpacity>
          ))}
          {cards.length === 0 && (
            <TouchableOpacity
              style={styles.addCardChip}
              onPress={() => (navigation as any).navigate('AddCard')}
            >
              <Feather name="plus" size={14} color={colors.accent} />
              <Text style={styles.addCardChipText}>Add Card</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Type toggle */}
        <Text style={styles.label}>Type</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              type === 'debit' && styles.toggleActive,
              type === 'debit' && { borderColor: colors.debit },
            ]}
            onPress={() => setType('debit')}
          >
            <Feather
              name="arrow-up-right"
              size={16}
              color={type === 'debit' ? colors.debit : colors.textMuted}
            />
            <Text
              style={[
                styles.toggleText,
                type === 'debit' && { color: colors.debit },
              ]}
            >
              Debit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              type === 'credit' && styles.toggleActive,
              type === 'credit' && { borderColor: colors.credit },
            ]}
            onPress={() => setType('credit')}
          >
            <Feather
              name="arrow-down-left"
              size={16}
              color={type === 'credit' ? colors.credit : colors.textMuted}
            />
            <Text
              style={[
                styles.toggleText,
                type === 'credit' && { color: colors.credit },
              ]}
            >
              Credit
            </Text>
          </TouchableOpacity>
        </View>

        {/* Labels */}
        <Text style={styles.label}>Labels</Text>
        <LabelPicker selectedIds={selectedLabelIds} onChange={setSelectedLabelIds} />

        {/* Notes (optional) */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          ref={notesRef}
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          placeholder="Add a note..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          returnKeyType="done"
        />

        {/* Receipt attachment */}
        <Text style={styles.label}>Receipt (optional)</Text>
        {receiptTempUri ? (
          <View style={styles.receiptContainer}>
            <Image source={{ uri: receiptTempUri }} style={styles.receiptImage} />
            <TouchableOpacity
              style={styles.removeReceiptBtn}
              onPress={() => setReceiptTempUri(null)}
            >
              <Feather name="x" size={14} color={colors.debit} />
              <Text style={styles.removeReceiptText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.receiptButtons}>
            <TouchableOpacity
              style={styles.receiptBtn}
              onPress={async () => {
                const uri = await captureReceiptPhoto();
                if (uri) setReceiptTempUri(uri);
              }}
            >
              <Feather name="camera" size={18} color={colors.accent} />
              <Text style={styles.receiptBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.receiptBtn}
              onPress={async () => {
                const uri = await pickReceiptImage();
                if (uri) setReceiptTempUri(uri);
              }}
            >
              <Feather name="image" size={18} color={colors.accent} />
              <Text style={styles.receiptBtnText}>Library</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save button */}
        <View style={{ marginTop: spacing.xxl }}>
          <PrimaryButton
            title={saving ? 'Saving...' : 'Save Transaction'}
            icon="check"
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 18,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyPillSymbol: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  currencyPillCode: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  amountInput: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: 4,
  },
  autoResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent + '15',
  },
  autoResetText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  categoryScroll: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.accent + '15',
    borderColor: colors.accent,
  },
  catChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: colors.accent,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    maxHeight: 220,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestionText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    flex: 1,
  },
  quickAmountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  quickAmountBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountBtnActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  quickAmountText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  quickAmountTextActive: {
    color: colors.accent,
  },
  incrementBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    gap: 6,
  },
  cardChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  cardChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  cardChipTextActive: {
    color: colors.accent,
  },
  cardChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addCardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    marginRight: spacing.sm,
    gap: 4,
  },
  addCardChipText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  receiptContainer: {
    marginBottom: spacing.md,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  removeReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  removeReceiptText: {
    color: colors.debit,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  receiptButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  receiptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  receiptBtnText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
});

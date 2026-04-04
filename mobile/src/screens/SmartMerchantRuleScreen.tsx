import React, { useMemo, useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction } from '../store';
import type { RuleCondition, SmartMerchantRule } from '../db/smartMerchantRules';
import { matchRule } from '../utils/smartMerchantEngine';
import { CATEGORIES } from '../utils/api';

const OPERATORS = [
  { value: 'contains' as const, label: 'contains' },
  { value: 'equals' as const, label: 'equals' },
  { value: 'startsWith' as const, label: 'starts with' },
  { value: 'endsWith' as const, label: 'ends with' },
];

export default function SmartMerchantRuleScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    smartMerchantRules,
    addSmartMerchantRule,
    updateSmartMerchantRule,
    deleteSmartMerchantRule,
    manualTransactions,
    statements,
    defaultCurrency,
  } = useStore();

  const ruleId = route.params?.ruleId as string | undefined;
  const existingRule = ruleId ? smartMerchantRules.find((r) => r.id === ruleId) : undefined;
  const isEdit = !!existingRule;

  // --- Form state ---
  const [name, setName] = useState(existingRule?.name ?? '');
  const [conditions, setConditions] = useState<RuleCondition[]>(
    existingRule?.conditions ?? [{ field: 'description', operator: 'contains', value: '' }],
  );
  const [logic, setLogic] = useState<'any' | 'all'>(existingRule?.logic ?? 'any');
  const [category, setCategory] = useState<string | undefined>(existingRule?.category);
  const [categoryColor, setCategoryColor] = useState<string | undefined>(existingRule?.categoryColor);
  const [categoryIcon, setCategoryIcon] = useState<string | undefined>(existingRule?.categoryIcon);

  // --- Dynamic header ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isEdit ? 'Edit Rule' : 'Create Rule',
    });
  }, [navigation, isEdit]);

  // --- All transactions for preview ---
  const allTxns = useMemo(() => {
    const txns: Transaction[] = [...manualTransactions];
    const seenIds = new Set(txns.map((t) => t.id));
    for (const stmts of Object.values(statements)) {
      for (const stmt of stmts) {
        for (const txn of stmt.transactions) {
          if (!seenIds.has(txn.id)) {
            seenIds.add(txn.id);
            txns.push(txn);
          }
        }
      }
    }
    return txns;
  }, [manualTransactions, statements]);

  // --- Live preview ---
  const preview = useMemo(() => {
    const validConditions = conditions.filter((c) => c.value.trim().length > 0);
    if (validConditions.length === 0) return { count: 0, samples: [] as Transaction[] };
    const fakeRule: SmartMerchantRule = {
      id: '', name: '', conditions: validConditions, logic, enabled: true,
      createdAt: '', updatedAt: '',
    };
    const matches: Transaction[] = [];
    for (const txn of allTxns) {
      if (matchRule(txn.description, fakeRule)) matches.push(txn);
    }
    return { count: matches.length, samples: matches.slice(0, 5) };
  }, [conditions, logic, allTxns]);

  // --- Condition management ---
  const addCondition = useCallback(() => {
    setConditions((prev) => [...prev, { field: 'description', operator: 'contains', value: '' }]);
  }, []);

  const removeCondition = useCallback((index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateConditionValue = useCallback((index: number, value: string) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, value } : c)));
  }, []);

  const updateConditionOperator = useCallback((index: number, operator: RuleCondition['operator']) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, operator } : c)));
  }, []);

  // --- Category selection ---
  const selectCategory = useCallback((cat: typeof CATEGORIES[number] | null) => {
    if (cat) {
      setCategory(cat.name);
      setCategoryColor(cat.color);
      setCategoryIcon(cat.icon);
    } else {
      setCategory(undefined);
      setCategoryColor(undefined);
      setCategoryIcon(undefined);
    }
  }, []);

  // --- Save ---
  const canSave = name.trim().length > 0 && conditions.some((c) => c.value.trim().length > 0);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const validConditions = conditions.filter((c) => c.value.trim().length > 0);
    if (validConditions.length === 0) return;

    if (isEdit && existingRule) {
      updateSmartMerchantRule(existingRule.id, {
        name: trimmedName,
        conditions: validConditions,
        logic,
        category,
        categoryColor,
        categoryIcon,
      });
    } else {
      addSmartMerchantRule({
        id: Date.now().toString(),
        name: trimmedName,
        conditions: validConditions,
        logic,
        category,
        categoryColor,
        categoryIcon,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    navigation.goBack();
  }, [name, conditions, logic, category, categoryColor, categoryIcon, isEdit, existingRule, addSmartMerchantRule, updateSmartMerchantRule, navigation]);

  const handleDelete = useCallback(() => {
    if (!existingRule) return;
    Alert.alert('Delete Rule', `Remove "${existingRule.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSmartMerchantRule(existingRule.id);
          navigation.goBack();
        },
      },
    ]);
  }, [existingRule, deleteSmartMerchantRule, navigation]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── DISPLAY NAME ── */}
      <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
      <TextInput
        style={styles.nameInput}
        placeholder="e.g. Food Delivery"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        returnKeyType="next"
        autoCorrect={false}
      />

      {/* ── IF CONDITIONS ── */}
      <View style={styles.ifHeader}>
        <Text style={styles.sectionLabel}>IF</Text>
        <View style={styles.logicToggle}>
          <TouchableOpacity
            style={[styles.logicBtn, logic === 'any' && styles.logicBtnActive]}
            onPress={() => setLogic('any')}
          >
            <Text style={[styles.logicBtnText, logic === 'any' && styles.logicBtnTextActive]}>
              ANY
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.logicBtn, logic === 'all' && styles.logicBtnActive]}
            onPress={() => setLogic('all')}
          >
            <Text style={[styles.logicBtnText, logic === 'all' && styles.logicBtnTextActive]}>
              ALL
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.conditionsCard}>
        {conditions.map((condition, index) => (
          <View
            key={index}
            style={[
              styles.conditionRow,
              index === conditions.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View style={styles.conditionContent}>
              <Text style={styles.conditionField}>description</Text>

              {/* Operator picker */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.operatorScroll}>
                {OPERATORS.map((op) => (
                  <TouchableOpacity
                    key={op.value}
                    style={[
                      styles.operatorChip,
                      condition.operator === op.value && styles.operatorChipActive,
                    ]}
                    onPress={() => updateConditionOperator(index, op.value)}
                  >
                    <Text
                      style={[
                        styles.operatorChipText,
                        condition.operator === op.value && styles.operatorChipTextActive,
                      ]}
                    >
                      {op.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Value input */}
              <TextInput
                style={styles.conditionInput}
                placeholder="keyword..."
                placeholderTextColor={colors.textMuted}
                value={condition.value}
                onChangeText={(val) => updateConditionValue(index, val)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Remove button */}
            {conditions.length > 1 && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeCondition(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={16} color={colors.debit} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.addConditionBtn} onPress={addCondition}>
        <Feather name="plus" size={16} color={colors.accent} />
        <Text style={styles.addConditionText}>Add Condition</Text>
      </TouchableOpacity>

      {/* ── THEN ACTIONS ── */}
      <Text style={styles.sectionLabel}>THEN</Text>
      <View style={styles.thenCard}>
        <Text style={styles.thenLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <TouchableOpacity
            style={[styles.categoryChip, !category && styles.categoryChipActive]}
            onPress={() => selectCategory(null)}
          >
            <Text style={[styles.categoryChipText, !category && styles.categoryChipTextActive]}>
              None
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.name}
              style={[styles.categoryChip, category === cat.name && styles.categoryChipActive]}
              onPress={() => selectCategory(cat)}
            >
              <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
              <Text
                style={[
                  styles.categoryChipText,
                  category === cat.name && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── PREVIEW ── */}
      {preview.count > 0 && (
        <>
          <Text style={styles.sectionLabel}>PREVIEW</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewCount}>
              {preview.count} existing transaction{preview.count !== 1 ? 's' : ''} match
            </Text>
            {preview.samples.map((txn) => (
              <View key={txn.id} style={styles.previewRow}>
                <Text style={styles.previewDesc} numberOfLines={1}>{txn.description}</Text>
                <Text style={[styles.previewAmount, { color: txn.type === 'debit' ? colors.debit : colors.credit }]}>
                  {formatCurrency(txn.amount, (txn.currency ?? defaultCurrency) as CurrencyCode)}
                </Text>
              </View>
            ))}
            {preview.count > 5 && (
              <Text style={styles.previewMore}>+{preview.count - 5} more</Text>
            )}
          </View>
        </>
      )}

      {/* ── SAVE BUTTON ── */}
      <TouchableOpacity
        style={[styles.saveBtn, !canSave && { opacity: 0.35 }]}
        onPress={handleSave}
        disabled={!canSave}
        activeOpacity={0.8}
      >
        <Feather name="check" size={18} color="#000" />
        <Text style={styles.saveBtnText}>{isEdit ? 'Update Rule' : 'Save Rule'}</Text>
      </TouchableOpacity>

      {/* ── DELETE BUTTON (edit only) ── */}
      {isEdit && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
          <Feather name="trash-2" size={16} color={colors.debit} />
          <Text style={styles.deleteBtnText}>Delete Rule</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
      marginTop: spacing.xl,
    },

    // ── Name input ──
    nameInput: {
      backgroundColor: colors.surfaceElevated,
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // ── IF header ──
    ifHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    logicToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      padding: 2,
    },
    logicBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    logicBtnActive: {
      backgroundColor: colors.accent + '20',
    },
    logicBtnText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    logicBtnTextActive: {
      color: colors.accent,
    },

    // ── Conditions ──
    conditionsCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    conditionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: spacing.lg,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    conditionContent: {
      flex: 1,
      gap: spacing.sm,
    },
    conditionField: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },
    operatorScroll: {
      flexGrow: 0,
    },
    operatorChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceElevated,
      marginRight: spacing.xs,
    },
    operatorChipActive: {
      backgroundColor: colors.accent + '20',
    },
    operatorChipText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },
    operatorChipTextActive: {
      color: colors.accent,
    },
    conditionInput: {
      backgroundColor: colors.surfaceElevated,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.debit + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xl,
    },

    // ── Add condition button ──
    addConditionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.accent + '40',
      borderStyle: 'dashed',
    },
    addConditionText: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },

    // ── THEN card ──
    thenCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
    },
    thenLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
      marginBottom: spacing.sm,
    },
    categoryScroll: {
      flexGrow: 0,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surfaceElevated,
      marginRight: spacing.sm,
      borderWidth: 1,
      borderColor: 'transparent',
      gap: 6,
    },
    categoryChipActive: {
      backgroundColor: colors.accent + '15',
      borderColor: colors.accent,
    },
    categoryChipText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },
    categoryChipTextActive: {
      color: colors.accent,
    },
    categoryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    // ── Preview ──
    previewCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    previewCount: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    previewDesc: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      flex: 1,
      marginRight: spacing.md,
    },
    previewAmount: {
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    previewMore: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.xs,
    },

    // ── Save button ──
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      marginTop: spacing.xxl,
    },
    saveBtnText: {
      color: '#000',
      fontSize: fontSize.lg,
      fontWeight: '600',
    },

    // ── Delete button ──
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.debit,
    },
    deleteBtnText: {
      color: colors.debit,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  });

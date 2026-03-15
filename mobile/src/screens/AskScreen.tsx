import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { CurrencyCode } from '../theme';
import { StructuredAnswer } from '../components/AskResultViews';
import { getDb } from '../db';
import { useNLU } from '../utils/useNLU';
import type { NLUResult } from '../utils/nlu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QA {
  question: string;
  result: NLUResult;
  answer: string;
  rows?: Record<string, any>[];
}

// ---------------------------------------------------------------------------
// Query execution against op-sqlite
// ---------------------------------------------------------------------------

function runQuery(result: NLUResult): { answer: string; rows: Record<string, any>[] } {
  const db = getDb();
  const res = db.executeSync(result.sql, result.params);
  const rows = res.rows as Record<string, any>[];

  switch (result.intent) {
    case 'count_transactions': {
      const count = (rows[0]?.result as number) ?? 0;
      const merchant = result.entities.merchant;
      const category = result.entities.category;
      const target = merchant ?? category ?? 'matching';
      return {
        answer: count === 0
          ? `No ${target} transactions found.`
          : `You have ${count} ${target} transaction${count !== 1 ? 's' : ''}.`,
        rows,
      };
    }

    case 'total_spent': {
      const total = (rows[0]?.result as number) ?? 0;
      const currency = (rows[0]?.currency as CurrencyCode) ?? 'INR';
      const target = result.entities.merchant ?? result.entities.category ?? '';
      return {
        answer: total === 0
          ? `No spending found${target ? ` on ${target}` : ''}.`
          : `You spent ${formatCurrency(total, currency)}${target ? ` on ${target}` : ''}.`,
        rows,
      };
    }

    case 'average_spend': {
      const avg = (rows[0]?.result as number) ?? 0;
      const currency = (rows[0]?.currency as CurrencyCode) ?? 'INR';
      const target = result.entities.merchant ?? result.entities.category ?? '';
      return {
        answer: avg === 0
          ? `No transactions found${target ? ` for ${target}` : ''}.`
          : `Your average spend${target ? ` on ${target}` : ''} is ${formatCurrency(avg, currency)}.`,
        rows,
      };
    }

    case 'highest_transaction': {
      if (rows.length === 0) return { answer: 'No transactions found.', rows };
      const r = rows[0];
      const currency = (r.currency as CurrencyCode) ?? 'INR';
      return {
        answer: `Highest: ${formatCurrency(r.amount as number, currency)} — ${r.description} on ${r.date}.`,
        rows,
      };
    }

    case 'lowest_transaction': {
      if (rows.length === 0) return { answer: 'No transactions found.', rows };
      const r = rows[0];
      const currency = (r.currency as CurrencyCode) ?? 'INR';
      return {
        answer: `Lowest: ${formatCurrency(r.amount as number, currency)} — ${r.description} on ${r.date}.`,
        rows,
      };
    }

    case 'category_spend': {
      if (rows.length === 0) return { answer: 'No spending data found.', rows };
      const lines = rows.map((r) => {
        const currency = (r.currency as CurrencyCode) ?? 'INR';
        return `${r.category}: ${formatCurrency(r.total as number, currency)} (${r.count} txns)`;
      });
      return { answer: lines.join('\n'), rows };
    }

    case 'monthly_summary': {
      if (rows.length === 0) return { answer: 'No data for monthly summary.', rows };
      const lines = rows.map((r) => {
        const currency = (r.currency as CurrencyCode) ?? 'INR';
        return `${r.month}: ${formatCurrency(r.total as number, currency)} (${r.count} txns)`;
      });
      return { answer: lines.join('\n'), rows };
    }

    case 'list_transactions':
    case 'transactions_on_date': {
      if (rows.length === 0) return { answer: 'No transactions found.', rows };
      const lines = rows.slice(0, 10).map((r) => {
        const currency = (r.currency as CurrencyCode) ?? 'INR';
        const sign = r.type === 'credit' ? '+' : '-';
        return `${r.date}  ${sign}${formatCurrency(r.amount as number, currency)}  ${r.description}`;
      });
      const suffix = rows.length > 10 ? `\n...and ${rows.length - 10} more` : '';
      return { answer: lines.join('\n') + suffix, rows };
    }

    default:
      return { answer: `${rows.length} result(s) returned.`, rows };
  }
}

// ---------------------------------------------------------------------------
// Suggestion chips
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  'How many transactions this month?',
  'Total spent on food',
  'What was my biggest expense?',
  'Monthly summary',
  'Average spending on groceries',
  'Show shopping transactions',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  const { ready, loading, error, query } = useNLU();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<QA[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (history.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [history.length]);

  const handleSubmit = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || !ready) return;

    const result = query(q);
    if (!result) return;

    try {
      const { answer, rows } = runQuery(result);
      setHistory((prev) => [...prev, { question: q, result, answer, rows }]);
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        { question: q, result, answer: `Error: ${err?.message ?? 'Query failed'}` },
      ]);
    }

    setInput('');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Feather name="message-circle" size={20} color={colors.accent} />
        <Text style={styles.headerTitle}>Ask Vector</Text>
      </View>

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading / Error state */}
        {loading && (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.statusText}>Loading NLU models...</Text>
          </View>
        )}
        {error && (
          <View style={styles.statusCard}>
            <Feather name="alert-circle" size={16} color={colors.debit} />
            <Text style={[styles.statusText, { color: colors.debit }]}>{error}</Text>
          </View>
        )}

        {/* Empty state */}
        {!loading && !error && history.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="search" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Ask anything about your expenses</Text>
            <Text style={styles.emptySubtitle}>
              Powered by on-device AI — works offline
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.chip}
                  activeOpacity={0.7}
                  onPress={() => {
                    setInput(s);
                    handleSubmit(s);
                  }}
                >
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Q&A History */}
        {history.map((qa, i) => (
          <View key={i} style={styles.qaBlock}>
            {/* Question */}
            <View style={styles.questionRow}>
              <Text style={styles.questionText}>{qa.question}</Text>
            </View>
            {/* Answer */}
            <View style={[styles.answerCard, qa.rows && qa.rows.length > 0 && styles.answerCardWide]}>
              <View style={styles.intentBadge}>
                <Text style={styles.intentText}>
                  {qa.result.intent.replace(/_/g, ' ')}
                </Text>
                <Text style={styles.confidenceText}>
                  {Math.round(qa.result.confidence * 100)}%
                </Text>
              </View>
              <StructuredAnswer intent={qa.result.intent} answer={qa.answer} rows={qa.rows} />
              {/* Debug: entities */}
              {Object.keys(qa.result.entities).length > 0 && (
                <View style={styles.entitiesRow}>
                  {Object.entries(qa.result.entities).map(([key, val]) => (
                    <View key={key} style={styles.entityChip}>
                      <Text style={styles.entityKey}>{key}:</Text>
                      <Text style={styles.entityVal}>{val}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder={ready ? 'Ask about your expenses...' : 'Loading models...'}
          placeholderTextColor={colors.textMuted}
          editable={ready}
          returnKeyType="send"
          onSubmitEditing={() => handleSubmit()}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!ready || !input.trim()) && styles.sendBtnDisabled]}
          activeOpacity={0.7}
          onPress={() => handleSubmit()}
          disabled={!ready || !input.trim()}
        >
          <Feather name="arrow-up" size={20} color={colors.background} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '600',
    lineHeight: 26,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  // Status
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 20,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },

  // Q&A
  qaBlock: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  questionRow: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '40',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.sm,
  },
  questionText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  answerCard: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  answerCardWide: {
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  intentText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confidenceText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  answerText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  entitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  entityChip: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  entityKey: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  entityVal: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
});

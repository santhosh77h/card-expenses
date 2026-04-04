import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Keyboard,
  Modal,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { spacing, borderRadius, fontSize, formatCurrency, categoryColors, CurrencyCode } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction, CreditCard } from '../store';
import { EmptyState, PrimaryButton } from '../components/ui';
// TransactionDetailModal removed — using navigation-based formSheet instead
import SpendingCalendar from '../components/SpendingCalendar';
import type { RootStackParamList, TabParamList } from '../navigation';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Transactions'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getMonthName(yyyymm: string): string {
  const m = parseInt(yyyymm.split('-')[1], 10);
  return MONTHS_FULL[m - 1] || '';
}

export default function TransactionsScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cards, manualTransactions, enrichments, defaultCurrency } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [enrichmentFilter, setEnrichmentFilter] = useState<'flagged' | 'notes' | 'receipt' | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const cardMap = useMemo(() => {
    const map: Record<string, CreditCard> = {};
    for (const c of cards) map[c.id] = c;
    return map;
  }, [cards]);

  const allCategories = useMemo(() => {
    const cats = new Set(manualTransactions.map((t) => t.category));
    return Array.from(cats).sort();
  }, [manualTransactions]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const t of manualTransactions) {
      months.add(t.date.substring(0, 7));
    }
    return Array.from(months).sort().reverse();
  }, [manualTransactions]);

  useEffect(() => {
    if (monthFilter === null && availableMonths.length > 0) {
      setMonthFilter(availableMonths[0]);
    }
  }, [availableMonths]);

  const handleMonthChange = useCallback((m: string | null) => {
    setMonthFilter(m);
    setSelectedDay(null);
  }, []);

  const effectiveMonth = monthFilter === null
    ? null
    : availableMonths.includes(monthFilter)
      ? monthFilter
      : availableMonths[0] ?? null;

  useEffect(() => {
    if (monthFilter !== null && effectiveMonth !== monthFilter) {
      setMonthFilter(effectiveMonth);
    }
  }, [effectiveMonth, monthFilter]);

  // Swipe handlers
  const monthIdx = effectiveMonth ? availableMonths.indexOf(effectiveMonth) : -1;
  const canSwipeLeft = monthIdx >= 0 && monthIdx < availableMonths.length - 1;
  const canSwipeRight = monthIdx > 0;

  const handleSwipeLeft = useCallback(() => {
    const idx = availableMonths.indexOf(effectiveMonth!);
    if (idx >= 0 && idx < availableMonths.length - 1) {
      handleMonthChange(availableMonths[idx + 1]);
    }
  }, [effectiveMonth, availableMonths, handleMonthChange]);

  const handleSwipeRight = useCallback(() => {
    const idx = availableMonths.indexOf(effectiveMonth!);
    if (idx > 0) {
      handleMonthChange(availableMonths[idx - 1]);
    }
  }, [effectiveMonth, availableMonths, handleMonthChange]);

  const cardCurrencies = useMemo(() => {
    const map: Record<string, CurrencyCode> = {};
    for (const c of cards) {
      if (c.currency) map[c.id] = c.currency;
    }
    return map;
  }, [cards]);

  const usedCards = useMemo(() => {
    const ids = new Set(manualTransactions.map((t) => t.cardId).filter(Boolean));
    return Array.from(ids).map((id) => cardMap[id!]).filter(Boolean) as CreditCard[];
  }, [manualTransactions, cardMap]);

  const filteredTransactions = useMemo(() => {
    let result = [...manualTransactions];
    if (effectiveMonth) {
      result = result.filter((t) => t.date.startsWith(effectiveMonth));
    }
    if (selectedDay !== null && effectiveMonth) {
      const dayStr = String(selectedDay).padStart(2, '0');
      const datePrefix = `${effectiveMonth}-${dayStr}`;
      result = result.filter((t) => t.date.startsWith(datePrefix));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (cardFilter !== null) {
      if (cardFilter === '__none__') {
        result = result.filter((t) => !t.cardId);
      } else {
        result = result.filter((t) => t.cardId === cardFilter);
      }
    }
    if (enrichmentFilter) {
      result = result.filter((t) => {
        const e = enrichments[t.id];
        if (!e) return false;
        if (enrichmentFilter === 'flagged') return e.flagged;
        if (enrichmentFilter === 'notes') return !!e.notes;
        if (enrichmentFilter === 'receipt') return !!e.receiptUri;
        return false;
      });
    }
    result.sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount;
      return b.date.localeCompare(a.date);
    });
    return result;
  }, [manualTransactions, effectiveMonth, selectedDay, searchQuery, categoryFilter, cardFilter, enrichmentFilter, sortBy, enrichments]);

  // Group filtered transactions by date
  const daySections = useMemo(() => {
    if (!filteredTransactions.length) return [];
    const grouped: Record<string, Transaction[]> = {};
    for (const txn of filteredTransactions) {
      const day = txn.date.substring(0, 10);
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(txn);
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, data]) => {
        const totals: Record<string, number> = {};
        for (const t of data) {
          const cur = t.currency ?? (t.cardId ? cardMap[t.cardId]?.currency : undefined) ?? defaultCurrency;
          if (!totals[cur]) totals[cur] = 0;
          totals[cur] += t.type === 'debit' ? t.amount : -t.amount;
        }
        return { date, totals, data };
      });
  }, [filteredTransactions, cardMap, defaultCurrency]);

  // Month-scoped totals (unaffected by day/search/category filters)
  const monthTotals = useMemo(() => {
    const source = effectiveMonth
      ? manualTransactions.filter((t) => t.date.startsWith(effectiveMonth))
      : manualTransactions;
    const byCurrency: Record<string, { debits: number; credits: number; count: number }> = {};
    for (const t of source) {
      const cur = t.currency ?? (t.cardId ? cardMap[t.cardId]?.currency : undefined) ?? defaultCurrency;
      if (!byCurrency[cur]) byCurrency[cur] = { debits: 0, credits: 0, count: 0 };
      if (t.type === 'debit') byCurrency[cur].debits += t.amount;
      else byCurrency[cur].credits += t.amount;
      byCurrency[cur].count++;
    }
    return byCurrency;
  }, [manualTransactions, effectiveMonth, cardMap, defaultCurrency]);

  const monthTotalCurrencies = Object.keys(monthTotals) as CurrencyCode[];

  // Per-currency avg per day
  const daysInMonth = useMemo(() => {
    if (!effectiveMonth) return 1;
    const [y, m] = effectiveMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [effectiveMonth]);

  const monthTransactions = useMemo(() => {
    if (!effectiveMonth) return [];
    return manualTransactions.filter((t) => t.date.startsWith(effectiveMonth));
  }, [manualTransactions, effectiveMonth]);

  // Month picker data
  const { pickerYears, availableSet } = useMemo(() => {
    const groups = new Map<number, string[]>();
    for (const m of availableMonths) {
      const y = parseInt(m.split('-')[0], 10);
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y)!.push(m);
    }
    return {
      pickerYears: Array.from(groups.keys()).sort((a, b) => b - a),
      availableSet: new Set(availableMonths),
    };
  }, [availableMonths]);

  // Toggle search with animation
  const toggleSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowSearch((prev) => {
      if (prev) {
        setSearchQuery('');
        Keyboard.dismiss();
      }
      return !prev;
    });
    // Focus the input after showing
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  const activeCard = cardFilter && cardFilter !== '__none__' ? cardMap[cardFilter] : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isAll = effectiveMonth === null;
  const monthLabel = isAll ? 'All' : getMonthName(effectiveMonth);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          {/* Month name — tap to open picker */}
          <TouchableOpacity
            style={styles.monthLabel}
            onPress={() => setMonthPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.monthText}>{monthLabel}</Text>
            <Feather name="chevron-down" size={18} color={colors.textMuted} style={{ marginTop: 2 }} />
          </TouchableOpacity>

          {/* Action icons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerIcon,
                cardFilter !== null && styles.headerIconActive,
              ]}
              onPress={() => setCardPickerOpen(true)}
              activeOpacity={0.7}
            >
              <Feather
                name="credit-card"
                size={16}
                color={cardFilter !== null ? colors.accent : colors.textSecondary}
              />
              {cardFilter !== null && <View style={styles.headerIconDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerIcon,
                showSearch && styles.headerIconActive,
              ]}
              onPress={toggleSearch}
              activeOpacity={0.7}
            >
              <Feather
                name="search"
                size={16}
                color={showSearch ? colors.accent : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar — slides in when toggled */}
        {showSearch && (
          <View style={styles.searchRow}>
            <Feather name="search" size={15} color={colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search transactions..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              accessibilityLabel="Search transactions"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stats strip — one row per currency */}
        {effectiveMonth && monthTotalCurrencies.length > 0 && (
          <View style={styles.statsStrip}>
            {monthTotalCurrencies.map((cur, i) => (
              <React.Fragment key={cur}>
                {i > 0 && <View style={styles.statRowDivider} />}
                <View style={styles.statRow}>
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>SPENT</Text>
                    <Text style={[styles.statValue, { color: colors.debit }]}>
                      {formatCurrency(monthTotals[cur]?.debits ?? 0, cur)}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>AVG / DAY</Text>
                    <Text style={styles.statValue}>
                      {formatCurrency((monthTotals[cur]?.debits ?? 0) / daysInMonth, cur)}
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statLabel}>CREDITS</Text>
                    <Text style={[styles.statValue, { color: colors.credit }]}>
                      +{formatCurrency(monthTotals[cur]?.credits ?? 0, cur)}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {/* ── Content ── */}
      {manualTransactions.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="list"
            title="No Transactions Yet"
            subtitle="Add your first transaction to see it auto-categorized and tracked here."
          />
          <View style={{ paddingHorizontal: spacing.lg }}>
            <PrimaryButton
              title="Add Transaction"
              icon="plus"
              onPress={() => navigation.navigate('AddTransaction')}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={daySections}
          keyExtractor={(s) => s.date}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <PrimaryButton
                title="Add Transaction"
                icon="plus"
                onPress={() => navigation.navigate('AddTransaction')}
              />

              {/* Spending calendar heatmap */}
              {effectiveMonth && (
                <SpendingCalendar
                  transactions={monthTransactions}
                  month={effectiveMonth}
                  defaultCurrency={defaultCurrency}
                  cardCurrencies={cardCurrencies}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  enrichments={enrichments}
                  onSwipeLeft={canSwipeLeft ? handleSwipeLeft : undefined}
                  onSwipeRight={canSwipeRight ? handleSwipeRight : undefined}
                />
              )}

              {/* Category chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
              >
                <TouchableOpacity
                  style={[styles.chip, !categoryFilter && styles.chipActive]}
                  onPress={() => setCategoryFilter(null)}
                >
                  <Text style={[styles.chipText, !categoryFilter && styles.chipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {allCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, categoryFilter === cat && styles.chipActive]}
                    onPress={() =>
                      setCategoryFilter(categoryFilter === cat ? null : cat)
                    }
                  >
                    <View
                      style={[
                        styles.chipDot,
                        { backgroundColor: categoryColors[cat] || colors.textMuted },
                      ]}
                    />
                    <Text
                      style={[styles.chipText, categoryFilter === cat && styles.chipTextActive]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Enrichment chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
              >
                <TouchableOpacity
                  style={[styles.chip, enrichmentFilter === 'flagged' && styles.chipActive]}
                  onPress={() =>
                    setEnrichmentFilter(enrichmentFilter === 'flagged' ? null : 'flagged')
                  }
                >
                  <Feather name="star" size={12} color={enrichmentFilter === 'flagged' ? colors.accent : colors.textSecondary} style={{ marginRight: spacing.xs }} />
                  <Text style={[styles.chipText, enrichmentFilter === 'flagged' && styles.chipTextActive]}>
                    Starred
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, enrichmentFilter === 'notes' && styles.chipActive]}
                  onPress={() =>
                    setEnrichmentFilter(enrichmentFilter === 'notes' ? null : 'notes')
                  }
                >
                  <Feather name="message-square" size={12} color={enrichmentFilter === 'notes' ? colors.accent : colors.textSecondary} style={{ marginRight: spacing.xs }} />
                  <Text style={[styles.chipText, enrichmentFilter === 'notes' && styles.chipTextActive]}>
                    Has Notes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, enrichmentFilter === 'receipt' && styles.chipActive]}
                  onPress={() =>
                    setEnrichmentFilter(enrichmentFilter === 'receipt' ? null : 'receipt')
                  }
                >
                  <Feather name="paperclip" size={12} color={enrichmentFilter === 'receipt' ? colors.accent : colors.textSecondary} style={{ marginRight: spacing.xs }} />
                  <Text style={[styles.chipText, enrichmentFilter === 'receipt' && styles.chipTextActive]}>
                    Has Receipt
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Sort toggle */}
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>{filteredTransactions.length} transactions</Text>
                <TouchableOpacity
                  style={styles.sortToggle}
                  onPress={() => setSortBy(sortBy === 'date' ? 'amount' : 'date')}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort ${sortBy === 'date' ? 'by date' : 'by amount'}`}
                >
                  <Feather name="repeat" size={14} color={colors.textSecondary} />
                  <Text style={styles.sortToggleText}>
                    {sortBy === 'date' ? 'By Date' : 'By Amount'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item: section }) => {
            const d = new Date(section.date + 'T00:00:00');
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const fullDate = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' });
            return (
              <View style={styles.dayCard}>
                {/* Day header */}
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayHeaderDate}>{fullDate}</Text>
                    <Text style={styles.dayHeaderDay}>{dayName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {Object.entries(section.totals).map(([cur, total]) => (
                      <Text key={cur} style={[styles.dayHeaderTotal, { color: total > 0 ? colors.debit : colors.credit }]}>
                        {formatCurrency(Math.abs(total), cur as CurrencyCode)}
                      </Text>
                    ))}
                    <Text style={styles.dayHeaderSub}>
                      {section.data.length} txn{section.data.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Transaction rows */}
                {section.data.map((txn, idx) => {
                  const enrichment = enrichments[txn.id];
                  const txnCur = txn.currency ?? (txn.cardId ? cardMap[txn.cardId]?.currency : undefined) ?? defaultCurrency;
                  return (
                    <TouchableOpacity
                      key={txn.id}
                      style={[
                        styles.txnRow,
                        idx === section.data.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('TransactionDetail', { transaction: txn, cardId: txn.cardId })}
                    >
                      {/* Category icon */}
                      <View style={[styles.txnIcon, { backgroundColor: txn.category_color + '20' }]}>
                        <Feather
                          name={(txn.category_icon || 'help-circle') as keyof typeof Feather.glyphMap}
                          size={16}
                          color={txn.category_color}
                        />
                      </View>

                      {/* Description + category */}
                      <View style={styles.txnInfo}>
                        <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
                        <View style={styles.txnSubRow}>
                          <Text style={styles.txnSub}>{txn.category}</Text>
                          {enrichment?.flagged && (
                            <Feather name="star" size={10} color={colors.warning} />
                          )}
                          {!!enrichment?.notes && (
                            <Feather name="message-square" size={10} color={colors.textMuted} />
                          )}
                        </View>
                      </View>

                      {/* Amount */}
                      <Text
                        style={[
                          styles.txnAmount,
                          { color: txn.type === 'debit' ? colors.debit : colors.credit },
                        ]}
                      >
                        {txn.type === 'debit' ? '\u2013' : '+'}
                        {formatCurrency(txn.amount, txnCur)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }}
        />
      )}

      {/* ── Month Picker Modal ── */}
      <Modal visible={monthPickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMonthPickerOpen(false)}
        >
          <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>Select Month</Text>

            <TouchableOpacity
              style={[styles.allCell, isAll && styles.monthCellActive]}
              onPress={() => {
                handleMonthChange(null);
                setMonthPickerOpen(false);
              }}
            >
              <Text style={[styles.allCellText, isAll && styles.monthCellTextActive]}>
                All Transactions
              </Text>
            </TouchableOpacity>

            {pickerYears.map((year) => (
              <View key={year}>
                <Text style={styles.yearLabel}>{year}</Text>
                <View style={styles.monthGrid}>
                  {MONTHS_SHORT.map((name, idx) => {
                    const mm = `${year}-${String(idx + 1).padStart(2, '0')}`;
                    const isAvailable = availableSet.has(mm);
                    const isSelected = mm === effectiveMonth;
                    return (
                      <TouchableOpacity
                        key={mm}
                        style={[
                          styles.monthCell,
                          isSelected && styles.monthCellActive,
                          !isAvailable && styles.monthCellDisabled,
                        ]}
                        disabled={!isAvailable}
                        onPress={() => {
                          handleMonthChange(mm);
                          setMonthPickerOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.monthCellText,
                            isSelected && styles.monthCellTextActive,
                            !isAvailable && styles.monthCellTextDisabled,
                          ]}
                        >
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Card Picker Modal ── */}
      <Modal visible={cardPickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCardPickerOpen(false)}
        >
          <View style={styles.cardPickerContainer} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>Filter by Card</Text>

            <TouchableOpacity
              style={[styles.cardPickerRow, cardFilter === null && styles.cardPickerRowActive]}
              onPress={() => {
                setCardFilter(null);
                setCardPickerOpen(false);
              }}
            >
              <View style={styles.cardPickerLeft}>
                <Feather name="layers" size={16} color={cardFilter === null ? colors.accent : colors.textSecondary} />
                <Text style={[styles.cardPickerName, cardFilter === null && styles.cardPickerNameActive]}>All Cards</Text>
              </View>
              {cardFilter === null && <Feather name="check" size={16} color={colors.accent} />}
            </TouchableOpacity>

            {usedCards.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.cardPickerRow, cardFilter === c.id && styles.cardPickerRowActive]}
                onPress={() => {
                  setCardFilter(cardFilter === c.id ? null : c.id);
                  setCardPickerOpen(false);
                }}
              >
                <View style={styles.cardPickerLeft}>
                  <View style={[styles.cardPickerDot, { backgroundColor: c.color }]} />
                  <View>
                    <Text style={[styles.cardPickerName, cardFilter === c.id && styles.cardPickerNameActive]}>
                      {c.nickname}
                    </Text>
                    {c.last4 && (
                      <Text style={styles.cardPickerLast4}>...{c.last4}</Text>
                    )}
                  </View>
                </View>
                {cardFilter === c.id && <Feather name="check" size={16} color={colors.accent} />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.cardPickerRow, cardFilter === '__none__' && styles.cardPickerRowActive]}
              onPress={() => {
                setCardFilter(cardFilter === '__none__' ? null : '__none__');
                setCardPickerOpen(false);
              }}
            >
              <View style={styles.cardPickerLeft}>
                <Feather name="minus-circle" size={16} color={cardFilter === '__none__' ? colors.accent : colors.textMuted} />
                <Text style={[styles.cardPickerName, cardFilter === '__none__' && styles.cardPickerNameActive]}>No Card</Text>
              </View>
              {cardFilter === '__none__' && <Feather name="check" size={16} color={colors.accent} />}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthText: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconActive: {
    backgroundColor: colors.accent + '18',
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  headerIconDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },

  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
  },

  // ── Stats Strip ──
  statsStrip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
  },
  statRowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },

  // ── Day Card (grouped by date) ──
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayHeaderDate: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  dayHeaderDay: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    lineHeight: 28,
  },
  dayHeaderTotal: {
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  dayHeaderSub: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  // ── Transaction Row (inside day card) ──
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnInfo: {
    flex: 1,
  },
  txnDesc: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  txnSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  txnSub: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  txnAmount: {
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },

  // ── Chips ──
  chipRow: {
    marginBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
    lineHeight: 16,
  },
  chipTextActive: {
    color: colors.accent,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sortLabel: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortToggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
    marginLeft: spacing.xs,
  },
  listHeader: {
    // No horizontal padding — FlatList contentContainerStyle handles it
  },

  // ── Modal Shared ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Month Picker ──
  pickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: SCREEN_WIDTH - 48,
    maxHeight: Dimensions.get('window').height * 0.6,
  },
  pickerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  yearLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  monthCell: {
    width: '22%' as any,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  monthCellActive: {
    backgroundColor: colors.accent + '30',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  monthCellDisabled: {
    backgroundColor: 'transparent',
  },
  monthCellText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  monthCellTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  monthCellTextDisabled: {
    color: colors.textMuted,
  },
  allCell: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.md,
  },
  allCellText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },

  // ── Card Picker ──
  cardPickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: SCREEN_WIDTH - 64,
    maxHeight: Dimensions.get('window').height * 0.5,
  },
  cardPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  cardPickerRowActive: {
    backgroundColor: colors.accent + '12',
  },
  cardPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardPickerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cardPickerName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  cardPickerNameActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  cardPickerLast4: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 1,
  },
});

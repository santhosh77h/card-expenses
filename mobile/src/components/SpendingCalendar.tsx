import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import type { Transaction } from '../store';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAV_HEIGHT = 48;
const WEEK_HEADER_HEIGHT = 28;
const POPOVER_WIDTH = 200;
const POPOVER_AUTO_DISMISS_MS = 3000;
const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 500;

interface SpendingCalendarProps {
  transactions: Transaction[];
  month: string; // "YYYY-MM"
  defaultCurrency: CurrencyCode;
  /** cardId -> currency mapping for resolving transaction currencies */
  cardCurrencies: Record<string, CurrencyCode>;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  enrichments?: Record<string, { flagged?: boolean; notes?: string }>;
  /** Called when user swipes left (older month). Undefined = no older month. */
  onSwipeLeft?: () => void;
  /** Called when user swipes right (newer month). Undefined = no newer month. */
  onSwipeRight?: () => void;
}

/** Per-currency totals for a single day */
type DayCurrencyTotals = Record<CurrencyCode, number>;

interface PopoverState {
  day: number;
  weekIdx: number;
  dayIdx: number;
}

interface PopoverData {
  dateFormatted: string;
  currencyTotals: { currency: CurrencyCode; amount: number }[];
  txnCount: number;
  debitCount: number;
  topDescriptions: { desc: string; currency: CurrencyCode; amount: number }[];
  hasFlagged: boolean;
  hasNotes: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abbreviateAmount(n: number, symbol: string): string {
  if (n >= 10_000_000) return `${symbol}${(n / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 100_000) return `${symbol}${(n / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1_000) return `${symbol}${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${symbol}${Math.round(n)}`;
}

function getCurrencySymbol(currency: CurrencyCode): string {
  const symbols: Record<string, string> = { INR: '\u20B9', USD: '$', EUR: '\u20AC', GBP: '\u00A3' };
  return symbols[currency] || '\u20B9';
}

// ---------------------------------------------------------------------------
// Popover sub-component
// ---------------------------------------------------------------------------

function PopoverContent({
  data,
  top,
  left,
  colors,
  styles,
  onDismiss,
}: {
  data: PopoverData;
  top: number;
  left: number;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onDismiss: () => void;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 150 });
    scale.value = withTiming(1, { duration: 150 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onDismiss}
      />
      <Animated.View
        style={[styles.popover, animStyle, { top, left }]}
        accessibilityRole="summary"
      >
        <Text style={styles.popoverDate}>{data.dateFormatted}</Text>

        {/* Currency-wise totals */}
        {data.currencyTotals.map(({ currency, amount }) => (
          <View key={currency} style={styles.popoverCurrencyRow}>
            <Text style={styles.popoverAmount}>
              {formatCurrency(amount, currency)}
            </Text>
          </View>
        ))}

        <Text style={styles.popoverTxnCount}>
          {data.debitCount} debit{data.debitCount !== 1 ? 's' : ''}
          {data.txnCount > data.debitCount ? `, ${data.txnCount - data.debitCount} credit${data.txnCount - data.debitCount !== 1 ? 's' : ''}` : ''}
        </Text>

        {/* Top transaction descriptions */}
        {data.topDescriptions.map((item, i) => (
          <View key={i} style={styles.popoverDescRow}>
            <View style={styles.popoverDescBullet} />
            <Text style={styles.popoverDesc} numberOfLines={1}>{item.desc}</Text>
            <Text style={styles.popoverDescAmount}>
              {getCurrencySymbol(item.currency)}{abbreviateAmount(item.amount, '').replace(/^0$/, '0')}
            </Text>
          </View>
        ))}

        {(data.hasFlagged || data.hasNotes) && (
          <View style={styles.popoverIndicators}>
            {data.hasFlagged && <Feather name="star" size={11} color={colors.warning} />}
            {data.hasNotes && <Feather name="message-square" size={11} color={colors.textMuted} />}
          </View>
        )}

        <View style={[
          styles.popoverCaret,
          top > MONTH_NAV_HEIGHT + WEEK_HEADER_HEIGHT + 40
            ? styles.popoverCaretBottom
            : styles.popoverCaretTop,
        ]} />
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main calendar component
// ---------------------------------------------------------------------------

function SpendingCalendar({
  transactions,
  month,
  defaultCurrency,
  cardCurrencies,
  selectedDay,
  onSelectDay,
  enrichments,
  onSwipeLeft,
  onSwipeRight,
}: SpendingCalendarProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const firstDayOfWeek = new Date(year, monthNum - 1, 1).getDay();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthNum;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  const cellWidth = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md * 2) / 7;
  const cellHeight = cellWidth / 0.9;

  /** Resolve a transaction's effective currency */
  const resolveCurrency = useCallback((t: Transaction): CurrencyCode => {
    return (t.currency ?? (t.cardId ? cardCurrencies[t.cardId] : undefined) ?? defaultCurrency) as CurrencyCode;
  }, [cardCurrencies, defaultCurrency]);

  // ---------------------------------------------------------------------------
  // Swipe animation
  // ---------------------------------------------------------------------------

  const translateX = useSharedValue(0);
  const prevMonth = useRef(month);

  useEffect(() => {
    if (prevMonth.current !== month) {
      const enterFrom = translateX.value <= 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
      translateX.value = enterFrom;
      translateX.value = withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
      prevMonth.current = month;
    }
  }, [month]);

  const dismissPopover = useCallback(() => setPopover(null), []);

  const panGesture = useMemo(() => {
    const g = Gesture.Pan()
      .activeOffsetX([-30, 30])
      .failOffsetY([-15, 15])
      .onStart(() => {
        'worklet';
        runOnJS(dismissPopover)();
      })
      .onUpdate((e) => {
        'worklet';
        // If no handler for that direction, dampen the drag (rubber-band feel)
        const canGoLeft = !!onSwipeLeft;
        const canGoRight = !!onSwipeRight;
        if ((!canGoLeft && e.translationX < 0) || (!canGoRight && e.translationX > 0)) {
          translateX.value = e.translationX * 0.2; // dampened
        } else {
          translateX.value = e.translationX;
        }
      })
      .onEnd((e) => {
        'worklet';
        const swipedLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -VELOCITY_THRESHOLD;
        const swipedRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD;

        if (swipedLeft && onSwipeLeft) {
          translateX.value = withTiming(-SCREEN_WIDTH, { duration: 250 }, (finished) => {
            if (finished) runOnJS(onSwipeLeft)();
          });
        } else if (swipedRight && onSwipeRight) {
          translateX.value = withTiming(SCREEN_WIDTH, { duration: 250 }, (finished) => {
            if (finished) runOnJS(onSwipeRight)();
          });
        } else {
          translateX.value = withTiming(0, { duration: 200 });
        }
      });

    // Disable the gesture entirely when no navigation is possible in either direction
    if (!onSwipeLeft && !onSwipeRight) {
      g.enabled(false);
    }

    return g;
  }, [onSwipeLeft, onSwipeRight, dismissPopover]);

  const animatedCalendarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // ---------------------------------------------------------------------------
  // Multi-currency daily totals
  // ---------------------------------------------------------------------------

  /** day -> { currency -> totalDebitAmount } */
  const dailyCurrencyTotals = useMemo(() => {
    const map: Record<number, DayCurrencyTotals> = {};
    for (const t of transactions) {
      if (t.type !== 'debit') continue;
      const day = parseInt(t.date.substring(8, 10), 10);
      const cur = resolveCurrency(t);
      if (!map[day]) map[day] = {} as DayCurrencyTotals;
      map[day][cur] = (map[day][cur] || 0) + t.amount;
    }
    return map;
  }, [transactions, resolveCurrency]);

  /** For heatmap intensity: total debit across all currencies per day */
  const dailyTotalAll = useMemo(() => {
    const map: Record<number, number> = {};
    for (const [dayStr, currencies] of Object.entries(dailyCurrencyTotals)) {
      const day = Number(dayStr);
      map[day] = Object.values(currencies).reduce((s, a) => s + a, 0);
    }
    return map;
  }, [dailyCurrencyTotals]);

  /** Primary (highest amount) currency per day, plus count of other currencies */
  const dailyDisplay = useMemo(() => {
    const map: Record<number, { currency: CurrencyCode; amount: number; extraCount: number }> = {};
    for (const [dayStr, currencies] of Object.entries(dailyCurrencyTotals)) {
      const day = Number(dayStr);
      const entries = Object.entries(currencies) as [CurrencyCode, number][];
      entries.sort((a, b) => b[1] - a[1]); // highest amount first
      const [primaryCur, primaryAmt] = entries[0];
      map[day] = { currency: primaryCur, amount: primaryAmt, extraCount: entries.length - 1 };
    }
    return map;
  }, [dailyCurrencyTotals]);

  const enrichedDays = useMemo(() => {
    const set = new Set<number>();
    if (!enrichments) return set;
    for (const t of transactions) {
      const e = enrichments[t.id];
      if (e?.flagged || e?.notes) {
        set.add(parseInt(t.date.substring(8, 10), 10));
      }
    }
    return set;
  }, [transactions, enrichments]);

  const maxSpend = useMemo(() => {
    const vals = Object.values(dailyTotalAll);
    return vals.length > 0 ? Math.max(...vals) : 0;
  }, [dailyTotalAll]);

  const getIntensity = useCallback((amount: number): number => {
    if (maxSpend === 0 || amount === 0) return 0;
    const ratio = amount / maxSpend;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.45) return 2;
    if (ratio <= 0.7) return 3;
    return 4;
  }, [maxSpend]);

  const weeks = useMemo(() => {
    const rows: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) currentWeek.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        rows.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      rows.push(currentWeek);
    }
    return rows;
  }, [daysInMonth, firstDayOfWeek]);

  // ---------------------------------------------------------------------------
  // Day press + long-press
  // ---------------------------------------------------------------------------

  const handleDayPress = useCallback((day: number) => {
    setPopover(null);
    onSelectDay(selectedDay === day ? null : day);
  }, [selectedDay, onSelectDay]);

  const handleLongPress = useCallback((day: number, weekIdx: number, dayIdx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPopover({ day, weekIdx, dayIdx });
  }, []);

  useEffect(() => {
    if (!popover) return;
    const timer = setTimeout(() => setPopover(null), POPOVER_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [popover]);

  // ---------------------------------------------------------------------------
  // Popover data + positioning
  // ---------------------------------------------------------------------------

  const popoverData = useMemo((): PopoverData | null => {
    if (!popover) return null;
    const dayStr = String(popover.day).padStart(2, '0');
    const dateStr = `${month}-${dayStr}`;
    const dayTxns = transactions.filter(t => t.date === dateStr);
    const debits = dayTxns.filter(t => t.type === 'debit');

    // Currency-wise debit totals (sorted by amount desc)
    const curMap: Record<string, number> = {};
    for (const t of debits) {
      const cur = resolveCurrency(t);
      curMap[cur] = (curMap[cur] || 0) + t.amount;
    }
    const currencyTotals = Object.entries(curMap)
      .sort((a, b) => b[1] - a[1])
      .map(([currency, amount]) => ({ currency: currency as CurrencyCode, amount }));

    const topDescriptions = debits.slice(0, 3).map(t => ({
      desc: t.description.length > 22 ? t.description.slice(0, 22) + '...' : t.description,
      currency: resolveCurrency(t),
      amount: t.amount,
    }));

    const hasFlagged = enrichments ? dayTxns.some(t => enrichments[t.id]?.flagged) : false;
    const hasNotes = enrichments ? dayTxns.some(t => !!enrichments[t.id]?.notes) : false;
    const dateFormatted = `${popover.day} ${MONTHS_FULL[monthNum - 1]} ${year}`;

    return {
      dateFormatted,
      currencyTotals,
      txnCount: dayTxns.length,
      debitCount: debits.length,
      topDescriptions,
      hasFlagged,
      hasNotes,
    };
  }, [popover, transactions, month, enrichments, monthNum, year, resolveCurrency]);

  const popoverPosition = useMemo(() => {
    if (!popover) return { top: 0, left: 0 };

    const cellCenterX = popover.dayIdx * cellWidth + cellWidth / 2;
    const cellTopY = MONTH_NAV_HEIGHT + WEEK_HEADER_HEIGHT + popover.weekIdx * cellHeight;
    const containerWidth = cellWidth * 7;

    const estimatedPopoverH = 90
      + (popoverData?.currencyTotals.length ?? 1) * 24
      + (popoverData?.topDescriptions.length ?? 0) * 20;

    const showAbove = cellTopY > estimatedPopoverH + 12;
    const top = showAbove
      ? cellTopY - estimatedPopoverH - 8
      : cellTopY + cellHeight + 8;

    const left = Math.max(4, Math.min(cellCenterX - POPOVER_WIDTH / 2, containerWidth - POPOVER_WIDTH - 4));

    return { top, left };
  }, [popover, cellWidth, cellHeight, popoverData]);

  // ---------------------------------------------------------------------------
  // Heatmap colors
  // ---------------------------------------------------------------------------

  const intensityColors = [
    'transparent',
    colors.debit + '15',
    colors.debit + '28',
    colors.debit + '40',
    colors.debit + '60',
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.outerWrapper}>
      <View style={styles.clipWrapper}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.container, animatedCalendarStyle]}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity
                style={[styles.monthNavBtn, !onSwipeRight && styles.monthNavBtnDisabled]}
                onPress={onSwipeRight}
                disabled={!onSwipeRight}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather
                  name="chevron-left"
                  size={18}
                  color={onSwipeRight ? colors.textPrimary : colors.textMuted}
                />
              </TouchableOpacity>
              <Text style={styles.monthNavLabel}>
                {MONTHS_FULL[monthNum - 1]} {year}
              </Text>
              <TouchableOpacity
                style={[styles.monthNavBtn, !onSwipeLeft && styles.monthNavBtnDisabled]}
                onPress={onSwipeLeft}
                disabled={!onSwipeLeft}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather
                  name="chevron-right"
                  size={18}
                  color={onSwipeLeft ? colors.textPrimary : colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Day-of-week header */}
            <View style={styles.weekHeader}>
              {DAYS_OF_WEEK.map((label, i) => (
                <View key={i} style={[styles.weekHeaderCell, { width: cellWidth }]}>
                  <Text style={[
                    styles.weekHeaderText,
                    (i === 0 || i === 6) && styles.weekHeaderTextWeekend,
                  ]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            {weeks.map((week, weekIdx) => (
              <View key={weekIdx} style={styles.weekRow}>
                {week.map((day, dayIdx) => {
                  if (day === null) {
                    return <View key={dayIdx} style={[styles.dayCell, { width: cellWidth }]} />;
                  }

                  const totalSpend = dailyTotalAll[day] || 0;
                  const display = dailyDisplay[day];
                  const intensity = getIntensity(totalSpend);
                  const isToday = day === todayDay;
                  const isSelected = day === selectedDay;
                  const hasEnrichment = enrichedDays.has(day);
                  const hasSpend = totalSpend > 0;

                  return (
                    <TouchableOpacity
                      key={dayIdx}
                      style={[styles.dayCell, { width: cellWidth }]}
                      activeOpacity={0.6}
                      onPress={() => hasSpend ? handleDayPress(day) : undefined}
                      onLongPress={() => hasSpend ? handleLongPress(day, weekIdx, dayIdx) : undefined}
                      delayLongPress={400}
                      disabled={!hasSpend}
                      accessibilityHint={hasSpend ? 'Long press for daily summary' : undefined}
                    >
                      <View style={[
                        styles.dayCellInner,
                        hasSpend && {
                          backgroundColor: intensityColors[intensity],
                          borderRadius: borderRadius.md,
                        },
                        isSelected && styles.dayCellSelected,
                      ]}>
                        {isToday ? (
                          <View style={styles.todayRing}>
                            <Text style={styles.todayText}>{day}</Text>
                          </View>
                        ) : (
                          <Text style={[
                            styles.dayNumber,
                            hasSpend && styles.dayNumberActive,
                            !hasSpend && styles.dayNumberEmpty,
                            isSelected && styles.dayNumberSelected,
                          ]}>
                            {day}
                          </Text>
                        )}

                        {hasSpend && display && (
                          <Text
                            style={[
                              styles.dayAmount,
                              intensity >= 3 && styles.dayAmountHigh,
                              isSelected && styles.dayAmountSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {abbreviateAmount(display.amount, getCurrencySymbol(display.currency))}
                            {display.extraCount > 0 && (
                              <Text style={styles.dayAmountExtra}>+</Text>
                            )}
                          </Text>
                        )}

                        {hasEnrichment && (
                          <View style={styles.enrichmentDot} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Popover */}
      {popover && popoverData && (
        <PopoverContent
          data={popoverData}
          top={popoverPosition.top}
          left={popoverPosition.left}
          colors={colors}
          styles={styles}
          onDismiss={dismissPopover}
        />
      )}
    </View>
  );
}

export default React.memo(SpendingCalendar);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    outerWrapper: {
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    clipWrapper: {
      overflow: 'hidden',
      borderRadius: borderRadius.lg,
    },
    container: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    // ── Month navigation ──
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: MONTH_NAV_HEIGHT,
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.xs,
    },
    monthNavBtn: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
    },
    monthNavBtnDisabled: {
      opacity: 0.3,
      backgroundColor: 'transparent',
      borderColor: colors.border,
    },
    monthNavLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    // ── Week header ──
    weekHeader: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
      height: WEEK_HEADER_HEIGHT,
      alignItems: 'center',
    },
    weekHeaderCell: {
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    weekHeaderText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    weekHeaderTextWeekend: {
      color: colors.textMuted,
      opacity: 0.6,
    },
    weekRow: {
      flexDirection: 'row',
    },
    dayCell: {
      aspectRatio: 0.9,
      padding: 2,
    },
    dayCellInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.sm,
      gap: 1,
    },
    dayCellSelected: {
      borderWidth: 1.5,
      borderColor: colors.accent,
      backgroundColor: colors.accent + '15',
    },
    dayNumber: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    dayNumberActive: {
      color: colors.debit,
    },
    dayNumberEmpty: {
      color: colors.textMuted,
      fontWeight: '400',
      opacity: 0.5,
    },
    dayNumberSelected: {
      color: colors.accent,
    },
    todayRing: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayText: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.textOnAccent,
    },
    dayAmount: {
      fontSize: 9,
      fontWeight: '500',
      color: colors.debit,
      opacity: 0.85,
    },
    dayAmountHigh: {
      fontWeight: '700',
      opacity: 1,
    },
    dayAmountSelected: {
      color: colors.accent,
      opacity: 1,
    },
    dayAmountExtra: {
      fontSize: 8,
      fontWeight: '700',
      color: colors.warning,
    },
    enrichmentDot: {
      position: 'absolute',
      bottom: 3,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
    },
    // Popover styles
    popover: {
      position: 'absolute',
      width: POPOVER_WIDTH,
      backgroundColor: colors.surfaceElevated,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 100,
    },
    popoverDate: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    popoverCurrencyRow: {
      marginBottom: 2,
    },
    popoverAmount: {
      color: colors.debit,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    popoverTxnCount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '500',
      marginBottom: 8,
      marginTop: 4,
    },
    popoverDescRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 3,
      gap: 6,
    },
    popoverDescBullet: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      opacity: 0.5,
    },
    popoverDesc: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    popoverDescAmount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },
    popoverIndicators: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    popoverCaret: {
      position: 'absolute',
      alignSelf: 'center',
      width: 10,
      height: 10,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      transform: [{ rotate: '45deg' }],
    },
    popoverCaretBottom: {
      bottom: -5,
      left: POPOVER_WIDTH / 2 - 5,
      borderBottomWidth: 1,
      borderRightWidth: 1,
    },
    popoverCaretTop: {
      top: -5,
      left: POPOVER_WIDTH / 2 - 5,
      borderTopWidth: 1,
      borderLeftWidth: 1,
    },
  });

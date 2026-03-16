import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { monthLabelFull } from '../utils/cardAnalytics';

interface Props {
  selectedMonth: string | null; // "YYYY-MM" or null for "All"
  availableMonths: string[]; // sorted descending
  onChangeMonth: (month: string | null) => void;
  allowAll?: boolean;                    // enables "All" navigation step
  renderSubtitle?: () => React.ReactNode; // slot below month label
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthSelector({ selectedMonth, availableMonths, onChangeMonth, allowAll, renderSubtitle }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isAll = selectedMonth === null;
  const currentIdx = isAll ? -1 : availableMonths.indexOf(selectedMonth);

  // Navigation logic: when allowAll, "All" sits before the newest month (index 0)
  const canGoNewer = isAll ? false : (allowAll || currentIdx > 0);
  const canGoOlder = isAll ? (availableMonths.length > 0) : (currentIdx < availableMonths.length - 1);

  const goNewer = () => {
    if (!canGoNewer) return;
    if (currentIdx === 0 && allowAll) {
      onChangeMonth(null); // newest month → All
    } else if (currentIdx > 0) {
      onChangeMonth(availableMonths[currentIdx - 1]);
    }
  };
  const goOlder = () => {
    if (!canGoOlder) return;
    if (isAll) {
      onChangeMonth(availableMonths[0]); // All → newest month
    } else {
      onChangeMonth(availableMonths[currentIdx + 1]);
    }
  };

  // Group available months by year for the picker grid
  const { years, availableSet } = useMemo(() => {
    const groups = new Map<number, string[]>();
    for (const m of availableMonths) {
      const y = parseInt(m.split('-')[0], 10);
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y)!.push(m);
    }
    return {
      years: Array.from(groups.keys()).sort((a, b) => b - a),
      availableSet: new Set(availableMonths),
    };
  }, [availableMonths]);

  return (
    <>
      <View style={styles.strip}>
        <TouchableOpacity
          onPress={goNewer}
          disabled={!canGoNewer}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name="chevron-left"
            size={20}
            color={canGoNewer ? colors.textPrimary : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setPickerOpen(true)} style={styles.labelBtn}>
          <Text style={styles.label}>{isAll ? 'All Transactions' : monthLabelFull(selectedMonth)}</Text>
          <Feather name="chevron-down" size={14} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goOlder}
          disabled={!canGoOlder}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather
            name="chevron-right"
            size={20}
            color={canGoOlder ? colors.textPrimary : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {renderSubtitle?.()}

      {/* Month picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        >
          <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>Select Month</Text>

            {allowAll && (
              <TouchableOpacity
                style={[styles.allCell, isAll && styles.monthCellActive]}
                onPress={() => {
                  onChangeMonth(null);
                  setPickerOpen(false);
                }}
              >
                <Text style={[styles.allCellText, isAll && styles.monthCellTextActive]}>
                  All Transactions
                </Text>
              </TouchableOpacity>
            )}

            {years.map((year) => (
              <View key={year}>
                <Text style={styles.yearLabel}>{year}</Text>
                <View style={styles.monthGrid}>
                  {MONTHS_SHORT.map((name, idx) => {
                    const mm = `${year}-${String(idx + 1).padStart(2, '0')}`;
                    const isAvailable = availableSet.has(mm);
                    const isSelected = mm === selectedMonth;
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
                          onChangeMonth(mm);
                          setPickerOpen(false);
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
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  labelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
    lineHeight: 22,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: Dimensions.get('window').width - 48,
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
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { monthLabelFull } from '../utils/cardAnalytics';

interface Props {
  selectedMonth: string; // "YYYY-MM"
  availableMonths: string[]; // sorted descending
  onChangeMonth: (month: string) => void;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthSelector({ selectedMonth, availableMonths, onChangeMonth }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentIdx = availableMonths.indexOf(selectedMonth);
  const canGoNewer = currentIdx > 0;
  const canGoOlder = currentIdx < availableMonths.length - 1;

  const goNewer = () => {
    if (canGoNewer) onChangeMonth(availableMonths[currentIdx - 1]);
  };
  const goOlder = () => {
    if (canGoOlder) onChangeMonth(availableMonths[currentIdx + 1]);
  };

  // Group available months by year for the picker grid
  const yearGroups = new Map<number, string[]>();
  for (const m of availableMonths) {
    const y = parseInt(m.split('-')[0], 10);
    if (!yearGroups.has(y)) yearGroups.set(y, []);
    yearGroups.get(y)!.push(m);
  }
  const years = Array.from(yearGroups.keys()).sort((a, b) => b - a);
  const availableSet = new Set(availableMonths);

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
          <Text style={styles.label}>{monthLabelFull(selectedMonth)}</Text>
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

      {/* Month picker modal */}
      <Modal visible={pickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        >
          <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
            <Text style={styles.pickerTitle}>Select Month</Text>

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

const styles = StyleSheet.create({
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
    fontWeight: '700',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  yearLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
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
  },
  monthCellTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  monthCellTextDisabled: {
    color: colors.textMuted,
  },
});

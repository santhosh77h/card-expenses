import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';

interface Props {
  label: string;
  subtitle?: string;
  value: number | null | undefined;
  onChange: (day: number | null) => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function ReminderDayPicker({ label, subtitle, value, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const enabled = value != null && value > 0;

  return (
    <View style={styles.container}>
      {/* Header row with toggle */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => {
          if (enabled) {
            onChange(null);
          } else {
            setExpanded(true);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, enabled && styles.iconWrapActive]}>
          <Feather name="bell" size={16} color={enabled ? colors.accent : colors.textMuted} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.label}>{label}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {enabled ? (
          <View style={styles.dayBadge}>
            <Text style={styles.dayBadgeText}>{value}{ordinal(value!)}</Text>
          </View>
        ) : (
          <Text style={styles.offText}>Off</Text>
        )}
      </TouchableOpacity>

      {/* Day grid — shown when setting/changing */}
      {(expanded || enabled) && (
        <TouchableOpacity
          style={styles.changeBtn}
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.changeBtnText}>{expanded ? 'Hide' : 'Change day'}</Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.grid}>
          {DAYS.map((d) => {
            const isActive = d === value;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.dayCell, isActive && styles.dayCellActive]}
                onPress={() => {
                  onChange(d);
                  setExpanded(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayCellText, isActive && styles.dayCellTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconWrapActive: {
    backgroundColor: colors.accent + '20',
  },
  textCol: {
    flex: 1,
  },
  label: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  dayBadge: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  dayBadgeText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  offText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginLeft: 48,
    gap: 4,
  },
  changeBtnText: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  dayCellActive: {
    backgroundColor: colors.accent,
  },
  dayCellText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  dayCellTextActive: {
    color: colors.background,
    fontWeight: '700',
  },
});

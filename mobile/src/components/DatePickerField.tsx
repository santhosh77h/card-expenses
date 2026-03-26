/**
 * DatePickerField — a pressable field that opens the native date picker.
 *
 * Stores dates as YYYY-MM-DD strings for consistency with the rest of the app.
 * Displays dates in a user-friendly format (e.g. "03 Jan 2024").
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors, useIsDark } from '../hooks/useColors';

interface Props {
  value: string;                      // YYYY-MM-DD
  onChange: (date: string) => void;    // receives YYYY-MM-DD
  placeholder?: string;
}

function parseDate(str: string): Date {
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatForDisplay(str: string): string {
  const d = parseDate(str);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DatePickerField({ value, onChange, placeholder }: Props) {
  const colors = useColors();
  const isDark = useIsDark();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPicker, setShowPicker] = useState(false);

  const dateObj = parseDate(value);
  const displayText = value ? formatForDisplay(value) : (placeholder ?? 'Select date');

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selected) {
      onChange(toYMD(selected));
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setShowPicker(!showPicker)} activeOpacity={0.7}>
        <Feather name="calendar" size={16} color={colors.textMuted} />
        <Text style={[styles.text, !value && styles.placeholder]}>
          {displayText}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
          themeVariant={isDark ? 'dark' : 'light'}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  placeholder: {
    color: colors.textMuted,
  },
});

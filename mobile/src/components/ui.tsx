import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../theme';

// ---------------------------------------------------------------------------
// Card wrapper
// ---------------------------------------------------------------------------

export const Card = React.memo(function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
});

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

export const SectionHeader = React.memo(function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Stat row — label + value
// ---------------------------------------------------------------------------

export const StatRow = React.memo(function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export const Badge = React.memo(function Badge({
  text,
  color = colors.accent,
}: {
  text: string;
  color?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Amount text
// ---------------------------------------------------------------------------

export const AmountText = React.memo(function AmountText({
  amount,
  type,
  size = 'md',
  currency,
}: {
  amount: number;
  type: 'debit' | 'credit';
  size?: 'sm' | 'md' | 'lg';
  currency?: CurrencyCode;
}) {
  const color = type === 'debit' ? colors.debit : colors.credit;
  const prefix = type === 'debit' ? '-' : '+';
  const sizeMap = { sm: fontSize.sm, md: fontSize.md, lg: fontSize.xl };
  return (
    <Text style={{ color, fontSize: sizeMap[size], fontWeight: '700' }}>
      {prefix}{formatCurrency(amount, currency ?? 'INR')}
    </Text>
  );
});

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

export const ProgressBar = React.memo(function ProgressBar({
  progress,
  color = colors.accent,
  height = 6,
  style,
}: {
  progress: number;
  color?: string;
  height?: number;
  style?: ViewStyle;
}) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return (
    <View style={[styles.progressBg, { height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${clamped * 100}%`,
            backgroundColor: color,
            height,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EmptyState = React.memo(function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.emptyState} accessibilityRole="text">
      <Feather name={icon} size={48} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Primary button
// ---------------------------------------------------------------------------

export const PrimaryButton = React.memo(function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  icon,
  variant = 'filled',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'filled' | 'outline';
}) {
  const isFilled = variant === 'filled';
  return (
    <TouchableOpacity
      style={[
        styles.primaryBtn,
        isFilled
          ? { backgroundColor: colors.accent }
          : { borderWidth: 1, borderColor: colors.accent },
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {icon && (
        <Feather
          name={icon}
          size={18}
          color={isFilled ? colors.background : colors.accent}
          style={{ marginRight: spacing.sm }}
        />
      )}
      <Text
        style={[
          styles.primaryBtnText,
          { color: isFilled ? colors.background : colors.accent },
        ]}
      >
        {loading ? 'Processing...' : title}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  sectionAction: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  progressBg: {
    backgroundColor: colors.surfaceElevated,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
    minHeight: 52,
  },
  primaryBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});

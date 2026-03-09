import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { useStore } from '../store';
import { Card, Badge } from '../components/ui';
import { presentPaywall } from '../utils/revenueCat';
import type { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { cards, statements, manualTransactions, isPremium } = useStore();

  const statementCount = useMemo(
    () => Object.values(statements).reduce((sum, arr) => sum + arr.length, 0),
    [statements],
  );

  const txnCount = useMemo(
    () =>
      Object.values(statements).reduce(
        (sum, arr) => sum + arr.reduce((s, st) => s + st.transactions.length, 0),
        0,
      ) + manualTransactions.length,
    [statements, manualTransactions],
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header / Branding */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.brand}>VECTOR</Text>
        <Text style={styles.tagline}>Your Money. Directed.</Text>
        <View style={styles.badgeRow}>
          {isPremium ? (
            <Badge text="PRO" color={colors.accent} />
          ) : (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => presentPaywall()}
              activeOpacity={0.8}
            >
              <Feather name="zap" size={14} color={colors.warning} style={{ marginRight: spacing.xs }} />
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Stats */}
      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <StatColumn label="Cards" value={String(cards.length)} />
          <View style={styles.statsDivider} />
          <StatColumn label="Statements" value={String(statementCount)} />
          <View style={styles.statsDivider} />
          <StatColumn label="Transactions" value={String(txnCount)} />
        </View>
      </Card>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <MenuItem
          icon="credit-card"
          label="My Cards"
          subtitle={`${cards.length} card${cards.length !== 1 ? 's' : ''}`}
          onPress={() => navigation.navigate('CardList')}
        />
        <MenuItem
          icon="database"
          label="Data & Backup"
          subtitle="Export or restore your data"
          onPress={() => navigation.navigate('Backup')}
        />
        {!isPremium && (
          <MenuItem
            icon="zap"
            label="Upgrade to Pro"
            subtitle="Unlock all features"
            iconColor={colors.warning}
            onPress={() => presentPaywall()}
          />
        )}
      </View>

      {/* About */}
      <Card style={styles.aboutCard}>
        <View style={styles.aboutRow}>
          <Feather name="info" size={16} color={colors.textMuted} />
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
        <View style={styles.aboutDivider} />
        <View style={styles.privacyRow}>
          <Feather name="shield" size={14} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <Text style={styles.privacyText}>
            Your data stays on your device. Vector never uploads your financial information.
          </Text>
        </View>
      </Card>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Stat column
// ---------------------------------------------------------------------------

function StatColumn({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Menu item row
// ---------------------------------------------------------------------------

function MenuItem({
  icon,
  label,
  subtitle,
  iconColor = colors.accent,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle: string;
  iconColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: iconColor + '15' }]}>
        <Feather name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
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
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: fontSize.hero,
    fontWeight: '800',
    letterSpacing: 4,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  badgeRow: {
    marginTop: spacing.lg,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  upgradeBtnText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statsCard: {
    marginHorizontal: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  menuSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  menuSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  aboutCard: {
    marginHorizontal: spacing.lg,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aboutLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    flex: 1,
  },
  aboutValue: {
    color: colors.textMuted,
    fontSize: fontSize.md,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: colors.surfaceElevated,
    marginVertical: spacing.md,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  privacyText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    flex: 1,
    lineHeight: 18,
  },
});

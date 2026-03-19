import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing, borderRadius, fontSize, formatCurrency, formatDate, dateFormatForCurrency, CurrencyCode, CURRENCY_CONFIG, SUPPORTED_CURRENCIES } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, StatementData } from '../store';
import { Card, Badge, SectionHeader } from '../components/ui';
import { presentPaywall } from '../utils/revenueCat';
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  // Native module not available (e.g. Expo Go)
}
import type { RootStackParamList } from '../navigation';
import { capture, AnalyticsEvents } from '../utils/analytics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cards, statements, manualTransactions, isPremium, licenseInfo, themeMode, setThemeMode, defaultCurrency, setDefaultCurrency, biometricLockEnabled, setBiometricLockEnabled } = useStore();
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);

  // Check biometric availability on mount
  useMemo(() => {
    if (!LocalAuthentication) { setBiometricAvailable(false); return; }
    LocalAuthentication.hasHardwareAsync().then((hw) => {
      if (!hw) { setBiometricAvailable(false); return; }
      LocalAuthentication!.isEnrolledAsync().then(setBiometricAvailable);
    });
  }, []);

  const handleBiometricToggle = useCallback(async () => {
    if (!LocalAuthentication) return;
    if (biometricLockEnabled) {
      setBiometricLockEnabled(false);
      return;
    }
    // Verify biometric before enabling
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify to enable app lock',
      fallbackLabel: 'Use passcode',
    });
    if (result.success) {
      setBiometricLockEnabled(true);
    } else {
      Alert.alert('Authentication Failed', 'Could not verify your identity. Please try again.');
    }
  }, [biometricLockEnabled, setBiometricLockEnabled]);

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

  const allStatements = useMemo(() => {
    const result: (StatementData & { cardNickname: string; cardCurrency: CurrencyCode })[] = [];
    for (const card of cards) {
      const cardStatements = statements[card.id] || [];
      for (const stmt of cardStatements) {
        result.push({ ...stmt, cardNickname: card.nickname, cardCurrency: card.currency ?? defaultCurrency });
      }
    }
    result.sort(
      (a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime()
    );
    return result;
  }, [cards, statements]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header / Branding */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.brand}>VECTOR</Text>
        <Text style={styles.tagline}>Your Money. Directed.</Text>
        <View style={styles.badgeRow}>
          {licenseInfo.tier === 'trial' ? (
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Badge text="TRIAL" color={colors.warning} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 }}>
                {licenseInfo.trialRemaining} statement{licenseInfo.trialRemaining !== 1 ? 's' : ''} remaining
              </Text>
            </View>
          ) : isPremium ? (
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Badge text="PRO" color={colors.accent} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 }}>
                {licenseInfo.subAllowanceRemaining} this month{licenseInfo.creditBalance > 0 ? ` + ${licenseInfo.creditBalance} credits` : ''}
              </Text>
            </View>
          ) : licenseInfo.creditBalance > 0 ? (
            <View style={{ alignItems: 'center', gap: spacing.xs }}>
              <Badge text="PAY-AS-YOU-GO" color={colors.textSecondary} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 }}>
                {licenseInfo.creditBalance} credit{licenseInfo.creditBalance !== 1 ? 's' : ''} remaining
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => { capture(AnalyticsEvents.UPGRADE_TAPPED, { source: 'profile_header' }); presentPaywall(); }}
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
          icon="message-circle"
          label="Ask Vector"
          subtitle="Query your expenses with AI"
          iconColor={colors.accent}
          onPress={() => navigation.navigate('Ask')}
        />
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
        {!isPremium && licenseInfo.tier !== 'trial' && licenseInfo.creditBalance === 0 && (
          <MenuItem
            icon="zap"
            label="Upgrade to Pro"
            subtitle="Unlock all features"
            iconColor={colors.warning}
            onPress={() => { capture(AnalyticsEvents.UPGRADE_TAPPED, { source: 'profile_menu' }); presentPaywall(); }}
          />
        )}
      </View>

      {/* Appearance */}
      <View style={styles.appearanceSection}>
        <Text style={styles.appearanceTitle}>Appearance</Text>
        <View style={styles.themePicker}>
          {([
            { mode: 'light' as ThemeMode, icon: 'sun' as const, label: 'Light' },
            { mode: 'dark' as ThemeMode, icon: 'moon' as const, label: 'Dark' },
            { mode: 'system' as ThemeMode, icon: 'smartphone' as const, label: 'Auto' },
          ]).map(({ mode, icon, label }) => {
            const isActive = themeMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.themeOption, isActive && styles.themeOptionActive]}
                onPress={() => setThemeMode(mode)}
                activeOpacity={0.7}
              >
                <Feather name={icon} size={16} color={isActive ? colors.accent : colors.textMuted} />
                <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Currency */}
      <View style={styles.appearanceSection}>
        <Text style={styles.appearanceTitle}>Currency</Text>
        <View style={styles.themePicker}>
          {SUPPORTED_CURRENCIES.map((code) => {
            const isActive = defaultCurrency === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.themeOption, isActive && styles.themeOptionActive]}
                onPress={() => setDefaultCurrency(code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.currencySymbol, isActive && styles.themeOptionTextActive]}>
                  {CURRENCY_CONFIG[code].symbol}
                </Text>
                <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>
                  {code}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Security */}
      {biometricAvailable && (
        <View style={styles.appearanceSection}>
          <Text style={styles.appearanceTitle}>Security</Text>
          <TouchableOpacity
            style={styles.biometricRow}
            onPress={handleBiometricToggle}
            activeOpacity={0.7}
          >
            <View style={[styles.biometricIcon, biometricLockEnabled && styles.biometricIconActive]}>
              <Feather name="lock" size={16} color={biometricLockEnabled ? colors.accent : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.biometricLabel}>App Lock</Text>
              <Text style={styles.biometricDesc}>
                Require Face ID / fingerprint to open the app
              </Text>
            </View>
            <View style={[styles.toggle, biometricLockEnabled && styles.toggleActive]}>
              <View style={[styles.toggleKnob, biometricLockEnabled && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Statements */}
      {allStatements.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          <SectionHeader title="Recent Statements" />
          {allStatements.slice(0, 5).map((stmt) => (
            <TouchableOpacity
              key={stmt.id}
              style={styles.statementRow}
              onPress={() =>
                navigation.navigate('Analysis', {
                  statementId: stmt.id,
                  cardId: stmt.cardId,
                })
              }
            >
              <View style={styles.statementIcon}>
                <Feather name="file-text" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statementCard}>{stmt.cardNickname}</Text>
                <Text style={styles.statementDate}>
                  {formatDate(stmt.summary.statement_period.from ?? '', stmt.dateFormat ?? dateFormatForCurrency(stmt.cardCurrency))} to{' '}
                  {formatDate(stmt.summary.statement_period.to ?? '', stmt.dateFormat ?? dateFormatForCurrency(stmt.cardCurrency))}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.statementAmount}>
                  {formatCurrency(stmt.summary.net, stmt.cardCurrency)}
                </Text>
                <Text style={styles.statementCount}>
                  {stmt.summary.total_transactions} txns
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.textMuted}
                style={{ marginLeft: spacing.sm }}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  iconColor,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  subtitle: string;
  iconColor?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resolvedIconColor = iconColor ?? colors.accent;

  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, { backgroundColor: resolvedIconColor + '15' }]}>
        <Feather name={icon} size={18} color={resolvedIconColor} />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    fontWeight: '700',
    letterSpacing: 4,
    lineHeight: 40,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    marginTop: spacing.xs,
    lineHeight: 18,
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
    fontWeight: '600',
    lineHeight: 18,
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
    fontWeight: '700',
    lineHeight: 28,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 16,
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
    lineHeight: 20,
  },
  menuSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  appearanceSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  appearanceTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  themePicker: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  themeOptionActive: {
    backgroundColor: colors.accent + '20',
  },
  themeOptionText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
  themeOptionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  currencySymbol: {
    color: colors.textMuted,
    fontSize: fontSize.lg,
    fontWeight: '600',
    lineHeight: 22,
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  biometricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  biometricIconActive: {
    backgroundColor: colors.accent + '20',
  },
  biometricLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  biometricDesc: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.accent,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textMuted,
  },
  toggleKnobActive: {
    backgroundColor: colors.background,
    alignSelf: 'flex-end',
  },
  statementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statementIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statementCard: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  statementDate: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  statementAmount: {
    color: colors.debit,
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  statementCount: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 16,
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
    lineHeight: 20,
  },
  aboutValue: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 20,
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
    fontWeight: '400',
    flex: 1,
    lineHeight: 18,
  },
});

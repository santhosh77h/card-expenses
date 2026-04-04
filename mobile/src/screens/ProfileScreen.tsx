import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import { spacing, borderRadius, fontSize, formatCurrency, formatDate, dateFormatForCurrency, CurrencyCode, CURRENCY_CONFIG, SUPPORTED_CURRENCIES } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, StatementData } from '../store';
import { ProgressBar } from '../components/ui';
import { presentPaywall } from '../utils/revenueCat';
import { signInAndAuthenticate, signOut as authSignOut, isAppleAuthAvailable } from '../utils/appleAuth';
import { refreshSubscriptionStatus, SUB_MONTHLY_PARSES, TRIAL_MAX_PARSES } from '../utils/licensing';
import Purchases from 'react-native-purchases';
let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  // Native module not available (e.g. Expo Go)
}
import type { RootStackParamList } from '../navigation';
import { capture, AnalyticsEvents } from '../utils/analytics';
import { getTotalTransactionCount } from '../db/transactions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function handleUpgradeFlow() {
  const store = useStore.getState();
  if (!store.isAuthenticated) {
    try {
      const available = await isAppleAuthAvailable();
      if (available) {
        const session = await signInAndAuthenticate();
        store._setAuthenticated(true, session.appleUserId);
      }
    } catch (e: any) {
      console.log('[ProfileScreen] Apple auth skipped:', e?.message);
    }
  }
  const purchased = await presentPaywall();
  if (purchased) {
    await refreshSubscriptionStatus();
    useStore.getState()._refreshLicenseInfo();
  }
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    cards, statements, manualTransactions, isPremium, isAuthenticated,
    licenseInfo, themeMode, setThemeMode, defaultCurrency, setDefaultCurrency,
    biometricLockEnabled, setBiometricLockEnabled,
  } = useStore();
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);

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
  const txnCount = useMemo(() => getTotalTransactionCount(), [statements, manualTransactions]);

  const allStatements = useMemo(() => {
    const result: (StatementData & { cardNickname: string; cardCurrency: CurrencyCode })[] = [];
    for (const card of cards) {
      const cardStatements = statements[card.id] || [];
      for (const stmt of cardStatements) {
        result.push({ ...stmt, cardNickname: card.nickname, cardCurrency: card.currency ?? defaultCurrency });
      }
    }
    result.sort((a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime());
    return result;
  }, [cards, statements]);

  // Subscription display helpers
  const parsesUsed = SUB_MONTHLY_PARSES - licenseInfo.subAllowanceRemaining;
  const usageProgress = parsesUsed / SUB_MONTHLY_PARSES;

  // Trial display helpers
  const trialMaxParses = licenseInfo.trialMaxParses || TRIAL_MAX_PARSES;
  const trialUsed = trialMaxParses - licenseInfo.trialRemaining;
  const trialProgress = trialUsed / trialMaxParses;
  const trialDaysLeft = useMemo(() => {
    if (!licenseInfo.trialExpiryDate) return null;
    const expiry = new Date(licenseInfo.trialExpiryDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [licenseInfo.trialExpiryDate]);

  const tierBadgeText = licenseInfo.tier === 'trial'
    ? 'Trial'
    : isPremium
      ? `Pro${licenseInfo.subPlanType === 'monthly' ? ' \u00B7 Monthly' : licenseInfo.subPlanType === 'yearly' ? ' \u00B7 Yearly' : ''}`
      : licenseInfo.creditBalance > 0
        ? 'Credits'
        : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={{ height: insets.top + 10 }} />

      {/* ================================================================ */}
      {/* HERO PROFILE CARD                                                */}
      {/* ================================================================ */}
      <View style={styles.heroCard}>
        {/* Top row: avatar + info + badge */}
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>V</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>Vector Account</Text>
            <Text style={styles.heroEmail}>Your Money. Directed.</Text>
          </View>
          {tierBadgeText && (
            <View style={styles.proBadge}>
              {isPremium && <Text style={styles.proBadgeStar}>{'\u2605'}</Text>}
              <Text style={styles.proBadgeText}>{tierBadgeText}</Text>
            </View>
          )}
        </View>

        {/* Stats row inside hero */}
        <View style={styles.heroDivider} />
        <View style={styles.heroStats}>
          <View style={styles.hstat}>
            <Text style={styles.hstatNum}>{cards.length}</Text>
            <Text style={styles.hstatLabel}>Cards</Text>
          </View>
          <View style={styles.hstatDivider} />
          <View style={styles.hstat}>
            <Text style={styles.hstatNum}>{statementCount}</Text>
            <Text style={styles.hstatLabel}>Statements</Text>
          </View>
          <View style={styles.hstatDivider} />
          <View style={styles.hstat}>
            <Text style={styles.hstatNum}>{txnCount}</Text>
            <Text style={styles.hstatLabel}>Transactions</Text>
          </View>
        </View>

        {/* Subscription / Usage area */}
        <View style={styles.heroDivider} />

        {licenseInfo.tier === 'trial' ? (
          /* ---- Trial ---- */
          <View>
            <View style={styles.trialHeader}>
              <View style={styles.trialBadge}>
                <Feather name="clock" size={10} color={colors.accent} />
                <Text style={styles.trialBadgeText}>FREE TRIAL</Text>
              </View>
              {trialDaysLeft !== null && (
                <Text style={styles.trialExpiry}>
                  {trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left` : 'Expires today'}
                </Text>
              )}
            </View>
            <View style={styles.trialStats}>
              <View style={styles.trialStat}>
                <Text style={styles.trialStatNum}>{licenseInfo.trialRemaining}</Text>
                <Text style={styles.trialStatLabel}>parses left</Text>
              </View>
              <View style={styles.trialStatDivider} />
              <View style={styles.trialStat}>
                <Text style={styles.trialStatNum}>{trialUsed}</Text>
                <Text style={styles.trialStatLabel}>used</Text>
              </View>
              <View style={styles.trialStatDivider} />
              <View style={styles.trialStat}>
                <Text style={styles.trialStatNum}>{trialMaxParses}</Text>
                <Text style={styles.trialStatLabel}>total</Text>
              </View>
            </View>
            <ProgressBar
              progress={trialProgress}
              height={4}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={styles.trialFooter}>
              {licenseInfo.trialRemaining} of {trialMaxParses} parses remaining
              {trialDaysLeft !== null && trialDaysLeft > 0 ? ` \u00B7 expires in ${trialDaysLeft}d` : ''}
            </Text>
          </View>
        ) : isPremium ? (
          /* ---- Active Subscription ---- */
          <View>
            <View style={styles.usageRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.usageTitle}>Monthly parses</Text>
                <Text style={styles.usageVal}>
                  <Text style={{ color: colors.accent }}>{parsesUsed}</Text> of {SUB_MONTHLY_PARSES} used
                </Text>
              </View>
              {licenseInfo.creditBalance > 0 && (
                <View style={styles.creditTag}>
                  <Text style={styles.creditTagText}>+{licenseInfo.creditBalance} credits</Text>
                </View>
              )}
            </View>
            <ProgressBar
              progress={usageProgress}
              height={4}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : (
          /* ---- No Subscription ---- */
          <View>
            <View style={styles.subscriptionBanner}>
              <Text style={styles.subscriptionTitle}>Get Vector Pro</Text>
              <Text style={styles.subscriptionDesc}>
                Monthly or Yearly plan {'\u00B7'} {SUB_MONTHLY_PARSES} parses/month {'\u00B7'} Full analytics
              </Text>
              <TouchableOpacity
                style={styles.subscribeCta}
                onPress={() => {
                  capture(AnalyticsEvents.UPGRADE_TAPPED, { source: 'profile_hero' });
                  handleUpgradeFlow();
                }}
                activeOpacity={0.7}
              >
                <Feather name="zap" size={14} color={colors.textOnAccent} />
                <Text style={styles.subscribeCtaText}>Subscribe</Text>
              </TouchableOpacity>
            </View>
            {licenseInfo.creditBalance > 0 && (
              <View style={styles.usageRow}>
                <Text style={styles.usageTitle}>Credits available</Text>
                <View style={styles.creditTag}>
                  <Text style={styles.creditTagText}>{licenseInfo.creditBalance} credits</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ================================================================ */}
      {/* TOOLS                                                            */}
      {/* ================================================================ */}
      <Text style={styles.sectionLabel}>Tools</Text>
      <View style={styles.surfaceCard}>
        <GroupedMenuItem
          icon="message-circle"
          title="Ask Vector"
          subtitle="Natural language queries"
          onPress={() => navigation.navigate('Ask')}
          colors={colors}
          styles={styles}
        />
        <View style={styles.itemDivider} />
        <GroupedMenuItem
          icon="credit-card"
          title="My Cards"
          subtitle={`${cards.length} card${cards.length !== 1 ? 's' : ''}`}
          onPress={() => navigation.navigate('CardList')}
          colors={colors}
          styles={styles}
        />
        <View style={styles.itemDivider} />
        <GroupedMenuItem
          icon="tag"
          title="Labels"
          subtitle="Group by trip or project"
          onPress={() => (navigation as any).navigate('Labels')}
          colors={colors}
          styles={styles}
        />
        <View style={styles.itemDivider} />
        <GroupedMenuItem
          icon="shopping-bag"
          title="Merchants"
          subtitle="Spending by merchant"
          onPress={() => (navigation as any).navigate('MerchantInsights')}
          colors={colors}
          styles={styles}
        />
      </View>

      {/* ================================================================ */}
      {/* ACCOUNT                                                          */}
      {/* ================================================================ */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.surfaceCard}>
        {(isPremium || licenseInfo.creditBalance > 0 || (licenseInfo.tier === 'none' && licenseInfo.trialExpired)) && (
          <>
            <GroupedMenuItem
              icon="star"
              title="Buy credits"
              subtitle={licenseInfo.creditBalance > 0 ? `${licenseInfo.creditBalance} remaining` : 'Top up your balance'}
              badge={licenseInfo.creditBalance > 0 ? String(licenseInfo.creditBalance) : undefined}
              onPress={() => navigation.navigate('CreditTopUp')}
              colors={colors}
              styles={styles}
            />
            <View style={styles.itemDivider} />
          </>
        )}
        {!isPremium && (
          <>
            <GroupedMenuItem
              icon="zap"
              title="Upgrade plan"
              subtitle="Unlimited uploads & analytics"
              onPress={() => {
                capture(AnalyticsEvents.UPGRADE_TAPPED, { source: 'profile_menu' });
                handleUpgradeFlow();
              }}
              colors={colors}
              styles={styles}
            />
            <View style={styles.itemDivider} />
          </>
        )}
        {biometricAvailable && (
          <>
            <TouchableOpacity style={styles.listItem} onPress={handleBiometricToggle} activeOpacity={0.7}>
              <View style={styles.iconBox}>
                <Feather name="lock" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Security & privacy</Text>
                <Text style={styles.itemSub}>Biometrics, data controls</Text>
              </View>
              <View style={[styles.toggle, biometricLockEnabled && styles.toggleActive]}>
                <View style={[styles.toggleKnob, biometricLockEnabled && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
            <View style={styles.itemDivider} />
          </>
        )}
        {isAuthenticated ? (
          <>
            <View style={styles.listItem}>
              <View style={styles.iconBox}>
                <Feather name="check-circle" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Signed in</Text>
                <Text style={styles.itemSub}>Apple ID linked</Text>
              </View>
            </View>
            <View style={styles.itemDivider} />
            <GroupedMenuItem
              icon="refresh-cw"
              title="Restore purchases"
              subtitle="Recover subscriptions from another device"
              onPress={async () => {
                try {
                  await Purchases.restorePurchases();
                  await refreshSubscriptionStatus();
                  useStore.getState()._refreshLicenseInfo();
                  Alert.alert('Restored', 'Purchases have been restored.');
                } catch {
                  Alert.alert('Error', 'Could not restore purchases. Please try again.');
                }
              }}
              colors={colors}
              styles={styles}
            />
            <View style={styles.itemDivider} />
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      await authSignOut();
                      useStore.getState()._setAuthenticated(false, null);
                    },
                  },
                ]);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Feather name="log-out" size={18} color={colors.debit} />
              </View>
              <Text style={[styles.itemTitle, { color: colors.debit }]}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <GroupedMenuItem
            icon="user"
            title="Sign in with Apple"
            subtitle="Sync subscription across devices"
            onPress={async () => {
              try {
                const session = await signInAndAuthenticate();
                useStore.getState()._setAuthenticated(true, session.appleUserId);
                await refreshSubscriptionStatus();
                useStore.getState()._refreshLicenseInfo();
              } catch (e: any) {
                if (!e?.message?.includes('canceled') && !e?.message?.includes('cancelled')) {
                  Alert.alert('Sign In Failed', e?.message || 'Please try again.');
                }
              }
            }}
            colors={colors}
            styles={styles}
          />
        )}
      </View>

      {/* ================================================================ */}
      {/* PREFERENCES                                                      */}
      {/* ================================================================ */}
      <Text style={styles.sectionLabel}>Preferences</Text>
      <View style={styles.surfaceCard}>
        <View style={styles.pickerSection}>
          <Text style={styles.pickerLabel}>Appearance</Text>
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
                  <Feather name={icon} size={14} color={isActive ? colors.accent : colors.textMuted} />
                  <Text style={[styles.themeOptionText, isActive && { color: colors.accent, fontWeight: '600' }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.itemDividerFull} />
        <View style={styles.pickerSection}>
          <Text style={styles.pickerLabel}>Currency</Text>
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
                  <Text style={[styles.currencySymbol, isActive && { color: colors.accent }]}>
                    {CURRENCY_CONFIG[code].symbol}
                  </Text>
                  <Text style={[styles.themeOptionText, isActive && { color: colors.accent, fontWeight: '600' }]}>
                    {code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* ================================================================ */}
      {/* DATA                                                             */}
      {/* ================================================================ */}
      <Text style={styles.sectionLabel}>Data</Text>
      <View style={styles.surfaceCard}>
        <GroupedMenuItem
          icon="upload"
          title="Backup & export"
          subtitle="Encrypted JSON, CSV"
          onPress={() => navigation.navigate('Backup')}
          colors={colors}
          styles={styles}
        />
        <View style={styles.itemDivider} />
        <GroupedMenuItem
          icon="clock"
          title="Demo mode"
          subtitle="Try with sample data"
          onPress={() => navigation.navigate('Upload' as any)}
          colors={colors}
          styles={styles}
        />
      </View>

      {/* ================================================================ */}
      {/* RECENT STATEMENTS                                                */}
      {/* ================================================================ */}
      {allStatements.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Recent statements</Text>
          <View style={styles.surfaceCard}>
            {allStatements.slice(0, 5).map((stmt, idx) => (
              <React.Fragment key={stmt.id}>
                {idx > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity
                  style={styles.statementItem}
                  onPress={() => navigation.navigate('Analysis', { statementId: stmt.id, cardId: stmt.cardId })}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconBox}>
                    <Feather name="file-text" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{stmt.cardNickname}</Text>
                    <Text style={styles.itemSub}>
                      {formatDate(stmt.summary.statement_period.from ?? '', stmt.dateFormat ?? dateFormatForCurrency(stmt.cardCurrency))} to{' '}
                      {formatDate(stmt.summary.statement_period.to ?? '', stmt.dateFormat ?? dateFormatForCurrency(stmt.cardCurrency))}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginRight: spacing.xs }}>
                    <Text style={[styles.itemTitle, { color: colors.debit }]}>
                      {formatCurrency(stmt.summary.net, stmt.cardCurrency)}
                    </Text>
                    <Text style={styles.itemSub}>{stmt.summary.total_transactions} txns</Text>
                  </View>
                  <Text style={styles.chevron}>{'\u203A'}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </>
      )}

      {/* ================================================================ */}
      {/* ABOUT — plain list, lowest visual weight                         */}
      {/* ================================================================ */}
      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.surfaceCard}>
        <View style={styles.aboutList}>
          <TouchableOpacity
            style={styles.aboutItem}
            onPress={() => navigation.navigate('Feedback')}
            activeOpacity={0.7}
          >
            <Text style={styles.aboutLabel}>Help & feedback</Text>
            <Text style={styles.aboutChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.aboutItem}
            onPress={() => navigation.navigate('WebViewPage', { url: 'https://vectorexpense.com/privacy', title: 'Privacy Policy' })}
            activeOpacity={0.7}
          >
            <Text style={styles.aboutLabel}>Privacy policy</Text>
            <Text style={styles.aboutChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.aboutItem}
            onPress={() => navigation.navigate('WebViewPage', { url: 'https://vectorexpense.com/terms', title: 'Terms of Use' })}
            activeOpacity={0.7}
          >
            <Text style={styles.aboutLabel}>Terms of use</Text>
            <Text style={styles.aboutChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
          <View style={[styles.aboutItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutVal}>{APP_VERSION}</Text>
          </View>
        </View>
      </View>

      {/* Footer tagline */}
      <Text style={styles.footerTagline}>Your Money. Directed.</Text>

      <View style={{ height: insets.bottom + 40 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Grouped menu item
// ---------------------------------------------------------------------------

function GroupedMenuItem({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  colors,
  styles,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconBox}>
        <Feather name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSub}>{subtitle}</Text>
      </View>
      {badge && (
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>{badge}</Text>
        </View>
      )}
      <Text style={styles.chevron}>{'\u203A'}</Text>
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

  // Hero card
  heroCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.accent,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  proBadgeStar: {
    fontSize: 10,
    color: colors.accent,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.3,
  },
  heroDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
  },
  heroStats: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  hstat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  hstatNum: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accent,
    lineHeight: 24,
    marginBottom: 2,
  },
  hstatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  hstatDivider: {
    width: 0.5,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  // Trial section
  trialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  trialBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  trialExpiry: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  trialStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trialStat: {
    flex: 1,
    alignItems: 'center',
  },
  trialStatNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    lineHeight: 22,
  },
  trialStatLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trialStatDivider: {
    width: 0.5,
    height: 24,
    backgroundColor: colors.border,
  },
  trialFooter: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Usage / subscription
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usageTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  usageVal: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  creditTag: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  creditTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.accent,
  },

  // Subscription banner (no-plan state)
  subscriptionBanner: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  subscriptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subscriptionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  subscribeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
  },
  subscribeCtaText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textOnAccent,
  },

  // Section label — MD3 sentence case
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    letterSpacing: 0.1,
  },

  // Grouped surface card
  surfaceCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  // List item inside grouped card
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    height: 56,
  },
  statementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 14,
    minHeight: 68,
    paddingVertical: spacing.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 1,
  },
  itemSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 16,
    color: colors.textMuted,
    marginLeft: 2,
  },
  itemDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 54,
    marginRight: 14,
  },
  itemDividerFull: {
    height: 0.5,
    backgroundColor: colors.border,
  },

  // Badge pill
  badgePill: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },

  // Picker sections (appearance / currency)
  pickerSection: {
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  themePicker: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
  },
  themeOptionActive: {
    backgroundColor: colors.accent + '20',
  },
  themeOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  currencySymbol: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },

  // Toggle
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

  // About — plain list, lowest weight
  aboutList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  aboutLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  aboutVal: {
    fontSize: 12,
    color: colors.textMuted,
  },
  aboutChevron: {
    fontSize: 14,
    color: colors.textMuted,
  },

  // Footer
  footerTagline: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.textMuted,
    paddingVertical: spacing.md,
  },
});

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius, fontSize } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore } from '../store';
import { presentCreditPaywall } from '../utils/revenueCat';
import { refreshSubscriptionStatus } from '../utils/licensing';
import { signInAndAuthenticate, isAppleAuthAvailable, getAccessToken } from '../utils/appleAuth';
import { capture, AnalyticsEvents } from '../utils/analytics';
import { API_URL, VECTOR_API_KEY } from '../utils/constants';
import { signRequest } from '../utils/hmac';

interface CreditPurchase {
  type: string;
  amount: number;
  product_id: string | null;
  at: string;
}

export default function CreditTopUpScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { licenseInfo, isAuthenticated } = useStore();

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [history, setHistory] = useState<CreditPurchase[]>([]);
  const [balance, setBalance] = useState(licenseInfo.creditBalance);

  const fetchCredits = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Vector-API-Key': VECTOR_API_KEY,
          ...signRequest('/api/credits'),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance ?? 0);
        setHistory(data.history ?? []);
      }
    } catch {
      // Non-fatal — show cached balance
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    capture(AnalyticsEvents.CREDIT_STORE_OPENED, { source: 'screen' });
    fetchCredits();
  }, [fetchCredits]);

  const ensureSignedIn = async (): Promise<boolean> => {
    if (isAuthenticated) return true;
    try {
      const available = await isAppleAuthAvailable();
      if (!available) return false;
      const session = await signInAndAuthenticate();
      useStore.getState()._setAuthenticated(true, session.appleUserId);
      return true;
    } catch {
      return false;
    }
  };

  const handlePurchase = async () => {
    if (purchasing) return;

    const signedIn = await ensureSignedIn();
    if (!signedIn) return;

    setPurchasing(true);
    try {
      const credits = await presentCreditPaywall();
      if (credits > 0) {
        await refreshSubscriptionStatus();
        useStore.getState()._refreshLicenseInfo();
        await fetchCredits();
      }
    } finally {
      setPurchasing(false);
    }
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  const productLabel = (productId: string | null, amount: number): string => {
    if (productId?.includes('100')) return `${amount} credits ($99.99)`;
    if (productId?.includes('10')) return `${amount} credits ($9.99)`;
    return `${amount} credits`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Credits</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Credits</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
        <Text style={styles.balanceUnit}>
          credit{balance !== 1 ? 's' : ''} remaining
        </Text>
        {licenseInfo.subscriptionActive && (
          <View style={styles.subInfoRow}>
            <Feather name="check-circle" size={12} color={colors.accent} />
            <Text style={styles.subInfoText}>
              {licenseInfo.subAllowanceRemaining} of 4 subscription parses this month
            </Text>
          </View>
        )}
      </View>

      {/* Buy button */}
      <View style={styles.buySection}>
        <TouchableOpacity
          style={[styles.buyBtn, purchasing && styles.buyBtnDisabled]}
          onPress={handlePurchase}
          activeOpacity={0.8}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : (
            <>
              <Feather name="plus" size={16} color={colors.textOnAccent} style={{ marginRight: spacing.sm }} />
              <Text style={styles.buyBtnText}>Buy More Credits</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.buyHint}>1 credit = 1 statement parse</Text>
      </View>

      {/* Purchase history */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Purchase History</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textMuted} style={{ marginTop: spacing.xl }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={24} color={colors.textMuted} />
            <Text style={styles.emptyText}>No purchases yet</Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(_, i) => String(i)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.historyRow}>
                <View style={styles.historyIcon}>
                  <Feather name="plus-circle" size={16} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>
                    {productLabel(item.product_id, item.amount)}
                  </Text>
                  <Text style={styles.historyDate}>{formatDate(item.at)}</Text>
                </View>
                <Text style={styles.historyAmount}>+{item.amount}</Text>
              </View>
            )}
          />
        )}
      </View>

      <View style={{ height: insets.bottom + 20 }} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      lineHeight: 24,
    },
    balanceCard: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
    },
    balanceLabel: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      lineHeight: 16,
    },
    balanceValue: {
      color: colors.accent,
      fontSize: 48,
      fontWeight: '700',
      marginTop: spacing.xs,
      lineHeight: 56,
    },
    balanceUnit: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    subInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceElevated,
      paddingHorizontal: spacing.xl,
    },
    subInfoText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    buySection: {
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xl,
      alignItems: 'center',
    },
    buyBtn: {
      flexDirection: 'row',
      backgroundColor: colors.accent,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: 50,
    },
    buyBtnDisabled: {
      opacity: 0.7,
    },
    buyBtnText: {
      color: colors.textOnAccent,
      fontSize: fontSize.md,
      fontWeight: '700',
      lineHeight: 20,
    },
    buyHint: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
      lineHeight: 16,
    },
    historySection: {
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xxl,
      flex: 1,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      lineHeight: 16,
      marginBottom: spacing.md,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      lineHeight: 20,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
    },
    historyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    historyTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      lineHeight: 20,
    },
    historyDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      lineHeight: 16,
    },
    historyAmount: {
      color: colors.accent,
      fontSize: fontSize.lg,
      fontWeight: '700',
      lineHeight: 22,
    },
  });

import './src/utils/cryptoPolyfill';
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image, AppState as RNAppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initDatabase } from './src/db';
import { useStore } from './src/store';
import { initRevenueCat, addSubscriptionListener, diagnoseRevenueCat, logInToRevenueCat } from './src/utils/revenueCat';
import { refreshSubscriptionStatus } from './src/utils/licensing';
import { restoreSession } from './src/utils/appleAuth';
import { configureNotifications, rescheduleAll } from './src/utils/notifications';
import { useIsDark } from './src/hooks/useColors';
import BiometricLockScreen from './src/components/BiometricLockScreen';
import { biometricGuard } from './src/utils/biometricGuard';
import { darkColors, fontSize, spacing } from './src/theme';

configureNotifications();

function AppContent() {
  const isDark = useIsDark();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Navigation />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const bootedRef = useRef(false);
  const listenerRef = useRef<(() => void) | undefined>();
  const appStateRef = useRef(RNAppState.currentState);

  const handleUnlock = useCallback(() => setLocked(false), []);

  // Re-lock when app returns from background (skip if biometric guard is suppressed, e.g. document picker)
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current === 'background' &&
        nextState === 'active' &&
        useStore.getState().biometricLockEnabled &&
        !biometricGuard.isSuppressed()
      ) {
        setLocked(true);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const boot = async () => {
      if (bootedRef.current) return;
      bootedRef.current = true;

      try {
        await initDatabase();
        useStore.getState()._hydrateSqlite();
      } catch (e: any) {
        setDbError(e?.message || 'Failed to initialize database.');
        return;
      }

      try {
        const isPremium = await initRevenueCat();
        useStore.getState()._setIsPremium(isPremium);
        if (__DEV__) diagnoseRevenueCat();
      } catch {
        // RevenueCat failure is non-fatal — defaults to free tier
      }

      // Restore auth session (Apple Sign In)
      try {
        const session = await restoreSession();
        if (session) {
          useStore.getState()._setAuthenticated(true, session.appleUserId);
          await logInToRevenueCat(session.appleUserId);
        }
      } catch {
        // Auth restore failure is non-fatal
      }

      // Licensing boot sequence
      try {
        await refreshSubscriptionStatus();
        useStore.getState()._refreshLicenseInfo();
      } catch {
        // Licensing failure is non-fatal
      }

      listenerRef.current = addSubscriptionListener((isPremium) => {
        useStore.getState()._setIsPremium(isPremium);
        // Refresh license state when subscription changes
        refreshSubscriptionStatus()
          .then(() => useStore.getState()._refreshLicenseInfo())
          .catch(() => {});
      });

      // Reschedule notifications (non-blocking)
      const state = useStore.getState();
      rescheduleAll(state.cards, state.globalReminderDay).catch(() => {});

      // Lock if biometric is enabled
      if (state.biometricLockEnabled) {
        setLocked(true);
      }

      setDbReady(true);
    };

    if (useStore.persist.hasHydrated()) {
      boot();
    } else {
      const unsub = useStore.persist.onFinishHydration(() => {
        boot();
        unsub();
      });
    }

    return () => {
      listenerRef.current?.();
    };
  }, []);

  if (dbError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Database Error</Text>
        <Text style={styles.errorMessage}>{dbError}</Text>
        <Text
          style={styles.retryButton}
          onPress={() => {
            setDbError(null);
            bootedRef.current = false;
            setDbReady(false);
          }}
        >
          Tap to Retry
        </Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('./assets/icon.png')}
          style={styles.splashLogo}
        />
        <Text style={styles.brandTitle}>VECTOR</Text>
        <Text style={styles.brandTagline}>Your Money. Directed.</Text>
        <ActivityIndicator size="small" color={darkColors.accent} style={{ marginTop: spacing.xxl }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppContent />
      {locked && <BiometricLockScreen onUnlock={handleUnlock} />}
    </View>
  );
}

// Splash/loading/error screens always use dark theme (brand identity, renders before preference loads)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: darkColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: spacing.xxl,
  },
  brandTitle: {
    color: darkColors.textPrimary,
    fontSize: fontSize.hero,
    fontWeight: '800',
    letterSpacing: 4,
  },
  brandTagline: {
    color: darkColors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '400',
    marginTop: spacing.sm,
    letterSpacing: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: darkColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    color: darkColors.debit,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  errorMessage: {
    color: darkColors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  retryButton: {
    color: darkColors.accent,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});

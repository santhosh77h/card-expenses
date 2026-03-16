import './src/utils/cryptoPolyfill';
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initDatabase } from './src/db';
import { useStore } from './src/store';
import { initRevenueCat, addSubscriptionListener } from './src/utils/revenueCat';
import { configureNotifications, rescheduleAll } from './src/utils/notifications';
import { useIsDark } from './src/hooks/useColors';
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
  const bootedRef = useRef(false);
  const listenerRef = useRef<(() => void) | undefined>();

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
      } catch {
        // RevenueCat failure is non-fatal — defaults to free tier
      }

      listenerRef.current = addSubscriptionListener((isPremium) => {
        useStore.getState()._setIsPremium(isPremium);
      });

      // Reschedule notifications (non-blocking)
      const state = useStore.getState();
      rescheduleAll(state.cards, state.globalReminderDay).catch(() => {});

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
        <Text style={styles.brandTitle}>VECTOR</Text>
        <ActivityIndicator size="small" color={darkColors.accent} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  return <AppContent />;
}

// Splash/loading/error screens always use dark theme (brand identity, renders before preference loads)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: darkColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: darkColors.textPrimary,
    fontSize: fontSize.hero,
    fontWeight: '800',
    letterSpacing: 4,
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

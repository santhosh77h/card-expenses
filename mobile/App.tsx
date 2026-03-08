import './src/utils/cryptoPolyfill';
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Navigation from './src/navigation';
import { initDatabase } from './src/db';
import { useStore } from './src/store';
import { initRevenueCat, addSubscriptionListener } from './src/utils/revenueCat';

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    const boot = async () => {
      await initDatabase();
      const state = useStore.getState();
      state._hydrateSqlite();

      try {
        const isPremium = await initRevenueCat();
        useStore.getState()._setIsPremium(isPremium);
      } catch {
        // RevenueCat failure is non-fatal — defaults to free tier
      }

      removeListener = addSubscriptionListener((isPremium) => {
        useStore.getState()._setIsPremium(isPremium);
      });

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
      removeListener?.();
    };
  }, []);

  if (!dbReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Navigation />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

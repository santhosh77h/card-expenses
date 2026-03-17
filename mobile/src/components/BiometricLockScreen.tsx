import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { darkColors, fontSize, spacing } from '../theme';

let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  // Native module not available (e.g. Expo Go)
}

interface Props {
  onUnlock: () => void;
}

export default function BiometricLockScreen({ onUnlock }: Props) {
  const authenticate = useCallback(async () => {
    if (!LocalAuthentication) { onUnlock(); return; }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Vector',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    if (result.success) {
      onUnlock();
    }
  }, [onUnlock]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>VECTOR</Text>
      <Text style={styles.tagline}>Your Money. Directed.</Text>

      <TouchableOpacity style={styles.unlockBtn} onPress={authenticate} activeOpacity={0.7}>
        <View style={styles.iconCircle}>
          <Feather name="lock" size={28} color={darkColors.accent} />
        </View>
        <Text style={styles.unlockText}>Tap to unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 9999,
  },
  brand: {
    color: darkColors.textPrimary,
    fontSize: fontSize.hero,
    fontWeight: '800',
    letterSpacing: 4,
  },
  tagline: {
    color: darkColors.textSecondary,
    fontSize: fontSize.sm,
    letterSpacing: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.xxxl,
  },
  unlockBtn: {
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: darkColors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: darkColors.accent + '40',
  },
  unlockText: {
    color: darkColors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});

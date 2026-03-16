import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from '../theme';
import { useStore } from '../store';

/**
 * Returns the active color palette based on the user's theme preference.
 */
export function useColors(): ThemeColors {
  const themeMode = useStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  return useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'light' ? lightColors : darkColors;
    }
    return themeMode === 'light' ? lightColors : darkColors;
  }, [themeMode, systemScheme]);
}

/**
 * Returns true when the resolved theme is dark.
 */
export function useIsDark(): boolean {
  const themeMode = useStore((s) => s.themeMode);
  const systemScheme = useColorScheme();

  return useMemo(() => {
    if (themeMode === 'system') return systemScheme !== 'light';
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);
}

/**
 * Non-hook sync getter for class components (e.g. ErrorBoundary).
 * Reads directly from the store — cannot react to system scheme changes.
 */
export function getColors(): ThemeColors {
  const themeMode = useStore.getState().themeMode;
  if (themeMode === 'light') return lightColors;
  return darkColors;
}

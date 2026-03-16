import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useColors } from '../hooks/useColors';
import type { ThemeColors } from '../theme';
import BackupView from '../components/BackupView';

export default function BackupScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackupView />
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme';
import BackupView from '../components/BackupView';

export default function BackupScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <BackupView />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

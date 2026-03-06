import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, borderRadius, fontSize } from '../theme';
import { useStore, StatementData } from '../store';
import { parseStatement, parseDemoStatement } from '../utils/api';
import { Badge, Card, PrimaryButton } from '../components/ui';
import type { RootStackParamList } from '../navigation';

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error';

export default function UploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { cards, activeCardId, addStatement } = useStore();
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>(
    activeCardId || cards[0]?.id || ''
  );

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setState('uploading');
      setError('');

      try {
        setState('parsing');
        const parsed = await parseStatement(file.uri, file.name);
        saveAndNavigate(parsed);
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to parse statement.';
        setState('error');
        setError(msg);
      }
    } catch {
      setState('error');
      setError('Could not open file picker.');
    }
  };

  const handleDemo = () => {
    setState('parsing');
    setError('');

    // Small delay to show parsing state
    setTimeout(() => {
      try {
        const parsed = parseDemoStatement();
        saveAndNavigate(parsed);
      } catch {
        setState('error');
        setError('Demo failed unexpectedly.');
      }
    }, 800);
  };

  const saveAndNavigate = (parsed: any) => {
    const cardId = selectedCardId || 'demo';
    const statement: StatementData = {
      id: Date.now().toString(),
      cardId,
      parsedAt: new Date().toISOString(),
      transactions: parsed.transactions,
      summary: parsed.summary,
      csv: parsed.csv,
      bankDetected: parsed.bank_detected,
    };

    addStatement(cardId, statement);
    setState('done');

    navigation.navigate('Analysis', {
      statementId: statement.id,
      cardId,
    });

    // Reset after navigation
    setTimeout(() => setState('idle'), 500);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Upload Statement</Text>
        <Text style={styles.subtitle}>Parse your credit card PDF statement</Text>
      </View>

      {/* Privacy badge */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
        <Badge text="Your PDF is processed in memory and never stored" color={colors.accent} />
      </View>

      {/* Card selector */}
      {cards.length > 1 && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text style={styles.label}>Select Card</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.sm }}
          >
            {cards.map((card) => (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.cardChip,
                  selectedCardId === card.id && styles.cardChipActive,
                ]}
                onPress={() => setSelectedCardId(card.id)}
              >
                <Text
                  style={[
                    styles.cardChipText,
                    selectedCardId === card.id && styles.cardChipTextActive,
                  ]}
                >
                  {card.nickname} (*{card.last4})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Upload area */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <TouchableOpacity
          style={[
            styles.uploadArea,
            state === 'error' && { borderColor: colors.debit },
            (state === 'uploading' || state === 'parsing') && { borderColor: colors.accent },
          ]}
          onPress={state === 'idle' || state === 'error' ? handlePick : undefined}
          activeOpacity={0.8}
          disabled={state === 'uploading' || state === 'parsing'}
        >
          {state === 'idle' && (
            <>
              <Feather name="upload-cloud" size={48} color={colors.textMuted} />
              <Text style={styles.uploadTitle}>Tap to Upload PDF</Text>
              <Text style={styles.uploadSubtitle}>
                Select your credit card statement (max 10 MB)
              </Text>
            </>
          )}
          {(state === 'uploading' || state === 'parsing') && (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.uploadTitle, { color: colors.accent }]}>
                {state === 'uploading' ? 'Uploading...' : 'Parsing Statement...'}
              </Text>
              <Text style={styles.uploadSubtitle}>
                Your data is being processed securely
              </Text>
            </>
          )}
          {state === 'done' && (
            <>
              <Feather name="check-circle" size={48} color={colors.accent} />
              <Text style={[styles.uploadTitle, { color: colors.accent }]}>
                Done!
              </Text>
            </>
          )}
          {state === 'error' && (
            <>
              <Feather name="alert-circle" size={48} color={colors.debit} />
              <Text style={[styles.uploadTitle, { color: colors.debit }]}>
                Upload Failed
              </Text>
              <Text style={styles.uploadSubtitle}>{error}</Text>
              <Text style={[styles.uploadSubtitle, { color: colors.accent, marginTop: spacing.sm }]}>
                Tap to try again
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Demo button */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <PrimaryButton
          title="Try Demo"
          icon="play"
          variant="outline"
          onPress={handleDemo}
          disabled={state === 'uploading' || state === 'parsing'}
        />
      </View>

      {/* Privacy info */}
      <View style={{ padding: spacing.lg, marginTop: spacing.lg }}>
        <Card>
          <View style={styles.privacyRow}>
            <Feather name="shield" size={20} color={colors.accent} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.privacyTitle}>Privacy First</Text>
              <Text style={styles.privacyText}>
                Your PDF is parsed in-memory on our server and immediately discarded.
                No financial data is ever stored, logged, or shared.
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xxxl,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cardChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.sm,
  },
  cardChipActive: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cardChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cardChipTextActive: {
    color: colors.accent,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  uploadTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  uploadSubtitle: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  privacyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  privacyText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
});

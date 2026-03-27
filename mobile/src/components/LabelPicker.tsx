/**
 * LabelPicker — multi-select label chip bar with inline quick-create.
 *
 * Usage:
 *   <LabelPicker selectedIds={['id1']} onChange={(ids) => ...} />
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Label } from '../store';

// Predefined palette for new labels
const LABEL_COLORS = [
  '#FF6B6B', '#F472B6', '#A78BFA', '#818CF8',
  '#22D3EE', '#34D399', '#4ADE80', '#FBBF24',
  '#FFB547', '#60A5FA', '#94A3B8', '#E879F9',
];

const LABEL_ICONS: (keyof typeof Feather.glyphMap)[] = [
  'tag', 'briefcase', 'map-pin', 'globe', 'gift',
  'heart', 'home', 'coffee', 'sun', 'zap',
  'users', 'flag', 'folder', 'bookmark', 'star',
  'truck',
];

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function LabelPicker({ selectedIds, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { labels, addLabel } = useStore();
  const [showCreate, setShowCreate] = useState(false);

  const toggle = useCallback(
    (labelId: string) => {
      if (selectedIds.includes(labelId)) {
        onChange(selectedIds.filter((id) => id !== labelId));
      } else {
        onChange([...selectedIds, labelId]);
      }
    },
    [selectedIds, onChange],
  );

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
        {labels.map((label) => {
          const selected = selectedIds.includes(label.id);
          return (
            <TouchableOpacity
              key={label.id}
              style={[
                styles.chip,
                selected && { backgroundColor: label.color + '20', borderColor: label.color },
              ]}
              onPress={() => toggle(label.id)}
            >
              <Feather
                name={label.icon as keyof typeof Feather.glyphMap}
                size={12}
                color={selected ? label.color : colors.textMuted}
              />
              <Text
                style={[
                  styles.chipText,
                  selected && { color: label.color },
                ]}
                numberOfLines={1}
              >
                {label.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Quick-create button */}
        <TouchableOpacity style={styles.addChip} onPress={() => setShowCreate(true)}>
          <Feather name="plus" size={14} color={colors.accent} />
          <Text style={styles.addChipText}>New</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Inline create modal */}
      <CreateLabelModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(label) => {
          addLabel(label);
          onChange([...selectedIds, label.id]);
          setShowCreate(false);
        }}
        colors={colors}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Create Label Modal
// ---------------------------------------------------------------------------

function CreateLabelModal({
  visible,
  onClose,
  onCreated,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (label: Label) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createModalStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(LABEL_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState<string>(LABEL_ICONS[0]);

  const canSave = name.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onCreated({
      id: Date.now().toString(),
      name: name.trim(),
      color: selectedColor,
      icon: selectedIcon,
      createdAt: new Date().toISOString(),
    });
    setName('');
    setSelectedColor(LABEL_COLORS[0]);
    setSelectedIcon(LABEL_ICONS[0]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          <Text style={styles.title}>New Label</Text>

          {/* Name input */}
          <TextInput
            style={styles.input}
            placeholder="e.g. London Office Visit"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Color picker */}
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorGrid}>
            {LABEL_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorSwatchActive,
                ]}
                onPress={() => setSelectedColor(c)}
              >
                {selectedColor === c && (
                  <Feather name="check" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Icon picker */}
          <Text style={styles.label}>Icon</Text>
          <View style={styles.iconGrid}>
            {LABEL_ICONS.map((ic) => (
              <TouchableOpacity
                key={ic}
                style={[
                  styles.iconBtn,
                  selectedIcon === ic && { backgroundColor: selectedColor + '20', borderColor: selectedColor },
                ]}
                onPress={() => setSelectedIcon(ic)}
              >
                <Feather
                  name={ic}
                  size={18}
                  color={selectedIcon === ic ? selectedColor : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          <View style={styles.previewRow}>
            <View style={[styles.previewChip, { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}>
              <Feather name={selectedIcon as keyof typeof Feather.glyphMap} size={12} color={selectedColor} />
              <Text style={[styles.previewChipText, { color: selectedColor }]}>
                {name.trim() || 'Label'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles — chip bar
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      marginTop: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: spacing.sm,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.accent,
      borderStyle: 'dashed',
    },
    addChipText: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
  });

// ---------------------------------------------------------------------------
// Styles — create modal
// ---------------------------------------------------------------------------

const createModalStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      paddingBottom: 40,
    },
    handleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      marginBottom: spacing.lg,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    colorSwatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchActive: {
      borderWidth: 3,
      borderColor: '#fff',
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewRow: {
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    previewChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    previewChipText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.accent,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  });

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
import { LABEL_COLORS, LABEL_ICONS, LABEL_ICON_SECTIONS } from '../constants/labels';

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
  const [inputFocused, setInputFocused] = useState(false);

  const canSave = name.trim().length > 0;

  function handleDone() {
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

          {/* Sheet nav bar: Cancel | Title | Done */}
          <View style={styles.sheetNav}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.sheetNavCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.sheetNavTitle}>New Label</Text>
            <TouchableOpacity
              onPress={handleDone}
              disabled={!canSave}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.sheetNavDone, !canSave && { opacity: 0.35 }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Live preview — pinned below nav bar */}
          <View style={styles.previewRow}>
            <View style={[styles.previewChip, { backgroundColor: selectedColor + '18', borderColor: selectedColor }]}>
              <Feather name={selectedIcon as keyof typeof Feather.glyphMap} size={14} color={selectedColor} />
              <Text style={[styles.previewChipText, { color: selectedColor }]}>
                {name.trim() || 'Label'}
              </Text>
            </View>
          </View>

          {/* Scrollable form */}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name input with icon + clear */}
            <View style={[styles.inputWrapper, inputFocused && styles.inputWrapperFocused]}>
              <Feather name="tag" size={16} color={inputFocused ? colors.accent : colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="e.g. USA Trip"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleDone}
              />
              {name.length > 0 && (
                <TouchableOpacity onPress={() => setName('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Color — 6-column grid, double-ring selection */}
            <Text style={styles.sectionLabel}>COLOR</Text>
            <View style={styles.colorGrid}>
              {LABEL_COLORS.map((c) => {
                const isSelected = selectedColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatchOuter, isSelected && { borderColor: c }]}
                    onPress={() => setSelectedColor(c)}
                  >
                    <View style={[styles.colorSwatchInner, { backgroundColor: c }]}>
                      {isSelected && <Feather name="check" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Icons — grouped semantically */}
            <Text style={styles.sectionLabel}>ICON</Text>
            {LABEL_ICON_SECTIONS.map((section) => (
              <View key={section.title}>
                <Text style={styles.iconSectionTitle}>{section.title.toUpperCase()}</Text>
                <View style={styles.iconGrid}>
                  {section.icons.map((ic) => (
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
              </View>
            ))}

            <View style={{ height: spacing.xxl }} />
          </ScrollView>
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
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      maxHeight: '85%',
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted + '60',
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    // Sheet nav bar — Cancel | Title | Done
    sheetNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    sheetNavCancel: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    sheetNavTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetNavDone: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    // Live preview — pinned below nav bar
    previewRow: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
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
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    // Input
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    inputWrapperFocused: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '08',
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      paddingVertical: spacing.md,
    },
    // Section labels
    sectionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    // Color grid — 6-column, double-ring at 5.5px
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    colorSwatchOuter: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 3,
      borderColor: 'transparent',
      padding: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchInner: {
      width: '100%',
      height: '100%',
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Icon sections
    iconSectionTitle: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xs,
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
  });

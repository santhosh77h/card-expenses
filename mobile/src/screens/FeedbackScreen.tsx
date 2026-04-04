import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { spacing, borderRadius, fontSize } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { API_URL } from '../utils/constants';
import { capture, AnalyticsEvents } from '../utils/analytics';

const SUBJECTS = [
  { key: 'feedback', label: 'Feedback', icon: 'thumbs-up' as const },
  { key: 'bugReport', label: 'Bug report', icon: 'alert-circle' as const },
  { key: 'featureRequest', label: 'Feature request', icon: 'star' as const },
  { key: 'generalQuery', label: 'General query', icon: 'help-circle' as const },
  { key: 'other', label: 'Other', icon: 'more-horizontal' as const },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function FeedbackScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('feedback');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email';
    if (!message.trim()) errs.message = 'Message is required';
    else if (message.trim().length < 10) errs.message = 'At least 10 characters';
    return errs;
  }, [name, email, message]);

  const handleSubmit = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStatus('submitting');
    try {
      await axios.post(`${API_URL}/api/contact`, {
        name: name.trim(),
        email: email.trim(),
        subject,
        message: message.trim(),
      });
      setStatus('success');
      capture('contact_form_submit', { subject });
    } catch {
      setStatus('error');
    }
  }, [name, email, subject, message, validate]);

  const handleReset = () => {
    setName('');
    setEmail('');
    setSubject('feedback');
    setMessage('');
    setErrors({});
    setStatus('idle');
  };

  // Success state
  if (status === 'success') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.successIcon}>
          <Feather name="check-circle" size={48} color={colors.accent} />
        </View>
        <Text style={styles.successTitle}>Message sent</Text>
        <Text style={styles.successDesc}>
          Thanks for reaching out. We'll get back to you soon.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.primaryBtnText}>Send another</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.secondaryBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.errorIcon}>
          <Feather name="alert-circle" size={48} color={colors.debit} />
        </View>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.successDesc}>
          Could not send your message. Please try again.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setStatus('idle')} activeOpacity={0.7}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Subject picker */}
        <Text style={styles.sectionLabel}>Topic</Text>
        <View style={styles.surfaceCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectRow}>
            {SUBJECTS.map((s) => {
              const isActive = subject === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.subjectChip, isActive && styles.subjectChipActive]}
                  onPress={() => setSubject(s.key)}
                  activeOpacity={0.7}
                >
                  <Feather name={s.icon} size={14} color={isActive ? colors.accent : colors.textMuted} />
                  <Text style={[styles.subjectChipText, isActive && styles.subjectChipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Name & Email */}
        <Text style={styles.sectionLabel}>Your details</Text>
        <View style={styles.surfaceCard}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : null]}
            value={name}
            onChangeText={(t) => { setName(t); setErrors((e) => { const n = { ...e }; delete n.name; return n; }); }}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            returnKeyType="next"
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((e) => { const n = { ...e }; delete n.email; return n; }); }}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
        </View>

        {/* Message */}
        <Text style={styles.sectionLabel}>Message</Text>
        <View style={styles.surfaceCard}>
          <TextInput
            style={[styles.input, styles.messageInput, errors.message ? styles.inputError : null]}
            value={message}
            onChangeText={(t) => { setMessage(t); setErrors((e) => { const n = { ...e }; delete n.message; return n; }); }}
            placeholder="Tell us what's on your mind..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
          {errors.message && <Text style={styles.errorText}>{errors.message}</Text>}
          <Text style={styles.charCount}>{message.length}/5000</Text>
        </View>

        {/* Submit */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.lg }}>
          <TouchableOpacity
            style={[styles.submitBtn, status === 'submitting' && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={status === 'submitting'}
            activeOpacity={0.7}
          >
            {status === 'submitting' ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <>
                <Feather name="send" size={16} color={colors.textOnAccent} />
                <Text style={styles.submitBtnText}>Send message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Section label — MD3 sentence case
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    letterSpacing: 0.1,
  },

  // Grouped surface card
  surfaceCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Subject chips
  subjectRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subjectChipActive: {
    backgroundColor: colors.accent + '15',
    borderColor: colors.accent,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  subjectChipTextActive: {
    color: colors.accent,
  },

  // Input fields
  inputLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.debit,
  },
  messageInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  errorText: {
    fontSize: 11,
    color: colors.debit,
    marginTop: 4,
    marginLeft: 4,
  },
  charCount: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  // Submit button
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md + 2,
    borderRadius: 20,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textOnAccent,
  },

  // Success state
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  successDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl + 8,
    paddingVertical: spacing.md,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textOnAccent,
  },
  secondaryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // Error state
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.debit + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.debit,
    marginBottom: spacing.sm,
  },
});

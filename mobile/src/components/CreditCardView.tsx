import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import { useStore, CreditCard } from '../store';

const NETWORK_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Visa: 'credit-card',
  Mastercard: 'credit-card',
  'American Express': 'credit-card',
  RuPay: 'credit-card',
};

interface Props {
  card: CreditCard;
  compact?: boolean;
}

function CreditCardView({ card, compact = false }: Props) {
  const { defaultCurrency } = useStore();
  const width = compact ? 280 : 340;
  const height = compact ? 160 : 200;

  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          backgroundColor: card.color || '#1E3A5F',
        },
      ]}
    >
      {/* Decorative overlay circles */}
      <View style={[styles.circle, styles.circle1]} />
      <View style={[styles.circle, styles.circle2]} />

      {/* Top row: issuer + currency badge + network */}
      <View style={styles.topRow}>
        <Text style={[styles.issuer, compact && { fontSize: fontSize.sm }]}>
          {card.issuer}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {card.currency && card.currency !== 'INR' && (
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyBadgeText}>{card.currency}</Text>
            </View>
          )}
          <Feather
            name={NETWORK_ICONS[card.network] || 'credit-card'}
            size={compact ? 20 : 24}
            color="rgba(255,255,255,0.8)"
          />
        </View>
      </View>

      {/* Card number (last 4) */}
      <View style={styles.numberRow}>
        <Text style={[styles.dots, compact && { fontSize: fontSize.md }]}>
          {'****  ****  ****  '}
        </Text>
        <Text style={[styles.last4, compact && { fontSize: fontSize.lg }]}>
          {card.last4}
        </Text>
      </View>

      {/* Bottom row: nickname + credit limit */}
      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.label}>Card Name</Text>
          <Text style={[styles.nickname, compact && { fontSize: fontSize.sm }]}>
            {card.nickname}
          </Text>
        </View>
        {!compact && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>Credit Limit</Text>
            <Text style={styles.limit}>{formatCurrency(card.creditLimit, card.currency ?? defaultCurrency)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default React.memo(CreditCardView);

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circle1: {
    width: 200,
    height: 200,
    top: -60,
    right: -60,
  },
  circle2: {
    width: 140,
    height: 140,
    bottom: -40,
    left: -30,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  issuer: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    lineHeight: 22,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dots: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: fontSize.xl,
    fontWeight: '300',
    letterSpacing: 2,
  },
  last4: {
    color: '#FFFFFF',
    fontSize: fontSize.xxl,
    fontWeight: '700',
    letterSpacing: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    lineHeight: 16,
  },
  nickname: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  limit: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  currencyBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currencyBadgeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 16,
  },
});

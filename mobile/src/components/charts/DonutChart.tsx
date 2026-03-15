import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../../theme';

interface Segment {
  name: string;
  amount: number;
  color: string;
  percentage: number;
}

interface Props {
  segments: Segment[];
  currency: CurrencyCode;
  size?: number;
  strokeWidth?: number;
}

export default function DonutChart({
  segments,
  currency,
  size = 200,
  strokeWidth = 28,
}: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (segments.length === 0) return null;

  const total = segments.reduce((s, seg) => s + seg.amount, 0);
  if (total <= 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - 4) / 2;
  const innerR = outerR - strokeWidth;

  // Build arc paths
  let currentAngle = -Math.PI / 2; // start from top
  const gap = 0.02; // small gap between segments in radians

  const arcs = segments.map((seg, i) => {
    const sweepAngle = (seg.amount / total) * (Math.PI * 2 - gap * segments.length);
    const startAngle = currentAngle + gap / 2;
    const endAngle = startAngle + sweepAngle;
    currentAngle = endAngle + gap / 2;

    const isSelected = selectedIdx === i;
    const offset = isSelected ? 4 : 0;
    const midAngle = (startAngle + endAngle) / 2;
    const ox = Math.cos(midAngle) * offset;
    const oy = Math.sin(midAngle) * offset;

    // Outer arc
    const x1 = cx + ox + outerR * Math.cos(startAngle);
    const y1 = cy + oy + outerR * Math.sin(startAngle);
    const x2 = cx + ox + outerR * Math.cos(endAngle);
    const y2 = cy + oy + outerR * Math.sin(endAngle);

    // Inner arc
    const x3 = cx + ox + innerR * Math.cos(endAngle);
    const y3 = cy + oy + innerR * Math.sin(endAngle);
    const x4 = cx + ox + innerR * Math.cos(startAngle);
    const y4 = cy + oy + innerR * Math.sin(startAngle);

    const largeArc = sweepAngle > Math.PI ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');

    return { d, color: seg.color, idx: i };
  });

  const selected = selectedIdx !== null ? segments[selectedIdx] : null;

  return (
    <View style={s.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {arcs.map((arc) => (
            <Path
              key={arc.idx}
              d={arc.d}
              fill={arc.color}
              opacity={selectedIdx !== null && selectedIdx !== arc.idx ? 0.4 : 1}
              onPress={() => setSelectedIdx(selectedIdx === arc.idx ? null : arc.idx)}
            />
          ))}
        </Svg>

        {/* Center text */}
        <View style={[s.centerText, { width: innerR * 2 - 16, height: innerR * 2 - 16, top: cy - innerR + 8, left: cx - innerR + 8 }]}>
          {selected ? (
            <>
              <Text style={s.centerLabel} numberOfLines={1}>{selected.name}</Text>
              <Text style={s.centerAmount}>{formatCurrency(selected.amount, currency)}</Text>
              <Text style={s.centerPct}>{selected.percentage.toFixed(1)}%</Text>
            </>
          ) : (
            <>
              <Text style={s.centerLabel}>Total</Text>
              <Text style={s.centerAmount}>{formatCurrency(total, currency)}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginBottom: 2,
  },
  centerAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    lineHeight: 22,
  },
  centerPct: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: 2,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, {
  Path, Line, Circle, Defs, LinearGradient, Stop, G, Text as SvgText,
} from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize, formatCurrency, CurrencyCode } from '../../theme';
import { formatCompact } from '../../utils/cardAnalytics';

interface DataPoint {
  month: string;
  label: string;
  amount: number;
}

interface Props {
  data: DataPoint[];
  average: number;
  currency: CurrencyCode;
  accentColor?: string;
  avgColor?: string;
}

const CHART_HEIGHT = 180;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

export default function TrendLineChart({
  data,
  average,
  currency,
  accentColor = '#5B8DEF',
  avgColor = '#00E5A0',
}: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (data.length < 2) return null;

  const screenW = Dimensions.get('window').width;
  const containerW = screenW - spacing.lg * 2 - 32; // section padding
  const chartW = containerW - PAD.left - PAD.right;
  const chartH = CHART_HEIGHT - PAD.top - PAD.bottom;

  // Compute scale
  const amounts = data.map((d) => d.amount);
  const maxVal = Math.max(...amounts, average, 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const xStep = chartW / (data.length - 1);

  // Map data to chart coordinates
  const points = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + chartH - ((d.amount - minVal) / range) * chartH,
  }));

  // Smooth line path using cubic bezier
  const linePath = points.reduce((path, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = points[i - 1];
    const cp1x = prev.x + xStep * 0.35;
    const cp2x = pt.x - xStep * 0.35;
    return `${path} C ${cp1x} ${prev.y} ${cp2x} ${pt.y} ${pt.x} ${pt.y}`;
  }, '');

  // Area fill path (close to bottom)
  const bottomY = PAD.top + chartH;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;

  // Average line Y
  const avgY = PAD.top + chartH - ((average - minVal) / range) * chartH;

  // Y-axis grid lines (4 lines)
  const yTicks = 4;
  const yLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minVal + (range / yTicks) * i;
    const y = PAD.top + chartH - ((val - minVal) / range) * chartH;
    return { y, val };
  });

  return (
    <View>
      {/* Tooltip */}
      {selectedIdx !== null && data[selectedIdx] && (
        <View style={s.tooltip}>
          <Text style={s.tooltipMonth}>{data[selectedIdx].label}</Text>
          <Text style={s.tooltipAmount}>
            {formatCurrency(data[selectedIdx].amount, currency)}
          </Text>
        </View>
      )}

      <Svg width={containerW} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accentColor} stopOpacity={0.25} />
            <Stop offset="1" stopColor={accentColor} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yLines.map((tick, i) => (
          <G key={i}>
            <Line
              x1={PAD.left}
              y1={tick.y}
              x2={PAD.left + chartW}
              y2={tick.y}
              stroke={colors.border}
              strokeWidth={0.5}
              opacity={0.5}
            />
          </G>
        ))}

        {/* Y-axis labels */}
        {yLines.filter((_, i) => i % 2 === 0).map((tick, i) => (
          <SvgText
            key={`yl-${i}`}
            x={PAD.left - 6}
            y={tick.y + 3}
            fill={colors.textMuted}
            fontSize={9}
            textAnchor="end"
          >
            {formatCompact(tick.val, currency)}
          </SvgText>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Main line */}
        <Path
          d={linePath}
          fill="none"
          stroke={accentColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Average dashed line */}
        <Line
          x1={PAD.left}
          y1={avgY}
          x2={PAD.left + chartW}
          y2={avgY}
          stroke={avgColor}
          strokeWidth={1.5}
          strokeDasharray="4,4"
          opacity={0.6}
        />

        {/* Data points */}
        {points.map((pt, i) => (
          <G key={i}>
            {/* Outer ring for selected */}
            {selectedIdx === i && (
              <Circle
                cx={pt.x}
                cy={pt.y}
                r={8}
                fill={accentColor}
                opacity={0.2}
              />
            )}
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={selectedIdx === i ? 5 : 3}
              fill={accentColor}
              stroke={colors.background}
              strokeWidth={2}
            />
          </G>
        ))}
      </Svg>

      {/* X-axis labels + touch targets */}
      <View style={[s.xAxisRow, { paddingLeft: PAD.left, width: containerW }]}>
        {data.map((d, i) => (
          <TouchableOpacity
            key={d.month}
            style={[s.xLabel, { width: xStep }]}
            onPress={() => setSelectedIdx(selectedIdx === i ? null : i)}
            activeOpacity={0.7}
          >
            <Text style={[
              s.xLabelText,
              selectedIdx === i && { color: colors.textPrimary, fontWeight: '700' as const },
            ]}>
              {d.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: accentColor }]} />
          <Text style={s.legendText}>Total spend</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: avgColor, opacity: 0.6 }]} />
          <Text style={s.legendText}>Monthly avg</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tooltip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  tooltipMonth: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  tooltipAmount: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  xAxisRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  xLabel: {
    alignItems: 'center',
  },
  xLabelText: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
});

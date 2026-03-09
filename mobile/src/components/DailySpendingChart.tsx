import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H = 160;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

interface DailySpendingChartProps {
  debitsByDay: { day: number; amount: number }[];
  daysInRange: number;
}

function abbreviate(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

function DailySpendingChart({
  debitsByDay,
  daysInRange,
}: DailySpendingChartProps) {
  const chartW = SCREEN_WIDTH - spacing.lg * 2;
  const plotW = chartW - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...debitsByDay.map((d) => d.amount), 1);

  const toX = (day: number) => PAD_LEFT + ((day - 1) / Math.max(daysInRange - 1, 1)) * plotW;
  const toY = (amount: number) => PAD_TOP + plotH - (amount / maxVal) * plotH;

  // Build smooth cubic bezier path through data points
  const points = debitsByDay.map((d) => ({ x: toX(d.day), y: toY(d.amount) }));

  const buildLinePath = (pts: { x: number; y: number }[]): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const tension = 0.3;
      const dx = cur.x - prev.x;
      const cp1x = prev.x + dx * tension;
      const cp2x = cur.x - dx * tension;
      d += ` C${cp1x},${prev.y} ${cp2x},${cur.y} ${cur.x},${cur.y}`;
    }
    return d;
  };

  const linePath = buildLinePath(points);
  const baselineY = PAD_TOP + plotH;
  const areaPath = points.length > 0
    ? `${linePath} L${points[points.length - 1].x},${baselineY} L${points[0].x},${baselineY} Z`
    : '';

  // Grid lines (4 lines including 0)
  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const val = (maxVal / (gridCount - 1)) * i;
    return { val, y: toY(val) };
  });

  // X-axis labels
  const xLabels: number[] = [1];
  if (daysInRange >= 14) xLabels.push(7);
  if (daysInRange >= 21) xLabels.push(14);
  if (daysInRange >= 28) xLabels.push(21);
  if (daysInRange > 1) xLabels.push(daysInRange);

  const hasData = debitsByDay.length > 0;

  return (
    <View style={styles.container}>
      {hasData ? (
        <Svg width={chartW} height={CHART_H}>
          {/* Horizontal grid lines */}
          {gridLines.map((g) => (
            <React.Fragment key={g.val}>
              <Line
                x1={PAD_LEFT}
                y1={g.y}
                x2={chartW - PAD_RIGHT}
                y2={g.y}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={PAD_LEFT - 6}
                y={g.y + 4}
                fill={colors.textMuted}
                fontSize={9}
                textAnchor="end"
              >
                {abbreviate(g.val)}
              </SvgText>
            </React.Fragment>
          ))}

          {/* X-axis labels */}
          {xLabels.map((day) => (
            <SvgText
              key={day}
              x={toX(day)}
              y={CHART_H - 6}
              fill={colors.textMuted}
              fontSize={9}
              textAnchor="middle"
            >
              {day}
            </SvgText>
          ))}

          {/* Gradient definition */}
          <Defs>
            <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.debit} stopOpacity={0.35} />
              <Stop offset="1" stopColor={colors.debit} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Area fill with gradient */}
          {points.length > 1 && (
            <Path d={areaPath} fill="url(#areaGradient)" />
          )}

          {/* Line stroke */}
          {points.length > 1 && (
            <Path
              d={linePath}
              fill="none"
              stroke={colors.debit}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data point dots — glow ring + white border + solid core */}
          {debitsByDay.map((d) => (
            <React.Fragment key={`d-${d.day}`}>
              <Circle
                cx={toX(d.day)}
                cy={toY(d.amount)}
                r={7}
                fill={colors.debit}
                opacity={0.15}
              />
              <Circle
                cx={toX(d.day)}
                cy={toY(d.amount)}
                r={4}
                fill={colors.surface}
              />
              <Circle
                cx={toX(d.day)}
                cy={toY(d.amount)}
                r={2.5}
                fill={colors.debit}
              />
            </React.Fragment>
          ))}

        </Svg>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No transactions this month</Text>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.debit }]} />
          <Text style={styles.legendLabel}>Daily Spending</Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(DailySpendingChart);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: {
    height: CHART_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});

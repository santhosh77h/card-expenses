import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';

interface DataPoint {
  month: string;
  label: string;
  amount: number;
}

interface Props {
  data: DataPoint[];
  color: string;
  width: number;
  height: number;
}

export default function SpendingSparkline({ data, color, width, height }: Props) {
  if (data.length < 2) return null;

  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  const minVal = Math.min(...data.map((d) => d.amount), 0);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartW;
    const y = padding + chartH - ((d.amount - minVal) / range) * chartH;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');

  // Area fill: close the polygon at the bottom
  const firstX = padding;
  const lastX = padding + chartW;
  const bottomY = padding + chartH;
  const polygonPoints = `${polylinePoints} ${lastX},${bottomY} ${firstX},${bottomY}`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Polygon points={polygonPoints} fill="url(#sparkGrad)" />
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { spacing } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { StructuredAnswer } from './AskResultViews';
import { CHART_COMPONENTS } from './AskChartViews';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChartCarouselProps {
  intent: string;
  answer: string;
  rows?: Record<string, any>[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChartCarousel({ intent, answer, rows }: ChartCarouselProps) {
  const ChartComponent = CHART_COMPONENTS[intent];
  const hasChart = !!ChartComponent && !!rows && rows.length > 0;

  // No chart available — render text directly (zero overhead)
  if (!hasChart) {
    return <StructuredAnswer intent={intent} answer={answer} rows={rows} />;
  }

  return (
    <CarouselInner
      intent={intent}
      answer={answer}
      rows={rows!}
      ChartComponent={ChartComponent}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner carousel (only mounted when chart exists)
// ---------------------------------------------------------------------------

interface InnerProps {
  intent: string;
  answer: string;
  rows: Record<string, any>[];
  ChartComponent: React.FC<{ rows: Record<string, any>[]; containerWidth: number }>;
}

const PAGES = [{ key: 'text' }, { key: 'chart' }];

function CarouselInner({ intent, answer, rows, ChartComponent }: InnerProps) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0 && w !== containerWidth) setContainerWidth(w);
    },
    [containerWidth],
  );

  const renderPage = useCallback(
    ({ item }: { item: { key: string } }) => {
      if (containerWidth <= 0) return null;
      return (
        <View style={{ width: containerWidth }}>
          {item.key === 'text' ? (
            <StructuredAnswer intent={intent} answer={answer} rows={rows} />
          ) : (
            <ChartComponent rows={rows} containerWidth={containerWidth} />
          )}
        </View>
      );
    },
    [containerWidth, intent, answer, rows, ChartComponent],
  );

  return (
    <View onLayout={handleLayout}>
      {containerWidth > 0 && (
        <>
          <FlatList
            data={PAGES}
            renderItem={renderPage}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            snapToInterval={containerWidth}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: containerWidth,
              offset: containerWidth * index,
              index,
            })}
          />
          {/* Pagination dots */}
          <View style={s.dotsRow}>
            {PAGES.map((p, idx) => (
              <View
                key={p.key}
                style={[s.dot, idx === activeIndex && s.dotActive]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.sm,
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
      opacity: 0.4,
    },
    dotActive: {
      backgroundColor: colors.accent,
      opacity: 1,
      width: 18,
      borderRadius: 3,
    },
  });

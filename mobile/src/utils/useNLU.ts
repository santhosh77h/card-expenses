/**
 * React hook for using the on-device NLU engine.
 *
 * Usage:
 * ```tsx
 * const { query, loading, ready, error } = useNLU();
 *
 * const result = query("how many swiggy transactions last month");
 * // result.sql, result.params, result.intent, result.entities
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { initNLU, processQuery, disposeNLU } from './nlu';
import type { NLUResult, CardInfo, LabelInfo } from './nlu';

export interface UseNLUReturn {
  /** Whether models are loaded and ready */
  ready: boolean;
  /** Whether models are still loading */
  loading: boolean;
  /** Error during model loading (if any) */
  error: string | null;
  /** Process a natural language query. Pass cards/labels to enable card/label-based filtering. Returns null if not ready. */
  query: (text: string, cards?: CardInfo[], labels?: LabelInfo[]) => NLUResult | null;
}

export function useNLU(): UseNLUReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    initNLU()
      .then(() => {
        if (mounted.current) {
          setReady(true);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted.current) {
          setError(err?.message ?? 'Failed to load NLU models');
          setLoading(false);
        }
      });

    return () => {
      mounted.current = false;
    };
  }, []);

  const query = useCallback(
    (text: string, cards?: CardInfo[], labels?: LabelInfo[]): NLUResult | null => {
      if (!ready) return null;
      try {
        return processQuery(text, cards, labels);
      } catch (err: any) {
        setError(err?.message ?? 'NLU inference failed');
        return null;
      }
    },
    [ready],
  );

  return { ready, loading, error, query };
}

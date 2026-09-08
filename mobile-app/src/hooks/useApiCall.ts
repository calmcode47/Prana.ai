/**
 * useApiCall<T> — Shared hook for data fetching with loading + error state.
 *
 * Replaces the scattered `.catch(() => {})` pattern across all screens.
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useApiCall(fetchAlerts);
 */

import { useState, useEffect, useCallback, useRef, DependencyList } from 'react';

interface ApiCallState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiCall<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList = [],
): ApiCallState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const run = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchFn()
      .then((result) => {
        if (isMounted.current) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted.current) {
          const msg = err instanceof Error ? err.message : 'Backend unavailable';
          setError(msg);
          setIsLoading(false);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    run();
    return () => {
      isMounted.current = false;
    };
  }, [run]);

  return { data, isLoading, error, refetch: run };
}

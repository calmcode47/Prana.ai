/**
 * useApiCall<T> — Shared hook for data fetching with loading + error state,
 * automatic retry, and background polling options.
 */

import { useState, useEffect, useCallback, useRef, DependencyList } from 'react';

export interface UseApiCallOptions {
  pollIntervalMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

interface ApiCallState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiCall<T>(
  fetchFn: () => Promise<T>,
  deps: DependencyList = [],
  options?: UseApiCallOptions
): ApiCallState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const retryCountRef = useRef(0);

  const retriesMax = options?.retries ?? 0;
  const retryDelay = options?.retryDelayMs ?? 1000;

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const attemptFetch = async (): Promise<void> => {
      try {
        const result = await fetchFn();
        if (isMounted.current) {
          setData(result);
          setIsLoading(false);
          retryCountRef.current = 0;
        }
      } catch (err: unknown) {
        if (!isMounted.current) return;

        if (retryCountRef.current < retriesMax) {
          retryCountRef.current += 1;
          setTimeout(attemptFetch, retryDelay * retryCountRef.current);
        } else {
          const msg = err instanceof Error ? err.message : 'Backend unavailable';
          setError(msg);
          setIsLoading(false);
          retryCountRef.current = 0;
        }
      }
    };

    await attemptFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    run();

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    if (options?.pollIntervalMs && options.pollIntervalMs > 0) {
      pollTimer = setInterval(run, options.pollIntervalMs);
    }

    return () => {
      isMounted.current = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [run, options?.pollIntervalMs]);

  return { data, isLoading, error, refetch: run };
}

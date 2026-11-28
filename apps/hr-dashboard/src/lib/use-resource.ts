"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { errorMessage } from "./format";

interface ResourceState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

/**
 * Load data for a screen. Refetches when `key` changes; `key: null` skips the
 * load (e.g. a route param that is not ready yet). `refresh()` re-fetches in
 * the background, keeping the current data on screen; await it after a
 * mutation so the UI shows the new state.
 */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<ResourceState<T>>({
    data: undefined,
    error: null,
    loading: key !== null,
  });

  const fetchLatest = useEffectEvent(() => fetcher());

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    fetchLatest().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error: unknown) =>
        !cancelled && setState((s) => ({ ...s, error: errorMessage(error), loading: false })),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetcher();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error: errorMessage(error), loading: false }));
    }
  }, [fetcher]);

  return { ...state, refresh };
}

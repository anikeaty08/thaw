"use client";

import { useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "idle" | "loading"; data: T; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T; error: Error };

/** Runs an indexer fetch and keeps loading / error state, so pages can tell "empty" from "failed". */
export function useAsync<T>(fn: (() => Promise<T>) | null, initial: T, deps: unknown[]): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "idle", data: initial, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!fn) {
      setState({ status: "idle", data: initial, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ status: "loading", data: s.data, error: null }));
    fn()
      .then((data) => !cancelled && setState({ status: "success", data, error: null }))
      .catch((error: Error) => !cancelled && setState({ status: "error", data: initial, error }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

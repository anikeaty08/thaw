"use client";

import { useEffect, useRef, useState } from "react";

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:42069";

export type BackendState = "checking" | "waking" | "connected" | "unreachable";

/**
 * Pings the indexer's /ready on mount and keeps checking. Doubles as the wake-up call for a free-
 * tier Render backend: the fetch itself is what wakes a sleeping instance, which is why the first
 * checks are frequent and patient (a cold start commonly takes 30-50s, sometimes more) before this
 * gives up and shows "Not connected" — at which point it keeps retrying quietly in the background,
 * since a real visit or a `curl` from anywhere else may wake it up in the meantime.
 */
export function useBackendStatus(): BackendState {
  const [state, setState] = useState<BackendState>("checking");
  const attempt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();

    async function check() {
      attempt.current += 1;
      try {
        const res = await fetch(`${INDEXER_URL}/ready`, { cache: "no-store", signal: controller.signal });
        if (cancelled) return;
        if (!res.ok) throw new Error(String(res.status));
        setState("connected");
        timer = setTimeout(check, 45_000); // catch it going back to sleep after 15 idle minutes
      } catch {
        if (cancelled) return;
        if (attempt.current === 1) setState("waking");
        if (attempt.current > 24) {
          setState("unreachable");
          timer = setTimeout(check, 30_000); // keep trying quietly rather than stopping for good
        } else {
          timer = setTimeout(check, 5_000);
        }
      }
    }

    check();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return state;
}

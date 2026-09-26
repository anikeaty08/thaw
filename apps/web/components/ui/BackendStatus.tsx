"use client";

import clsx from "clsx";
import { useBackendStatus } from "@/lib/useBackendStatus";

const LABEL: Record<ReturnType<typeof useBackendStatus>, string> = {
  checking: "Checking…",
  waking: "Waking up…",
  connected: "Connected",
  unreachable: "Not connected",
};

export function BackendStatus({ className }: { className?: string }) {
  const state = useBackendStatus();

  return (
    <span
      title="The indexer that powers loan history, auctions and vault activity. A free-tier backend can take up to a minute to wake up after being idle."
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-glacier-700 bg-glacier-900 px-2.5 py-1 text-xs text-mist-400",
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
        {(state === "waking" || state === "checking") && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-frost-400 opacity-60" />
        )}
        <span
          className={clsx(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            state === "connected" && "bg-success",
            (state === "waking" || state === "checking") && "bg-frost-400",
            state === "unreachable" && "bg-danger",
          )}
        />
      </span>
      <span className="hidden sm:inline">{LABEL[state]}</span>
    </span>
  );
}

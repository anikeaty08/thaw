import type { ReactNode } from "react";
import clsx from "clsx";

export function Badge({
  children,
  tone = "frost",
  pulse = false,
}: {
  children: ReactNode;
  tone?: "frost" | "ember" | "danger" | "neutral";
  pulse?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "frost" && "bg-frost-400/10 text-frost-300",
        tone === "ember" && "bg-ember-500/15 text-ember-400",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "neutral" && "bg-mist-500/15 text-mist-300",
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

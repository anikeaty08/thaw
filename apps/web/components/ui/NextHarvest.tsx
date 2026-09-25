"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Icon } from "./Icon";

// Harvests run every Thursday at 00:05 UTC (Mezo epoch flip + 5 min, see keeper service).
export function nextHarvestAt(now = new Date()): Date {
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 5));
  const daysUntilThursday = (4 - now.getUTCDay() + 7) % 7;
  target.setUTCDate(target.getUTCDate() + daysUntilThursday);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 7);
  return target;
}

function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function NextHarvest({ variant = "block" }: { variant?: "block" | "inline" }) {
  // Rendered only after mount so server and client agree on the time.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const target = now ? nextHarvestAt(now) : null;
  const remaining = now && target ? target.getTime() - now.getTime() : null;
  // Fraction of the week already elapsed, for the little melt gauge.
  const weekProgress = remaining !== null ? 1 - remaining / (7 * 24 * 3600 * 1000) : 0;

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-mist-300">
        <Icon name="drop" size={16} className="text-ember-400" />
        Next harvest in{" "}
        <span className="tabular font-medium text-frostwhite">{remaining !== null ? formatCountdown(remaining) : "…"}</span>
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-glacier-700 bg-glacier-900/60 p-3.5">
      <div className="flex items-center gap-2 text-xs text-mist-400">
        <Icon name="drop" size={14} className="text-ember-400" />
        Next harvest
      </div>
      <div className="tabular mt-1.5 font-display text-xl font-semibold text-frostwhite">
        {remaining !== null ? formatCountdown(remaining) : "…"}
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-glacier-700">
        <div
          className={clsx("h-full rounded-full bg-thaw-gradient transition-[width] duration-700")}
          style={{ width: `${Math.min(100, Math.max(2, weekProgress * 100))}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-mist-500">Thursdays, 00:05 UTC</p>
    </div>
  );
}

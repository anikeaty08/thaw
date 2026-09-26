import clsx from "clsx";
import type { CSSProperties } from "react";

// Icons8 "Windows 11 Regular" (fluent-systems-regular), locked in icons8.json. The PNGs live in
// /public/icons and are drawn as CSS masks so they take `currentColor` like an inline SVG would.
export type IconName =
  | "wallet"
  | "coins"
  | "gavel"
  | "eye"
  | "drop"
  | "thaw"
  | "snowflake"
  | "shield"
  | "close"
  | "check"
  | "info"
  | "warning"
  | "external"
  | "clock"
  | "lock"
  | "arrow-right"
  | "search"
  | "calendar"
  | "copy"
  | "sun"
  | "moon";

export function Icon({
  name,
  size = 20,
  label,
  className,
}: {
  name: IconName;
  size?: number;
  /** Accessible name. Omit for decorative icons next to visible text. */
  label?: string;
  className?: string;
}) {
  const mask = `url(/icons/${name}.png) center / contain no-repeat`;
  const style: CSSProperties = { width: size, height: size, WebkitMask: mask, mask };

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={clsx("inline-block shrink-0 bg-current", className)}
      style={style}
    />
  );
}

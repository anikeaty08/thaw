import { useId } from "react";

// Thaw's six-armed crystal, traced from the 3D model (apps/web/design/thaw-models.blend): six arms
// with a branch pair each around a ring, warming from frost to ember. app/icon.svg uses the same path.
const ARMS =
  "M13.00 10.20L13.00 1.52M13.00 5.43l-2.06 -2.29M13.00 5.43l2.06 -2.29M10.58 11.60L3.06 7.26M6.44 9.21l-3.01 0.64M6.44 9.21l-0.95 -2.93M10.58 14.40L3.06 18.74M6.44 16.79l-0.95 2.93M6.44 16.79l-3.01 -0.64M13.00 15.80L13.00 24.48M13.00 20.57l2.06 2.29M13.00 20.57l-2.06 2.29M15.42 14.40L22.94 18.74M19.56 16.79l3.01 -0.64M19.56 16.79l0.95 2.93M15.42 11.60L22.94 7.26M19.56 9.21l0.95 -2.93M19.56 9.21l3.01 0.64";

export function ThawMark({ size = 26, mono = false }: { size?: number; mono?: boolean }) {
  const id = useId();
  // `mono` draws in currentColor, for places that stay one colour (the footer).
  const stroke = mono ? "currentColor" : `url(#${id})`;
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" className="shrink-0" aria-hidden>
      <g stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
        <path d={ARMS} strokeWidth="2" />
        <circle cx="13" cy="13" r="2.35" strokeWidth="1.6" />
      </g>
      <circle cx="13" cy="13" r="0.9" className={mono ? "fill-current" : "fill-ember-500"} />
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2d9cff" />
          <stop offset="1" stopColor="#f77f3a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <ThawMark size={size} />
      <span className="font-display text-lg font-semibold tracking-tight text-frostwhite">
        Thaw
      </span>
    </span>
  );
}

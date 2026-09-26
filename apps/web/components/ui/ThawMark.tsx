import { useId } from "react";

// A six-armed ice crystal whose arms warm from frost to ember: the whole product in one glyph.
export function ThawMark({ size = 26 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" className="shrink-0" aria-hidden>
      <path
        d="M13 2 L13 24 M4.5 6.5 L21.5 19.5 M21.5 6.5 L4.5 19.5"
        stroke={`url(#${id})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="13" cy="13" r="3.2" className="fill-glacier-950" stroke={`url(#${id})`} strokeWidth="1.6" />
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

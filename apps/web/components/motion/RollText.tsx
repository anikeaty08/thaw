import clsx from "clsx";

/**
 * Letters that roll up one after another when the nearest `.roll-host` (a link or button) is
 * hovered or focused. CSS only: each letter is a two-row stack that slides up by one row.
 */
export function RollText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={clsx("relative inline-flex", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex select-none">
        {Array.from(text).map((ch, i) => (
          <span key={i} className="roll-char">
            <span className="roll-col" style={{ transitionDelay: `${i * 14}ms` }}>
              <span>{ch === " " ? " " : ch}</span>
              <span>{ch === " " ? " " : ch}</span>
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

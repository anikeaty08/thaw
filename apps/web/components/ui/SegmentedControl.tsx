"use client";

import clsx from "clsx";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-glacier-700 bg-glacier-900/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            value === opt.value ? "bg-frost-400/15 text-frost-100" : "text-mist-400 hover:text-frostwhite",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

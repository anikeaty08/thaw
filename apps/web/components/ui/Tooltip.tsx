"use client";

import { useId, useState } from "react";
import { Icon } from "./Icon";

export function Tooltip({ content, label = "More info" }: { content: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="flex text-mist-500 transition-colors hover:text-frost-300"
      >
        <Icon name="info" size={15} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-lg border border-glacier-600 bg-glacier-900 px-3 py-2 text-xs font-normal leading-relaxed text-mist-300 shadow-frost"
        >
          {content}
        </span>
      )}
    </span>
  );
}

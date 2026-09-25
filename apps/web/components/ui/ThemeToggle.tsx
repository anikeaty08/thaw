"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon } from "./Icon";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-glacier-700 bg-glacier-900 text-mist-300 transition-colors hover:border-frost-400 hover:text-frostwhite"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}

import type { ReactNode } from "react";
import clsx from "clsx";
import { Tooltip } from "./Tooltip";
import { Icon, type IconName } from "./Icon";
import { SpotlightCard } from "./SpotlightCard";
import { ScrambleText } from "@/components/motion/ScrambleText";

export function StatTile({
  label,
  value,
  unit,
  hint,
  tone = "frost",
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  tone?: "frost" | "ember" | "neutral";
  icon?: IconName;
  className?: string;
}) {
  return (
    <SpotlightCard tone={tone === "ember" ? "ember" : "frost"} tilt={false} className={clsx("min-w-0 px-4 py-4 sm:px-5", className)}>
      <div className="flex items-center gap-1.5 text-[13px] text-mist-400">
        {icon && <Icon name={icon} size={15} className={tone === "ember" ? "text-ember-400" : "text-frost-300"} />}
        <span className="truncate">{label}</span>
        {hint && <Tooltip content={hint} label={`About ${label.toLowerCase()}`} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={clsx(
            "tabular truncate font-display text-2xl font-semibold tracking-tight",
            tone === "frost" && "text-frost-200",
            tone === "ember" && "text-ember-400",
            tone === "neutral" && "text-frostwhite",
          )}>
          {typeof value === "string" ? <ScrambleText text={value} duration={0.7} /> : value}
        </span>
        {unit && <span className="text-xs text-mist-500">{unit}</span>}
      </div>
    </SpotlightCard>
  );
}

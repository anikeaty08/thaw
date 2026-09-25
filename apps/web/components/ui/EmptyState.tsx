import type { ReactNode } from "react";
import clsx from "clsx";
import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon,
  title,
  children,
  action,
  compact = false,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center rounded-2xl border border-dashed border-glacier-700 text-center",
        compact ? "gap-2 px-6 py-8" : "gap-3 px-8 py-14",
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-glacier-600 bg-glacier-800 text-frost-300">
        <Icon name={icon} size={22} />
      </span>
      <p className="font-medium text-frostwhite">{title}</p>
      {children && <div className="max-w-sm text-sm leading-relaxed text-mist-400">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

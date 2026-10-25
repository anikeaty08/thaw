import type { ReactNode } from "react";
import { ScrambleText } from "@/components/motion/ScrambleText";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: ReactNode;
  /** Small mono label above the title, e.g. the section of the app. */
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-frost-300">{eyebrow}</p>}
        <h1 className="display text-4xl leading-[1.02] text-frostwhite lg:text-5xl">
          {typeof title === "string" ? <ScrambleText text={title} duration={0.8} /> : title}
        </h1>
        {description && <p className="mt-3 max-w-2xl leading-relaxed text-mist-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}

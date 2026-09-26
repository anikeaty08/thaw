import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1
          className="font-display text-3xl font-semibold tracking-tight text-frostwhite lg:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl leading-relaxed text-mist-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}

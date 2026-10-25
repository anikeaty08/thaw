"use client";

import { useState } from "react";
import clsx from "clsx";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";

export interface TocItem {
  id: string;
  label: string;
}

/** Sticky table of contents that follows along with the section you're reading. */
export function DocsToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useGSAP(() => {
    const triggers = items.map((item) =>
      ScrollTrigger.create({
        trigger: `#${item.id}`,
        start: "top 40%",
        end: "bottom 40%",
        onToggle: (self) => self.isActive && setActive(item.id),
      }),
    );
    return () => triggers.forEach((t) => t.kill());
  }, [items]);

  return (
    <nav aria-label="On this page" className="hidden lg:block">
      <div className="sticky top-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist-500">On this page</p>
        <ol className="mt-4 space-y-1 border-l border-glacier-700">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active === item.id ? "location" : undefined}
                className={clsx(
                  "-ml-px block border-l py-1.5 pl-4 text-sm transition-colors",
                  active === item.id ? "border-frost-400 text-frostwhite" : "border-transparent text-mist-400 hover:text-frostwhite",
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

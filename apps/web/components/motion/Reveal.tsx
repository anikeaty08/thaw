"use client";

import { useRef, type ReactNode } from "react";
import { EASE_OUT, ScrollTrigger, gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

/**
 * Rises its `[data-reveal-item]` descendants into place, in a stagger, as they scroll into view
 * (or the wrapper itself when it has none). Each item animates once; nothing hides with reduced motion.
 */
export function Reveal({ children, className, y = 28 }: { children: ReactNode; className?: string; y?: number }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || prefersReducedMotion()) return;

      const found = gsap.utils.toArray<HTMLElement>("[data-reveal-item]", el);
      const items = found.length ? found : [el];
      gsap.set(items, { autoAlpha: 0, y });
      ScrollTrigger.batch(items, {
        start: "top 90%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09, ease: EASE_OUT, overwrite: true, clearProps: "transform" }),
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}

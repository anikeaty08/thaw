"use client";

import { useRef, type ReactNode } from "react";
import clsx from "clsx";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

/**
 * A frost panel that lights up under the pointer: a soft spotlight on the surface, a brighter rim
 * where the cursor meets the border, and a slight tilt toward it. The light also shows on keyboard
 * focus inside the card. Tilt is skipped on touch screens and with reduced motion.
 */
export function SpotlightCard({
  children,
  tone = "frost",
  tilt = true,
  className,
}: {
  children: ReactNode;
  tone?: "frost" | "ember";
  tilt?: boolean;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

      const canTilt = tilt && !prefersReducedMotion();
      if (canTilt) gsap.set(el, { transformPerspective: 900 });
      const rotateX = gsap.quickTo(el, "rotateX", { duration: 0.6, ease: "power3" });
      const rotateY = gsap.quickTo(el, "rotateY", { duration: 0.6, ease: "power3" });

      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${x * 100}%`);
        el.style.setProperty("--my", `${y * 100}%`);
        if (canTilt) {
          rotateY((x - 0.5) * 5);
          rotateX((0.5 - y) * 5);
        }
      };
      const leave = () => {
        if (canTilt) {
          rotateX(0);
          rotateY(0);
        }
      };

      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: root, dependencies: [tilt] },
  );

  return (
    <div ref={root} data-tone={tone} className={clsx("spotlight-card", className)}>
      {children}
    </div>
  );
}

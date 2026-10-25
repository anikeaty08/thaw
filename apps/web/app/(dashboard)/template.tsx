"use client";

import { useRef } from "react";
import { EASE_OUT, gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

// Templates remount on every navigation, so each app page settles in out of a light frost blur,
// with its top-level panels following one after another.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline({ defaults: { ease: EASE_OUT } })
        .from(root.current, { autoAlpha: 0, y: 14, filter: "blur(6px)", duration: 0.6, clearProps: "transform,filter" })
        .from(
          ".frost-panel, .spotlight-card, [data-app-in]",
          { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.05, clearProps: "transform" },
          0.1,
        );
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}

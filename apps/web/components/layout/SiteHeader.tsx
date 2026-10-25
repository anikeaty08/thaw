"use client";

import { useRef } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/ThawMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LaunchAppButton } from "@/components/layout/LaunchAppButton";
import { ScrollTrigger, gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { SiteMenu } from "./SiteMenu";

/**
 * Header for the public pages (landing, docs). Just the mark, the theme switch, the one way in and
 * the menu. It tucks away while you scroll down and comes back the moment you scroll up, and a thin
 * frost-to-ember line along the bottom shows how far down the page you are.
 */
export function SiteHeader() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      gsap.fromTo("[data-scroll-progress]", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

      let hidden = false;
      const show = (visible: boolean) => {
        if (hidden === !visible) return;
        hidden = !visible;
        gsap.to(el, { yPercent: visible ? 0 : -100, duration: prefersReducedMotion() ? 0 : 0.45, ease: "power3.out", overwrite: "auto" });
      };
      const st = ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (self) => {
          if (self.scroll() < 160 || el.contains(document.activeElement)) show(true);
          else show(self.direction === -1);
        },
      });
      return () => st.kill();
    },
    { scope: root },
  );

  return (
    <header
      ref={root}
      onFocus={() => gsap.to(root.current, { yPercent: 0, duration: 0.3 })}
      className="sticky top-0 z-40 border-b border-glacier-700 bg-glacier-950/80 backdrop-blur-xl"
    >
      {/* Three columns so the menu sits dead centre whatever the sides hold. */}
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Thaw home" className="justify-self-start">
          <Wordmark size={24} />
        </Link>
        <SiteMenu />
        <div className="flex items-center gap-2 justify-self-end">
          <ThemeToggle />
          <LaunchAppButton size="sm" className="hidden min-h-[40px] text-sm sm:inline-flex" />
        </div>
      </div>
      <span data-scroll-progress className="absolute inset-x-0 -bottom-px h-px origin-left scale-x-0 bg-thaw-gradient" aria-hidden />
    </header>
  );
}

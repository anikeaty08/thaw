"use client";

import { ScrambleText } from "@/components/motion/ScrambleText";
import { LaunchAppButton } from "@/components/layout/LaunchAppButton";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function DocsHero() {
  return (
    <section className="hero-glow relative mb-16 border-b border-glacier-700">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.2]" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-frost-300">Docs</p>
        <h1 className="display mt-4 max-w-3xl text-[clamp(2.6rem,5vw,4.5rem)] leading-[0.98]">
          <ScrambleText text="Everything Thaw does, in plain words." />
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-mist-400">
          How loans are sized and repaid, what the keeper does every Thursday, how lenders earn, and every contract and
          parameter, read live.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LaunchAppButton arrow />
          <a href="#live" className={buttonClasses({ variant: "secondary" })}>
            <Icon name="chart" size={16} />
            Live parameters
          </a>
        </div>
      </div>
    </section>
  );
}

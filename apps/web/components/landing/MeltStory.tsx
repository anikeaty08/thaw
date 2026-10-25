"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { ThawMark } from "@/components/ui/ThawMark";
import { EASE_OUT, ScrollTrigger, gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

// three.js only loads when this section is about to be seen, and never blocks the first paint.
const IceScene = dynamic(() => import("./IceScene"), { ssr: false });

// Same illustrative terms as the hero simulator: 60 MUSD/week earned, 75% counted, 10 weeks, 6% APR.
const WEEKLY = 60;
const COUNTED = 0.75;
const LOAN = WEEKLY * COUNTED * 10;

function debtByWeek(): number[] {
  const out = [LOAN];
  let debt = LOAN;
  while (debt > 0.005 && out.length < 60) {
    debt += (debt * 0.06) / 52;
    debt -= Math.min(debt, WEEKLY * COUNTED);
    out.push(debt);
  }
  return out;
}

const STEPS = [
  { kicker: "Week 0", title: "Your lock is frozen.", body: "It earns about 60 MUSD a week in rewards, but the position itself can't be sold or spent for months." },
  { kicker: "Today", title: `${LOAN} MUSD, in your wallet.`, body: "Deposit the lock and open an Advance worth ten weeks of counted rewards. It moves into escrow and keeps earning." },
  { kicker: "Thursday 1", title: "The first harvest.", body: "At 00:05 UTC a keeper claims your lock's rewards, swaps them to MUSD and pays the loan down. You do nothing." },
  { kicker: "Halfway", title: "Half of it, gone.", body: "No reminders, no top-ups, no price to watch. Every week the debt gets a little smaller." },
  { kicker: "Paid off", title: "Your lock comes back.", body: "The debt hits zero. Withdraw your veNFT: still locked, still earning, never sold." },
];

// Scroll progress for the first two beats; after that the melt (and the Thursday count) decides.
const BORROW_AT = 0.16;
const MELT_START = 0.32;

const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

/**
 * One loan told in five beats while the section is pinned: the ice crystal (the debt) melts as you
 * scroll and the counters follow. With reduced motion it is a plain list of the five beats.
 */
export function MeltStory() {
  const root = useRef<HTMLElement>(null);
  const melt = useRef(0);
  const [step, setStep] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [loadScene, setLoadScene] = useState(false);
  const weeks = useMemo(debtByWeek, []);
  const last = weeks.length - 1;

  useGSAP(
    () => {
      const r = prefersReducedMotion();
      setReduce(r);
      const el = root.current;
      if (!el) return;

      // Start fetching three.js a screen before the section arrives.
      ScrollTrigger.create({ trigger: el, start: "top bottom+=100%", once: true, onEnter: () => setLoadScene(true) });
      if (r) return;

      const debtEl = el.querySelector<HTMLElement>("[data-debt]");
      const weekEl = el.querySelector<HTMLElement>("[data-week]");
      const bar = el.querySelector<HTMLElement>("[data-bar]");

      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "+=320%",
        pin: true,
        scrub: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress;
          const m = gsap.utils.clamp(0, 1, (p - MELT_START) / (1 - MELT_START - 0.06));
          melt.current = m;
          const week = Math.round(m * last);
          if (debtEl) debtEl.textContent = fmt(p < BORROW_AT ? 0 : weeks[week]);
          if (weekEl) weekEl.textContent = String(week);
          if (bar) bar.style.transform = `scaleX(${p})`;
          const half = Math.ceil(last / 2);
          setStep(p < BORROW_AT ? 0 : week === 0 ? 1 : week < half ? 2 : week < last ? 3 : 4);
        },
      });

      gsap.from("[data-story-in]", {
        y: 30,
        autoAlpha: 0,
        duration: 1,
        stagger: 0.1,
        ease: EASE_OUT,
        scrollTrigger: { trigger: el, start: "top 70%", once: true },
      });
    },
    { scope: root },
  );

  if (reduce) {
    return (
      <section aria-labelledby="story" className="py-24">
        <h2 id="story" className="display text-4xl sm:text-5xl">One loan, start to finish</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.kicker} className="frost-panel p-5">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-frost-300">{s.kicker}</p>
              <h3 className="mt-3 font-medium text-frostwhite">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section ref={root} aria-labelledby="story" className="relative flex h-[100svh] min-h-[600px] items-center overflow-hidden">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
        {/* The crystal */}
        <div data-story-in className="relative order-1 h-[38svh] min-h-[240px] lg:order-2 lg:h-[70svh]">
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="h-48 w-48 rounded-full bg-frost-500/10 blur-3xl" />
            {!loadScene && <ThawMark size={96} />}
          </div>
          {loadScene && <IceScene melt={melt} reduceMotion={false} />}
        </div>

        {/* The words */}
        <div className="order-2 lg:order-1">
          <p data-story-in className="font-mono text-xs uppercase tracking-[0.24em] text-frost-300">
            One loan, start to finish
          </p>
          <h2 id="story" className="sr-only">
            One loan, start to finish
          </h2>

          <div data-story-in className="relative mt-5 min-h-[190px] sm:min-h-[210px]">
            {STEPS.map((s, i) => (
              <div
                key={s.kicker}
                className={clsx(
                  "absolute inset-0 transition-[opacity,transform,filter] duration-500 ease-out",
                  i === step ? "translate-y-0 opacity-100 blur-0" : i < step ? "-translate-y-4 opacity-0 blur-sm" : "translate-y-4 opacity-0 blur-sm",
                )}
              >
                <p className="text-sm font-medium text-ember-400">{s.kicker}</p>
                <h3 className="display mt-2 text-[clamp(2rem,4.2vw,3.6rem)] leading-[1.02]">{s.title}</h3>
                <p className="mt-4 max-w-md leading-relaxed text-mist-400">{s.body}</p>
              </div>
            ))}
          </div>

          <dl data-story-in className="mt-8 grid max-w-md grid-cols-2 gap-4">
            <div className="rounded-xl border border-glacier-700 bg-glacier-900/70 px-4 py-3">
              <dt className="text-xs text-mist-400">Debt left</dt>
              <dd className="tabular mt-1 font-display text-2xl font-semibold text-frost-200">
                <span data-debt>0</span> <span className="text-xs font-normal text-mist-500">MUSD</span>
              </dd>
            </div>
            <div className="rounded-xl border border-glacier-700 bg-glacier-900/70 px-4 py-3">
              <dt className="text-xs text-mist-400">Thursdays passed</dt>
              <dd className="tabular mt-1 font-display text-2xl font-semibold text-ember-400">
                <span data-week>0</span> <span className="text-xs font-normal text-mist-500">of {last}</span>
              </dd>
            </div>
          </dl>

          <div data-story-in className="mt-6 max-w-md">
            <div className="relative h-1 overflow-hidden rounded-full bg-glacier-700">
              <span data-bar className="absolute inset-0 origin-left scale-x-0 rounded-full bg-thaw-gradient" />
            </div>
            <ol className="mt-3 flex justify-between text-[11px] text-mist-500" aria-hidden>
              {STEPS.map((s, i) => (
                <li key={s.kicker} className={clsx("transition-colors", i <= step && "text-mist-300")}>
                  {s.kicker}
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-6 text-xs text-mist-500">Illustration with the demo terms. Real loans depend on what your lock earns.</p>
        </div>
      </div>
    </section>
  );
}

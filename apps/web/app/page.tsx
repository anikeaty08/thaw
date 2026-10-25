"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import clsx from "clsx";
import { buttonClasses } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { NextHarvest } from "@/components/ui/NextHarvest";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LaunchAppButton } from "@/components/layout/LaunchAppButton";
import { MeltStory } from "@/components/landing/MeltStory";
import { IntroCurtain, onIntroDone } from "@/components/motion/IntroCurtain";
import { TypeWords } from "@/components/motion/TypeWords";
import { ScrambleText } from "@/components/motion/ScrambleText";
import { Reveal } from "@/components/motion/Reveal";
import { isConfigured, useVaultOverview } from "@/lib/hooks";
import { formatMusd } from "@/lib/format";
import { addresses } from "@/lib/contracts";
import { EASE_OUT, SplitText, gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";

const LOAN_MANAGER = addresses.loanManager;

// three.js scenes load on demand, never in the first paint.
const VaultScene = dynamic(() => import("@/components/three/VaultScene"), { ssr: false });
const HeroMark = dynamic(() => import("@/components/three/HeroMark"), { ssr: false });

// The last word of the headline types out what a lock can do once it's in Thaw.
const HERO_WORDS = ["lend.", "repay.", "work twice.", "pay you.", "thaw."];

export default function LandingPage() {
  const page = useRef<HTMLDivElement>(null);
  const markSpot = useRef<HTMLDivElement>(null);
  const vault = useVaultOverview();
  const totalAssets = vault.data?.[0]?.result as bigint | undefined;
  const totalLent = vault.data?.[1]?.result as bigint | undefined;
  const badDebt = vault.data?.[4]?.result as bigint | undefined;
  const utilization =
    totalAssets && totalAssets > 0n && totalLent !== undefined ? `${Number((totalLent * 1000n) / totalAssets) / 10}%` : "—";

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // Hero: the headline flips up letter by letter out of a frost blur, then the rest rises in.
      const split = SplitText.create("[data-split]", { type: "words,chars", aria: "none" });
      gsap.set("[data-reveal]", { visibility: "visible" });
      const hero = gsap
        .timeline({ paused: true, defaults: { ease: EASE_OUT } })
        .from(split.chars, {
          yPercent: 70,
          rotateX: -95,
          autoAlpha: 0,
          filter: "blur(8px)",
          transformOrigin: "50% 100%",
          duration: 1.1,
          stagger: 0.022,
        })
        .from("[data-flip]", { yPercent: 60, autoAlpha: 0, filter: "blur(8px)", duration: 1 }, "-=0.75")
        .from("[data-hero-rise]", { y: 26, autoAlpha: 0, duration: 1, stagger: 0.1 }, 0.3);

      // The lifecycle track fills frost to ember as you read along it.
      gsap.fromTo(
        "[data-track]",
        { scaleX: 0 },
        { scaleX: 1, ease: "none", scrollTrigger: { trigger: "[data-track]", start: "top 85%", end: "top 35%", scrub: 0.5 } },
      );

      return onIntroDone(() => hero.play());
    },
    { scope: page },
  );

  return (
    <div ref={page} className="overflow-x-clip">
      <IntroCurtain />
      <SiteHeader />
      <main>

      {/* Hero */}
      <section className="hero-glow relative border-b border-glacier-700">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.22]" aria-hidden />
        {/* Thaw's mark in particles, sampled from a Blender model. Spans the hero so it can scatter. */}
        <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_75%,transparent)]" aria-hidden>
          <HeroMark anchor={markSpot} />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div className="lg:col-span-6">
            <a
              data-reveal
              data-hero-rise
              href={isConfigured ? `https://explorer.test.mezo.org/address/${LOAN_MANAGER}` : undefined}
              target={isConfigured ? "_blank" : undefined}
              rel={isConfigured ? "noreferrer" : undefined}
              className="inline-flex items-center gap-2 rounded-full border border-glacier-700 bg-glacier-900 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:border-glacier-600 hover:text-frostwhite"
            >
              <span className="relative flex h-2 w-2" aria-hidden>
                {isConfigured && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />}
                <span className={clsx("relative inline-flex h-2 w-2 rounded-full", isConfigured ? "bg-success" : "bg-mist-500")} />
              </span>
              {isConfigured ? "Live on Mezo testnet" : "Testnet deployment pending"}
              {isConfigured && <Icon name="external" size={12} className="text-mist-500" />}
            </a>
            <h1 className="display mt-7 text-[clamp(2.9rem,5.4vw,5rem)] leading-[0.98]">
              <span className="sr-only">Your locks earn. Now they lend.</span>
              <span aria-hidden data-reveal className="block [perspective:900px]">
                <span data-split className="block">
                  Your locks earn.
                </span>
                <span className="block text-mist-400">
                  <span data-split>Now they</span>{" "}
                  <span data-flip className="inline-block">
                    <TypeWords words={HERO_WORDS} textClassName="text-thaw pb-[0.08em]" />
                  </span>
                </span>
              </span>
            </h1>
            <p
              data-reveal
              data-hero-rise
              className="mt-7 max-w-xl text-base leading-7 text-mist-400 sm:text-lg sm:leading-8"
            >
              Borrow MUSD against your locked veMEZO or veBTC. Every Thursday, the rewards your lock already earns pay the loan
              down for you.
            </p>
            <div data-reveal data-hero-rise className="mt-9 flex flex-wrap items-center gap-3">
              <LaunchAppButton size="lg" arrow>
                Borrow against a lock
              </LaunchAppButton>
              <LaunchAppButton href="/lend" variant="secondary" size="lg">
                Lend MUSD
              </LaunchAppButton>
            </div>
            <ul data-reveal data-hero-rise className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs text-mist-400 sm:text-sm">
              {["No price liquidation on Advance", "Your lock keeps earning", "Repaid automatically every Thursday"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" size={15} className="text-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Where the particle mark sits; the canvas itself spans the whole hero (below). */}
          <div ref={markSpot} className="relative h-[340px] sm:h-[440px] lg:col-span-6 lg:h-[580px]" aria-hidden>
            <div className="absolute inset-0 m-auto h-64 w-64 rounded-full bg-frost-500/10 blur-3xl" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Live protocol strip */}
        <Reveal className="mt-10">
          <section
            aria-label="Protocol today"
            className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-glacier-700 bg-glacier-700 shadow-frost lg:grid-cols-4"
          >
            <LiveStat icon="coins" label="MUSD in the vault" value={formatMusd(totalAssets, { compact: true })} />
            <LiveStat icon="wallet" label="Lent to borrowers" value={formatMusd(totalLent, { compact: true })} />
            <LiveStat icon="chart" label="Vault utilization" value={utilization} />
            <div className="flex flex-col justify-center bg-glacier-900 px-5 py-6">
              <NextHarvest variant="inline" />
            </div>
          </section>
        </Reveal>

        {/* Lifecycle */}
        <section className="py-24 lg:py-32" aria-labelledby="lifecycle">
          <SectionIntro id="lifecycle" eyebrow="How it works" title="From frozen to free">
            A veNFT is locked for months or years. Thaw lets you spend what it will earn, and uses those earnings to settle up.
          </SectionIntro>

          <div className="relative mt-14 h-px bg-glacier-700" aria-hidden>
            <span data-track className="absolute inset-0 origin-left bg-gradient-to-r from-frost-500 via-frost-300 to-ember-500" />
          </div>

          <Reveal>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LIFECYCLE.map((stage, i) => (
                <li key={stage.title} data-reveal-item className="h-full">
                  <SpotlightCard tone={i === LIFECYCLE.length - 1 ? "ember" : "frost"} className="h-full p-6">
                    <div className="flex items-start justify-between">
                      <span className="icon-tile">
                        <Icon name={stage.icon} size={22} />
                      </span>
                      <span className="font-mono text-xs text-mist-500">0{i + 1}</span>
                    </div>
                    <h3 className="mt-6 font-medium text-frostwhite">{stage.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-mist-400">{stage.body}</p>
                  </SpotlightCard>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

      </div>

      <MeltStory />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Two ways to borrow */}
        <section className="py-24 lg:py-32" aria-labelledby="modes">
          <SectionIntro id="modes" eyebrow="Pick per loan" title="Two ways to borrow">
            Most people start with an Advance and move to a Credit Line when they need more.
          </SectionIntro>

          <Reveal className="mt-10 grid gap-4 md:grid-cols-2">
            {MODES.map((mode) => (
              <div key={mode.title} data-reveal-item>
                <SpotlightCard tone={mode.tone} tilt={false} className="h-full p-6 sm:p-8">
                  <div className="flex items-center gap-4">
                    <span className="icon-tile">
                      <Icon name={mode.icon} size={22} />
                    </span>
                    <div>
                      <h3 className="font-display text-xl font-semibold text-frostwhite">{mode.title}</h3>
                      <p className="mt-0.5 text-sm text-mist-400">{mode.note}</p>
                    </div>
                  </div>
                  <dl className="mt-6 divide-y divide-glacier-700/70 border-y border-glacier-700/70">
                    {COMPARISON.map((row) => (
                      <div key={row.label} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                        <dt className="text-mist-400">{row.label}</dt>
                        <dd className="text-right font-medium text-frostwhite">{row[mode.key]}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-5 flex items-start gap-2 text-sm text-mist-300">
                    <Icon name="check" size={16} className="mt-0.5 text-success" />
                    {mode.bestFor}
                  </p>
                </SpotlightCard>
              </div>
            ))}
          </Reveal>
        </section>

        {/* Trust */}
        <section className="pb-24 lg:pb-32" aria-labelledby="trust">
          <SectionIntro id="trust" eyebrow="No black boxes" title="Built to be checked">
            The parts that keep a loan safe are rules in a contract, not promises on a page.
          </SectionIntro>

          <Reveal className="mt-10 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title} data-reveal-item>
                <SpotlightCard className="h-full p-6">
                  <span className="icon-tile">
                    <Icon name={p.icon} size={22} />
                  </span>
                  <h3 className="mt-6 font-medium text-frostwhite">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist-400">{p.body}</p>
                  {p.link && (
                    <Link href={p.link.href} className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-frost-300 hover:text-frost-200">
                      {p.link.label}
                      <Icon name="arrow-right" size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                  )}
                </SpotlightCard>
              </div>
            ))}
          </Reveal>
        </section>

        {/* Lenders: the vault on one side, the case for depositing on the other. */}
        <section className="grid items-center gap-10 py-24 lg:grid-cols-2 lg:gap-16 lg:py-32" aria-labelledby="lenders">
          {/* Modelled in Blender: the door swings open as you reach this section. */}
          <div className="relative order-2 h-72 sm:h-96 lg:order-1 lg:h-[460px]" aria-hidden>
            <div className="absolute inset-x-[15%] bottom-[12%] h-16 rounded-full bg-frost-500/15 blur-3xl" />
            <VaultScene />
          </div>

          <Reveal className="order-1 lg:order-2">
            <p data-reveal-item className="font-mono text-xs uppercase tracking-[0.24em] text-frost-300">
              For lenders
            </p>
            <h2 id="lenders" data-reveal-item className="display mt-4 text-4xl leading-[1.02] sm:text-5xl">
              <ScrambleText text="Holding MUSD instead?" />
            </h2>
            <p data-reveal-item className="mt-4 max-w-lg leading-relaxed text-mist-400">
              Deposit into the tMUSD vault and earn from three places at once.
            </p>

            <ul data-reveal-item className="mt-7 space-y-4">
              {YIELD.map((y) => (
                <li key={y.title} className="flex gap-4">
                  <span className="icon-tile h-10 w-10 rounded-lg">
                    <Icon name={y.icon} size={18} />
                  </span>
                  <div>
                    <p className="font-medium text-frostwhite">{y.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-mist-400">{y.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <dl data-reveal-item className="mt-8 grid grid-cols-2 divide-glacier-700 border-y border-glacier-700 sm:grid-cols-4 sm:divide-x">
              <VaultFact label="Deposits" value={formatMusd(totalAssets, { compact: true })} unit="MUSD" />
              <VaultFact label="Utilization" value={utilization} />
              <VaultFact label="Bad debt" value={formatMusd(badDebt, { compact: true })} unit="MUSD" />
              <VaultFact label="Withdrawals" value="Instant*" />
            </dl>
            <p data-reveal-item className="mt-3 text-xs leading-relaxed text-mist-500">
              *Up to idle liquidity. Anything beyond that queues and fills from the next harvest.
            </p>

            <div data-reveal-item>
              <LaunchAppButton href="/lend" arrow className="mt-8">
                Open the vault
              </LaunchAppButton>
            </div>
          </Reveal>
        </section>

        {/* Closing call to action */}
        <section className="py-24 lg:py-32" aria-labelledby="cta">
          <Reveal>
            <div className="hero-glow relative overflow-hidden rounded-[28px] border border-glacier-700 px-6 py-16 text-center sm:px-12 sm:py-20">
              <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.18]" aria-hidden />
              <div className="relative mx-auto max-w-2xl">
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-frost-300">Ready when your lock is</p>
                <h2 id="cta" className="display mt-5 text-[clamp(2.4rem,5vw,4.2rem)] leading-[1]">
                  <ScrambleText text="Let your lock pay its own way." />
                </h2>
                <p className="mx-auto mt-5 max-w-md leading-relaxed text-mist-400">
                  Borrow today. Every Thursday, the rewards you were already earning chip the loan away.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <LaunchAppButton size="lg" arrow>
                    Borrow against a lock
                  </LaunchAppButton>
                  <Link href="/docs" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                    Read the docs
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
      </main>

      <SiteFooter />
    </div>
  );
}

const LIFECYCLE: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "snowflake",
    title: "Your lock goes in",
    body: "Deposit a veMEZO or veBTC NFT into Thaw's escrow. You stay the owner on record, and it keeps earning.",
  },
  {
    icon: "coins",
    title: "MUSD comes out",
    body: "Choose an Advance or a Credit Line. MUSD lands in your wallet in the same transaction.",
  },
  {
    icon: "drop",
    title: "Thursdays pay it down",
    body: "Each epoch a keeper votes your lock, claims bribes and fees, swaps them to MUSD and repays your loan.",
  },
  {
    icon: "thaw",
    title: "Your lock comes back",
    body: "Once the debt hits zero, withdraw your veNFT. You can also repay early from the loan page whenever you like.",
  },
];

const COMPARISON = [
  { label: "Sized by", advance: "Your weekly rewards", credit: "Your lock's value" },
  { label: "How much", advance: "Several weeks of rewards", credit: "25–60% of its value" },
  { label: "Interest", advance: "5–6% APR, fixed", credit: "5–6% APR, fixed" },
  { label: "If rewards drop", advance: "The loan takes longer", credit: "Health factor falls" },
  { label: "Liquidation", advance: "Never on price", credit: "Dutch auction below 1.0" },
];

const MODES: {
  key: "advance" | "credit";
  tone: "frost" | "ember";
  icon: IconName;
  title: string;
  note: string;
  bestFor: string;
}[] = [
  {
    key: "advance",
    tone: "frost",
    icon: "shield",
    title: "Advance",
    note: "Hands-off, can't be liquidated on price",
    bestFor: "Best when you want cash now and never want to watch a chart.",
  },
  {
    key: "credit",
    tone: "ember",
    icon: "coins",
    title: "Credit Line",
    note: "Bigger loans, with a health factor",
    bestFor: "Best when you need more than your rewards cover and will keep an eye on health.",
  },
];

const YIELD: { icon: IconName; title: string; body: string }[] = [
  { icon: "coins", title: "Loan interest", body: "Borrowers pay a fixed 5–6% APR on what they owe." },
  { icon: "drop", title: "A share of every harvest", body: "Part of each Thursday's claimed rewards goes to lenders." },
  { icon: "lock", title: "Savings Rate on idle MUSD", body: "Whatever isn't lent out still earns the MUSD Savings Rate." },
];

const PRINCIPLES: { icon: IconName; title: string; body: string; link?: { href: string; label: string } }[] = [
  {
    icon: "shield",
    title: "Advances ignore price",
    body: "An Advance is sized by what your lock earns, not what it's worth. If rewards dip, it takes longer to repay. It never gets liquidated.",
  },
  {
    icon: "flash",
    title: "Anyone can run the harvest",
    body: "The Thursday keeper is permissionless, so repayments don't depend on a single operator staying online.",
  },
  {
    icon: "chart",
    title: "Every number is on-chain",
    body: "Vault size, utilization, bad debt and risk parameters are read straight from the contracts.",
    link: { href: "/docs#live", label: "See the parameters" },
  },
];

function SectionIntro({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-xl">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-frost-300">{eyebrow}</p>
      <h2 id={id} className="display mt-4 text-4xl leading-[1.02] sm:text-5xl">
        <ScrambleText text={title} />
      </h2>
      <p className="mt-4 leading-relaxed text-mist-400">{children}</p>
    </div>
  );
}

function LiveStat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="bg-glacier-900 px-5 py-6">
      <Icon name={icon} size={18} className="text-frost-300" />
      <div className="tabular mt-3 font-display text-2xl font-semibold text-frostwhite">
        <ScrambleText text={value} />
      </div>
      <div className="mt-1 text-xs text-mist-400 sm:text-sm">{label}</div>
    </div>
  );
}

function VaultFact({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="px-1 py-4 sm:px-4 sm:first:pl-0">
      <dt className="text-xs text-mist-500">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span className="tabular font-display text-xl font-semibold text-frostwhite">
          <ScrambleText text={value} />
        </span>
        {unit && <span className="text-xs text-mist-500">{unit}</span>}
      </dd>
    </div>
  );
}

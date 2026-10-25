"use client";

import Link from "next/link";
import clsx from "clsx";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ThawMark } from "@/components/ui/ThawMark";
import { NextHarvest } from "@/components/ui/NextHarvest";
import { RollText } from "@/components/motion/RollText";
import { Reveal } from "@/components/motion/Reveal";
import { isConfigured } from "@/lib/hooks";
import { prefersReducedMotion } from "@/lib/gsap";
import { NAV } from "./nav";

const REPO = "https://github.com/anikeaty08/thaw";

const RESOURCES: { href: string; label: string; icon: IconName }[] = [
  { href: REPO, label: "Source code", icon: "github" },
  { href: "https://explorer.test.mezo.org", label: "Mezo explorer", icon: "external" },
];

/**
 * A quiet surface with one soft frost-to-ember wash at the bottom edge. On the public pages (`full`)
 * a glowing frost-to-ember line marks where the page ends and the columns rise in one after
 * another; inside the app (`compact`) it is one slim row that leaves room for the phone tab bar.
 */
export function SiteFooter({ variant = "full" }: { variant?: "full" | "compact" }) {
  const full = variant === "full";

  // Inside the app the sidebar already carries the navigation, so the footer is one slim row.
  if (!full) {
    return (
      <footer className="footer-surface mt-16 border-t border-glacier-700 pb-[calc(60px+env(safe-area-inset-bottom))] text-xs text-mist-500 lg:pb-0">
        <div className="flex flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p className="flex items-center gap-2">
            <ThawMark size={16} mono />
            © {new Date().getFullYear()} Thaw · Testnet software, not audited
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {RESOURCES.map((item) => (
              <li key={item.href}>
                <a href={item.href} target="_blank" rel="noreferrer" className="roll-host inline-flex min-h-[28px] items-center gap-1.5 transition-colors hover:text-frostwhite">
                  <Icon name={item.icon} size={14} />
                  <RollText text={item.label} />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    );
  }

  return (
    <footer className="footer-surface relative text-mist-400">
      {/* The seam: a thin line that warms from frost to ember, with a soft glow spilling down. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-frost-400/70 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent from-50% via-ember-400/60 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-[20%] top-0 h-24 bg-[radial-gradient(50%_100%_at_50%_0%,rgb(var(--frost-400)/0.12),transparent)]" />
      <div className="relative mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <Reveal className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div data-reveal-item>
            <Link href="/" aria-label="Thaw home" className="inline-flex items-center gap-2.5 text-frostwhite">
              <ThawMark size={24} mono />
              <span className="font-display text-lg font-semibold tracking-tight">Thaw</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              Self-repaying MUSD credit for locked veMEZO and veBTC. Your lock&apos;s own rewards pay the loan.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-glacier-700 px-3 py-1.5 text-xs">
              <span className={clsx("h-1.5 w-1.5 rounded-full", isConfigured ? "bg-success" : "bg-mist-500")} aria-hidden />
              {isConfigured ? "Live on Mezo testnet" : "Testnet deployment pending"} · chain 31611
            </span>
          </div>

          <FooterColumn title="Protocol">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="footer-link roll-host">
                  <Icon name={item.icon} size={16} />
                  <RollText text={item.label} />
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Resources">
            <li>
              <Link href="/docs" className="footer-link roll-host">
                <Icon name="document" size={16} />
                <RollText text="Docs" />
              </Link>
            </li>
            {RESOURCES.map((item) => (
              <li key={item.href}>
                <a href={item.href} target="_blank" rel="noreferrer" className="footer-link roll-host">
                  <Icon name={item.icon} size={16} />
                  <RollText text={item.label} />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Rhythm">
            <li>
              <NextHarvest variant="inline" />
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Icon name="calendar" size={16} />
              Harvests every Thursday, 00:05 UTC
            </li>
            <li className="flex items-center gap-2 text-sm">
              <Icon name="lock" size={16} />
              5–6% APR, fixed
            </li>
          </FooterColumn>
        </Reveal>
      </div>

      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-4 border-t border-glacier-700 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Thaw. Testnet software, not audited. Use test funds only.</p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })}
          className="roll-host inline-flex min-h-[44px] items-center gap-2 self-start rounded-lg px-2 transition-colors hover:text-frostwhite sm:self-auto"
        >
          <RollText text="Back to top" />
          <Icon name="arrow-right" size={14} className="-rotate-90" />
        </button>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div data-reveal-item>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist-500">{title}</h3>
      <ul className="mt-4 space-y-3">{children}</ul>
    </div>
  );
}

"use client";

import Link from "next/link";
import clsx from "clsx";
import { buttonClasses } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Wordmark } from "@/components/ui/ThawMark";
import { NextHarvest } from "@/components/ui/NextHarvest";
import { MeltSimulator } from "@/components/landing/MeltSimulator";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useVaultOverview } from "@/lib/hooks";
import { formatMusd } from "@/lib/format";
import { addresses } from "@/lib/contracts";

const LOAN_MANAGER = addresses.loanManager;

export default function LandingPage() {
  const vault = useVaultOverview();
  const totalAssets = vault.data?.[0]?.result as bigint | undefined;
  const totalLent = vault.data?.[1]?.result as bigint | undefined;
  const badDebt = vault.data?.[4]?.result as bigint | undefined;
  const utilization =
    totalAssets && totalAssets > 0n && totalLent !== undefined ? `${Number((totalLent * 1000n) / totalAssets) / 10}%` : "—";

  return (
    <div className="overflow-x-clip">
      <TopNav />

      {/* Hero */}
      <section className="hero-glow relative border-b border-glacier-700">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.22]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-12 lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div className="lg:col-span-6">
            <a
              href={`https://explorer.test.mezo.org/address/${LOAN_MANAGER}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-glacier-700 bg-glacier-900 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:border-glacier-600 hover:text-frostwhite"
            >
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live on Mezo testnet
              <Icon name="external" size={12} className="text-mist-500" />
            </a>
            <h1 className="display animate-thaw mt-7 text-[clamp(2.9rem,5.4vw,5rem)] leading-[0.94]">
              Your locks earn.
              <br />
              <span className="text-mist-400">Now they lend.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-mist-400 animate-rise-in [animation-delay:500ms] sm:text-lg sm:leading-8">
              Borrow MUSD against your locked veMEZO or veBTC. Every Thursday, the rewards your lock already earns pay the loan
              down for you.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3 animate-rise-in [animation-delay:650ms]">
              <Link href="/portfolio" className={buttonClasses({ size: "lg" })}>
                Borrow against a lock
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link href="/lend" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                Lend MUSD
              </Link>
            </div>
            <ul className="mt-12 flex flex-wrap gap-x-7 gap-y-3 text-xs text-mist-400 animate-rise-in [animation-delay:800ms] sm:text-sm">
              {["No price liquidation on Advance", "Your lock keeps earning", "Repaid automatically every Thursday"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" size={15} className="text-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-rise-in [animation-delay:300ms] lg:col-span-6">
            <MeltSimulator />
            <p className="mt-3 px-1 text-xs leading-relaxed text-mist-500">
              Illustration using the demo collateral terms: 6% APR, 75% of rewards counted, all of it applied to the debt.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Live protocol strip */}
        <section aria-label="Protocol today" className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-glacier-700 bg-glacier-700 shadow-frost lg:grid-cols-4">
          <LiveStat label="MUSD in the vault" value={formatMusd(totalAssets, { compact: true })} />
          <LiveStat label="Lent to borrowers" value={formatMusd(totalLent, { compact: true })} />
          <LiveStat label="Vault utilization" value={utilization} />
          <div className="flex flex-col justify-center bg-glacier-900 px-5 py-6">
            <NextHarvest variant="inline" />
          </div>
        </section>

        {/* Lifecycle */}
        <section className="py-24 lg:py-32" aria-labelledby="lifecycle">
          <div className="max-w-xl">
            <h2 id="lifecycle" className="display text-4xl leading-[1.02] sm:text-5xl">
              From frozen to free
            </h2>
            <p className="mt-4 leading-relaxed text-mist-400">
              A veNFT is locked for months or years. Thaw lets you spend what it will earn, and uses those earnings to settle up.
            </p>
          </div>

          <ol className="relative mt-14 grid gap-10 lg:grid-cols-4 lg:gap-8">
            {/* The track warms from frost to ember as the loan moves along */}
            <span
              aria-hidden
              className="absolute bottom-6 left-[21px] top-6 w-px bg-gradient-to-b from-frost-500 via-frost-300 to-ember-500 lg:bottom-auto lg:left-6 lg:right-6 lg:top-[21px] lg:h-px lg:w-auto lg:bg-gradient-to-r lg:from-frost-500 lg:via-frost-400 lg:to-ember-500"
            />
            {LIFECYCLE.map((stage, i) => (
              <li key={stage.title} className="relative flex gap-5 lg:flex-col lg:gap-0">
                <span
                  className={clsx(
                    "relative z-10 flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-full border bg-glacier-900",
                    i === LIFECYCLE.length - 1 ? "border-ember-500/50 text-ember-400" : "border-frost-400/40 text-frost-300",
                  )}
                >
                  <Icon name={stage.icon} size={20} />
                </span>
                <div className="lg:mt-6">
                  <h3 className="font-medium text-frostwhite">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist-400">{stage.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Two ways to borrow */}
        <section className="pb-24 lg:pb-32" aria-labelledby="modes">
          <div className="max-w-xl">
            <h2 id="modes" className="display text-4xl leading-[1.02] sm:text-5xl">
              Two ways to borrow
            </h2>
            <p className="mt-4 leading-relaxed text-mist-400">
              Pick per loan. Most people start with an Advance and move to a Credit Line when they need more.
            </p>
          </div>

          <div className="frost-panel mt-10 overflow-hidden">
            <div className="grid grid-cols-2 border-b border-glacier-700 sm:grid-cols-[1.1fr_1fr_1fr]">
              <div className="hidden sm:block" />
              <ModeHeading tone="frost" icon="shield" title="Advance" note="Hands-off, can't be liquidated on price" />
              <ModeHeading tone="ember" icon="coins" title="Credit Line" note="Bigger loans, with a health factor" />
            </div>
            <dl>
              {COMPARISON.map((row, i) => (
                <div
                  key={row.label}
                  className={clsx("grid grid-cols-2 sm:grid-cols-[1.1fr_1fr_1fr]", i > 0 && "border-t border-glacier-700/70")}
                >
                  <dt className="col-span-2 px-5 pb-1 pt-4 text-xs text-mist-500 sm:col-span-1 sm:py-4 sm:text-sm sm:text-mist-400">{row.label}</dt>
                  <dd className="px-5 pb-4 text-sm text-frostwhite sm:py-4">{row.advance}</dd>
                  <dd className="px-5 pb-4 text-sm text-frostwhite sm:py-4">{row.credit}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Lenders */}
        <section className="pb-24 lg:pb-32" aria-labelledby="lenders">
          <div className="frost-panel grid gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-glacier-600 bg-glacier-800 text-frost-300">
                <Icon name="coins" size={22} />
              </span>
              <h2 id="lenders" className="display mt-5 text-4xl leading-[1.02]">
                Holding MUSD instead?
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-mist-400">
                Deposit into the tMUSD vault. You earn loan interest plus a cut of every Thursday harvest, and idle MUSD
                still earns the Savings Rate.
              </p>
              <Link href="/lend" className={clsx(buttonClasses({ variant: "secondary" }), "mt-7")}>
                Open the vault
                <Icon name="arrow-right" size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <VaultFact label="Vault deposits" value={formatMusd(totalAssets, { compact: true })} unit="MUSD" />
              <VaultFact label="Utilization" value={utilization} />
              <VaultFact label="Bad debt to date" value={formatMusd(badDebt, { compact: true })} unit="MUSD" />
              <VaultFact label="Withdrawals" value="Instant*" />
              <p className="col-span-2 text-xs leading-relaxed text-mist-500">
                *Up to idle liquidity. Anything beyond that queues and fills from the next harvest.
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-glacier-700">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Wordmark size={22} />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-mist-500">
              Self-repaying MUSD credit for locked Mezo positions. Running on Mezo testnet, chain 31611.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist-400">
            <Link href="/portfolio" className="hover:text-frostwhite">Portfolio</Link>
            <Link href="/lend" className="hover:text-frostwhite">Lend</Link>
            <Link href="/auctions" className="hover:text-frostwhite">Auctions</Link>
            <Link href="/transparency" className="hover:text-frostwhite">Transparency</Link>
            <a href="https://explorer.test.mezo.org" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-frostwhite">
              Explorer
              <Icon name="external" size={13} />
            </a>
          </nav>
        </div>
      </footer>
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
  { label: "Loan size is based on", advance: "Your weekly rewards", credit: "Your lock's value" },
  { label: "How much", advance: "Several weeks of rewards, up front", credit: "25–60% of its value" },
  { label: "Interest", advance: "5–6% APR, fixed", credit: "5–6% APR, fixed" },
  { label: "If rewards drop", advance: "The loan takes longer", credit: "Health factor falls" },
  { label: "Liquidation", advance: "Never on price", credit: "Dutch auction below 1.0" },
];

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-glacier-700 bg-glacier-950/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Link href="/" aria-label="Thaw home">
          <Wordmark size={24} />
        </Link>
        <div className="hidden items-center gap-8 text-sm text-mist-400 md:flex">
          <Link href="/portfolio" className="transition-colors hover:text-frostwhite">Borrow</Link>
          <Link href="/lend" className="transition-colors hover:text-frostwhite">Lend</Link>
          <Link href="/auctions" className="transition-colors hover:text-frostwhite">Auctions</Link>
          <Link href="/transparency" className="transition-colors hover:text-frostwhite">Transparency</Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/portfolio" className={clsx(buttonClasses({ size: "sm" }), "min-h-[40px] text-sm")}>
            Open app
          </Link>
        </div>
      </nav>
    </header>
  );
}

function LiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-glacier-900 px-5 py-6">
      <div className="tabular font-display text-2xl font-semibold text-frostwhite">
        {value}
      </div>
      <div className="mt-1 text-xs text-mist-400 sm:text-sm">{label}</div>
    </div>
  );
}

function ModeHeading({ tone, icon, title, note }: { tone: "frost" | "ember"; icon: IconName; title: string; note: string }) {
  return (
    <div className="px-5 py-5">
      <div className={clsx("flex items-center gap-2", tone === "frost" ? "text-frost-300" : "text-ember-400")}>
        <Icon name={icon} size={18} />
        <span className="font-display text-lg font-semibold">
          {title}
        </span>
      </div>
      <p className="mt-1 text-xs leading-snug text-mist-500">{note}</p>
    </div>
  );
}

function VaultFact({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-glacier-700 bg-glacier-900/60 px-4 py-4">
      <div className="text-xs text-mist-400">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="tabular font-display text-xl font-semibold text-frostwhite">
          {value}
        </span>
        {unit && <span className="text-xs text-mist-500">{unit}</span>}
      </div>
    </div>
  );
}

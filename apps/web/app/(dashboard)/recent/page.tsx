"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IndexerError, SkeletonRows } from "@/components/ui/IndexerError";
import { NotConfiguredBanner } from "@/components/ui/NotConfiguredBanner";
import { TelegramAlerts } from "@/components/ui/TelegramAlerts";
import { isConfigured } from "@/lib/hooks";
import { fetchActivity, type ActivityRow } from "@/lib/graphql";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMusd } from "@/lib/format";

const EXPLORER = "https://explorer.test.mezo.org";

// How each kind of entry reads. `sign` is how the amount moves for this wallet, where that's clear.
type Group = "loans" | "vault";
const KINDS: Record<string, { label: string; icon: IconName; tone: "frost" | "ember" | "neutral"; sign?: "+" | "−"; group: Group }> = {
  loan_opened: { label: "Opened a loan", icon: "coins", tone: "frost", sign: "+", group: "loans" },
  borrowed: { label: "Borrowed more", icon: "coins", tone: "frost", sign: "+", group: "loans" },
  repaid: { label: "You repaid", icon: "check", tone: "neutral", sign: "−", group: "loans" },
  harvest: { label: "Thursday harvest repaid", icon: "drop", tone: "ember", group: "loans" },
  loan_closed: { label: "Loan paid off, lock returned", icon: "thaw", tone: "ember", group: "loans" },
  liquidation_started: { label: "Loan went to auction", icon: "warning", tone: "neutral", group: "loans" },
  auction_bought: { label: "Bought a lock at auction", icon: "gavel", tone: "frost", sign: "−", group: "loans" },
  deposit: { label: "Deposited into the vault", icon: "wallet", tone: "frost", sign: "−", group: "vault" },
  withdraw: { label: "Withdrew from the vault", icon: "wallet", tone: "neutral", sign: "+", group: "vault" },
  withdraw_queued: { label: "Queued a withdrawal", icon: "clock", tone: "neutral", group: "vault" },
};

const FILTERS: { value: "all" | Group; label: string }[] = [
  { value: "all", label: "All" },
  { value: "loans", label: "Loans" },
  { value: "vault", label: "Vault" },
];

const sum = (rows: ActivityRow[], kinds: string[]) =>
  rows.filter((r) => kinds.includes(r.kind)).reduce((total, r) => total + BigInt(r.amount ?? "0"), 0n);

function dayLabel(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(timestampSec);
}

export default function RecentPage() {
  const { address } = useAccount();
  const [filter, setFilter] = useState<"all" | Group>("all");
  const activity = useAsync<ActivityRow[]>(address && isConfigured ? () => fetchActivity(address) : null, [], [address]);

  const totals = useMemo(
    () => ({
      borrowed: sum(activity.data, ["loan_opened", "borrowed"]),
      byYou: sum(activity.data, ["repaid"]),
      byRewards: sum(activity.data, ["harvest"]),
      inVault: sum(activity.data, ["deposit"]) - sum(activity.data, ["withdraw"]),
    }),
    [activity.data],
  );

  // Newest first, bucketed by calendar day.
  const days = useMemo(() => {
    const rows = activity.data.filter((r) => filter === "all" || KINDS[r.kind]?.group === filter);
    const out: { label: string; rows: ActivityRow[] }[] = [];
    for (const row of rows) {
      const label = dayLabel(Number(row.timestamp));
      if (out.at(-1)?.label === label) out.at(-1)!.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [activity.data, filter]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Your wallet" title="Recent" description="Everything you've done on Thaw, and everything the Thursday harvest did for your loans." />

      {!isConfigured && <NotConfiguredBanner />}

      <TelegramAlerts />

      {activity.status === "success" && activity.data.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile icon="coins" label="Borrowed" value={formatMusd(totals.borrowed)} unit="MUSD" tone="frost" />
          <StatTile icon="drop" label="Repaid by rewards" value={formatMusd(totals.byRewards)} unit="MUSD" tone="ember" />
          <StatTile icon="check" label="Repaid by you" value={formatMusd(totals.byYou)} unit="MUSD" tone="neutral" />
          <StatTile icon="wallet" label="Net in the vault" value={formatMusd(totals.inVault > 0n ? totals.inVault : 0n)} unit="MUSD" tone="neutral" />
        </div>
      )}

      <section className="mt-8" aria-label="Your transactions">
        {activity.status === "success" && activity.data.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
            <span className="text-xs text-mist-500">
              {activity.data.length} {activity.data.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        )}
        {activity.status === "loading" ? (
          <SkeletonRows rows={5} height={64} />
        ) : activity.status === "error" ? (
          <IndexerError what="your recent activity" onRetry={activity.retry} />
        ) : activity.data.length === 0 ? (
          <EmptyState icon="clock" title="Nothing here yet">
            Deposit into the vault or borrow against a lock and it will show up here, along with every Thursday harvest on your
            loans.
          </EmptyState>
        ) : days.length === 0 ? (
          <EmptyState icon="search" title="Nothing in this view" compact>
            Switch back to All to see everything.
          </EmptyState>
        ) : (
          <div className="space-y-6">
            {days.map((day) => (
              <div key={day.label}>
                <h2 className="mb-2 px-1 font-mono text-[11px] uppercase tracking-[0.2em] text-mist-500">{day.label}</h2>
                <ol className="frost-panel divide-y divide-glacier-700">
                  {day.rows.map((row) => (
                    <ActivityItem key={row.id} row={row} />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const kind = KINDS[row.kind] ?? { label: row.kind, icon: "info" as IconName, tone: "neutral" as const, group: "loans" as const };
  const amount = row.amount ? BigInt(row.amount) : undefined;

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
      <span
        className={clsx(
          "flex h-9 w-9 items-center justify-center rounded-lg border",
          kind.tone === "frost" && "border-frost-400/30 bg-frost-500/10 text-frost-300",
          kind.tone === "ember" && "border-ember-500/30 bg-ember-500/10 text-ember-400",
          kind.tone === "neutral" && "border-glacier-700 bg-glacier-800 text-mist-300",
        )}
      >
        <Icon name={kind.icon} size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-frostwhite">
          {kind.label}
          {row.loanId && (
            <>
              {" · "}
              <Link href={`/loans/${row.loanId}`} className="text-frost-300 underline-offset-4 hover:underline">
                Loan #{row.loanId}
              </Link>
            </>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-mist-500">
          <span className="tabular">
            {new Date(Number(row.timestamp) * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          <a
            href={`${EXPLORER}/tx/${row.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-frostwhite"
          >
            View transaction
            <Icon name="external" size={11} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </div>
      {amount !== undefined && (
        <span className="tabular whitespace-nowrap text-right text-sm font-medium text-frostwhite">
          {kind.sign ?? ""}
          {formatMusd(amount)} <span className="text-xs font-normal text-mist-500">MUSD</span>
        </span>
      )}
    </li>
  );
}

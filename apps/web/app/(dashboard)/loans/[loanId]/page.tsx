"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { addresses, abis, erc20Abi } from "@/lib/contracts";
import { isConfigured, useApproveThenWrite, useLoan, useLoanDebt, useLoanHealthFactor } from "@/lib/hooks";
import { fetchHarvestHistory, type HarvestRow } from "@/lib/graphql";
import { formatMusd, formatHealthFactor, formatDate, shortAddress } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { DebtMeltChart, type DebtPoint } from "@/components/charts/DebtMeltChart";
import { HarvestBreakdownChart, type HarvestBar } from "@/components/charts/HarvestBreakdownChart";
import { NotConfiguredBanner } from "@/components/ui/NotConfiguredBanner";
import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { projectPayoff } from "@/lib/projection";

export default function LoanDetailPage() {
  const params = useParams<{ loanId: string }>();
  const loanId = BigInt(params.loanId);
  const { address } = useAccount();

  const loan = useLoan(loanId);
  const debt = useLoanDebt(loanId);
  const hf = useLoanHealthFactor(loanId);
  const [harvests, setHarvests] = useState<HarvestRow[]>([]);
  const [repayAmount, setRepayAmount] = useState("");

  useEffect(() => {
    fetchHarvestHistory(params.loanId)
      .then((rows) => setHarvests(rows.slice().reverse()))
      .catch(() => setHarvests([]));
  }, [params.loanId]);

  const loanData = loan.data as
    | {
        adapter: string;
        tokenId: bigint;
        mode: number;
        principal: bigint;
        openedAt: bigint;
        repayShareBps: number;
        aprBps: number;
        borrower: string;
        missedEpochs: number;
        closed: boolean;
        liquidating: boolean;
      }
    | undefined;

  const meltData: DebtPoint[] = (() => {
    if (!loanData) return [];
    let running = Number(loanData.principal) / 1e18;
    for (const h of [...harvests].reverse()) running += Number(h.toDebt) / 1e18;
    const points: DebtPoint[] = [
      { label: formatDate(Number(loanData.openedAt)), timestamp: Number(loanData.openedAt), debt: running },
    ];
    for (const h of harvests) {
      running -= Number(h.toDebt) / 1e18;
      points.push({ label: formatDate(Number(h.timestamp)), timestamp: Number(h.timestamp), debt: Math.max(running, 0) });
    }
    return points;
  })();

  // Weekly paydown for the projection: what recent harvests actually paid, or before the first
  // harvest, RiskEngine's own estimate (income × haircut × repay share).
  const weeklyIncome = useReadContract({
    address: addresses.riskEngine,
    abi: abis.riskEngine,
    functionName: "estimateWeeklyIncomeUSD",
    args: loanData ? [loanData.adapter as `0x${string}`, loanData.tokenId] : undefined,
    query: { enabled: isConfigured && !!loanData },
  });
  const riskConfig = useReadContract({
    address: addresses.riskEngine,
    abi: abis.riskEngine,
    functionName: "configOf",
    args: loanData ? [loanData.adapter as `0x${string}`] : undefined,
    query: { enabled: isConfigured && !!loanData },
  });

  const recent = harvests.slice(-4);
  const observedPaydown = recent.length ? recent.reduce((sum, h) => sum + Number(h.toDebt) / 1e18, 0) / recent.length : 0;
  const haircutBps = (riskConfig.data as { incomeHaircutBps?: number } | undefined)?.incomeHaircutBps ?? 0;
  const estimatedPaydown =
    loanData && weeklyIncome.data !== undefined
      ? ((Number(weeklyIncome.data as bigint) / 1e18) * haircutBps * loanData.repayShareBps) / 1e8
      : 0;
  const weeklyPaydown = observedPaydown || estimatedPaydown;
  const currentDebt = debt.data !== undefined ? Number(debt.data as bigint) / 1e18 : undefined;
  const projection =
    loanData && !loanData.closed && !loanData.liquidating && currentDebt !== undefined
      ? projectPayoff(currentDebt, weeklyPaydown, loanData.aprBps)
      : [];
  const payoffLabel = projection.length ? formatDate(projection[projection.length - 1].timestamp) : undefined;

  const chartData: DebtPoint[] = (() => {
    if (!projection.length || currentDebt === undefined) return meltData;
    const nowSec = Math.floor(Date.now() / 1000);
    return [
      ...meltData,
      { label: "Now", timestamp: nowSec, debt: currentDebt, projected: currentDebt },
      ...projection.map((p) => ({ label: formatDate(p.timestamp), timestamp: p.timestamp, projected: p.debt })),
    ];
  })();

  const harvestBars: HarvestBar[] = harvests.map((h) => ({
    label: `E${h.epoch}`,
    toDebt: Number(h.toDebt) / 1e18,
    surplus: Number(h.surplus) / 1e18,
    overhead: (Number(h.fee) + Number(h.bounty)) / 1e18,
  }));

  const repay = useApproveThenWrite();

  function handleRepay() {
    if (!repayAmount) return;
    const amountWad = BigInt(Math.floor(Number(repayAmount) * 1e18));
    repay.run(
      { address: addresses.musd, abi: erc20Abi, functionName: "approve", args: [addresses.loanManager, amountWad] },
      { address: addresses.loanManager, abi: abis.loanManager as any, functionName: "repay", args: [loanId, amountWad] },
      {
        approve: { pending: "Approving MUSD for repayment", success: "MUSD approved" },
        action: { pending: `Repaying ${repayAmount} MUSD`, success: `Repaid ${repayAmount} MUSD` },
      },
    );
  }

  const isBorrower = address && loanData && address.toLowerCase() === loanData.borrower.toLowerCase();
  const debtValue = debt.data as bigint | undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/portfolio" className="inline-flex min-h-[36px] items-center gap-1.5 text-sm text-mist-400 hover:text-frostwhite">
        <Icon name="arrow-right" size={14} className="rotate-180" />
        Portfolio
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-frostwhite lg:text-4xl">
          Loan #{loanId.toString()}
        </h1>
        {loanData && <Badge tone={loanData.mode === 0 ? "frost" : "ember"}>{loanData.mode === 0 ? "Advance" : "Credit Line"}</Badge>}
        {loanData?.liquidating && (
          <Badge tone="danger" pulse>
            In auction
          </Badge>
        )}
        {loanData?.closed && <Badge tone="neutral">Paid off</Badge>}
      </div>
      {loanData && (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-mist-400">
          <li className="flex items-center gap-1.5">
            <Icon name="lock" size={15} className="text-mist-500" />
            Lock #{loanData.tokenId.toString()}
          </li>
          <li className="flex items-center gap-1.5">
            <Icon name="wallet" size={15} className="text-mist-500" />
            <span className="font-mono text-xs">{shortAddress(loanData.borrower)}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Icon name="calendar" size={15} className="text-mist-500" />
            Opened {formatDate(Number(loanData.openedAt))}
          </li>
        </ul>
      )}

      {!isConfigured && <NotConfiguredBanner />}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Still owed" value={formatMusd(debtValue)} unit="MUSD" tone="frost" />
        <StatTile
          label="Health factor"
          hint="Below 1.00 the position enters a Dutch auction. Advance loans show ∞ until 8 epochs pass with no repayment."
          value={formatHealthFactor(hf.data as bigint | undefined)}
          tone="neutral"
        />
        <StatTile
          label="Rewards to debt"
          hint="Share of each Thursday harvest applied to this loan. The rest is sent to you."
          value={loanData ? `${loanData.repayShareBps / 100}%` : "—"}
          tone="ember"
        />
        <StatTile label="Fixed APR" value={loanData ? `${loanData.aprBps / 100}%` : "—"} tone="neutral" />
      </div>

      <section className="frost-panel mt-8 px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="section-title">Debt over time</h2>
        <div className="mt-4">
          <DebtMeltChart data={chartData} payoffLabel={payoffLabel} />
        </div>
      </section>

      <section className="frost-panel mt-6 px-4 py-5 sm:px-6 sm:py-6">
        <h2 className="section-title">Each Thursday's harvest</h2>
        <div className="mt-4">
          <HarvestBreakdownChart data={harvestBars} />
        </div>
      </section>

      {isBorrower && !loanData?.closed && (
        <section className="frost-panel mt-6 px-4 py-5 sm:px-6 sm:py-6" aria-labelledby="repay-title">
          <h2 id="repay-title" className="section-title">
            Pay some off yourself
          </h2>
          <p className="mt-1.5 text-sm text-mist-400">Optional. Rewards keep repaying the rest every Thursday.</p>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              handleRepay();
            }}
          >
            <label className="field sm:w-64">
              <span className="sr-only">Amount to repay in MUSD</span>
              <input
                inputMode="decimal"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="tabular"
              />
              <span className="text-mist-500">MUSD</span>
            </label>
            <Button type="submit" disabled={!repayAmount || repay.isApproving || repay.isActing}>
              {repay.isApproving ? "Approving MUSD…" : repay.isActing ? "Repaying…" : "Repay MUSD"}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}

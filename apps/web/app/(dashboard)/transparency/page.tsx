"use client";

import { useReadContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { isConfigured, useVaultOverview } from "@/lib/hooks";
import { fetchVaultFlows, type VaultFlowRow } from "@/lib/graphql";
import { useAsync } from "@/lib/useAsync";
import { formatMusd, formatDate } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { AddressChip } from "@/components/ui/AddressChip";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { IndexerError, SkeletonRows } from "@/components/ui/IndexerError";
import { NotConfiguredBanner } from "@/components/ui/NotConfiguredBanner";

const CONTRACTS: { name: string; role: string; address: string | undefined }[] = [
  { name: "LoanManager", role: "Opens, tracks and closes loans", address: addresses.loanManager },
  { name: "ThawEscrow", role: "Holds deposited veNFTs", address: addresses.escrow },
  { name: "TMUSDVault", role: "Lender deposits (ERC-4626)", address: addresses.vault },
  { name: "Harvester", role: "Claims rewards and repays each Thursday", address: addresses.harvester },
  { name: "RiskEngine", role: "Loan limits and health factors", address: addresses.riskEngine },
  { name: "DutchAuctionLiquidator", role: "Sells defaulted Credit Line locks", address: addresses.liquidator },
  { name: "MUSD (test)", role: "Unit of account on testnet", address: addresses.musd },
  { name: "Demo veNFT", role: "Mock lock used for testnet loans", address: addresses.mockVe },
];

export default function TransparencyPage() {
  const vault = useVaultOverview();
  const flows = useAsync<VaultFlowRow[]>(isConfigured ? () => fetchVaultFlows(20) : null, [], []);

  const config = useReadContract({
    address: addresses.riskEngine,
    abi: abis.riskEngine,
    functionName: "configOf",
    args: [addresses.mockAdapter],
    query: { enabled: isConfigured },
  });

  const totalAssets = vault.data?.[0]?.result as bigint | undefined;
  const totalLent = vault.data?.[1]?.result as bigint | undefined;
  const badDebt = vault.data?.[4]?.result as bigint | undefined;
  const cfg = config.data as
    | { advanceWeeks: number; incomeHaircutBps: number; maxLtvBps: number; liqLtvBps: number; protocolFeeBps: number; debtCeiling: bigint }
    | undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Transparency" description="Every risk parameter, every vault movement and every contract, read live from the chain." />

      {!isConfigured && <NotConfiguredBanner />}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatTile label="Vault deposits" value={formatMusd(totalAssets, { compact: true })} unit="MUSD" />
        <StatTile label="Lent to borrowers" value={formatMusd(totalLent, { compact: true })} unit="MUSD" tone="ember" />
        <StatTile
          label="Bad debt to date"
          value={formatMusd(badDebt, { compact: true })}
          unit="MUSD"
          tone={badDebt && badDebt > 0n ? "ember" : "neutral"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <section className="frost-panel mt-6 px-5 py-5 sm:px-6 sm:py-6" aria-labelledby="params">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="params" className="section-title">
            Risk parameters
          </h2>
          <span className="text-xs text-mist-500">Demo collateral (testnet)</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
          <Param label="Advance size" hint="Weeks of counted income a borrower can take up front." value={cfg ? `${cfg.advanceWeeks} weeks` : "—"} />
          <Param label="Income counted" hint="Share of a lock's weekly rewards the risk engine counts toward sizing and paydown." value={cfg ? `${cfg.incomeHaircutBps / 100}%` : "—"} />
          <Param label="Max LTV" hint="The largest Credit Line as a share of the lock's value." value={cfg ? `${cfg.maxLtvBps / 100}%` : "—"} />
          <Param label="Liquidation LTV" hint="Above this, a Credit Line's health factor drops below 1 and it goes to auction." value={cfg ? `${cfg.liqLtvBps / 100}%` : "—"} />
          <Param label="Protocol fee" hint="Taken from each harvest before repayment." value={cfg ? `${cfg.protocolFeeBps / 100}%` : "—"} />
          <Param label="Debt ceiling" hint="Maximum total borrowing against this collateral type." value={cfg ? `${formatMusd(cfg.debtCeiling, { compact: true })} MUSD` : "—"} />
        </dl>
      </section>

      <section className="frost-panel mt-6 px-5 py-5 sm:px-6 sm:py-6" aria-labelledby="flows">
        <h2 id="flows" className="section-title">
          Recent vault activity
        </h2>
        <div className="mt-4">
          {flows.status === "loading" ? (
            <SkeletonRows rows={3} height={44} />
          ) : flows.status === "error" ? (
            <IndexerError what="vault activity" onRetry={flows.retry} />
          ) : flows.data.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-sm text-mist-500">
              <Icon name="clock" size={16} />
              No deposits, loans or repayments yet. They'll show up here as they happen.
            </p>
          ) : (
            <ul className="divide-y divide-glacier-700">
              {flows.data.map((f) => {
                const kind = FLOW_KINDS[f.kind] ?? { label: f.kind, icon: "coins" as IconName };
                return (
                  <li key={f.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 text-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-glacier-700 bg-glacier-800 text-mist-300">
                      <Icon name={kind.icon} size={15} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-frostwhite">{kind.label}</div>
                      <div className="tabular text-xs text-mist-500">{formatDate(Number(f.timestamp))}</div>
                    </div>
                    <span className="tabular font-medium text-frostwhite">
                      {formatMusd(BigInt(f.amount))} <span className="text-xs font-normal text-mist-500">MUSD</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="contracts">
        <h2 id="contracts" className="section-title">
          Contracts on Mezo testnet
        </h2>
        <ul className="frost-panel mt-4 divide-y divide-glacier-700">
          {CONTRACTS.map((c) => (
            <li key={c.name} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-frostwhite">{c.name}</div>
                <div className="text-xs text-mist-500">{c.role}</div>
              </div>
              <AddressChip address={c.address} label={c.name} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const FLOW_KINDS: Record<string, { label: string; icon: IconName }> = {
  lend: { label: "Lent to a loan", icon: "coins" },
  repay: { label: "Repayment received", icon: "drop" },
  bad_debt: { label: "Bad debt realized", icon: "warning" },
  park_msr: { label: "Moved to Savings Rate", icon: "lock" },
  pull_msr: { label: "Pulled from Savings Rate", icon: "lock" },
};

function Param({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-mist-400">
        {label}
        <Tooltip content={hint} label={`About ${label.toLowerCase()}`} />
      </dt>
      <dd className="tabular mt-1 text-lg font-semibold text-frostwhite">{value}</dd>
    </div>
  );
}

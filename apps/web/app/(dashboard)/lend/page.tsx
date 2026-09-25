"use client";

import { useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import { addresses, abis, erc20Abi } from "@/lib/contracts";
import { isConfigured, useApproveThenWrite, useMusdBalance, useVaultOverview, useVaultShareBalance } from "@/lib/hooks";
import { formatMusd } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { NotConfiguredBanner } from "@/components/ui/NotConfiguredBanner";

export default function LendPage() {
  const { address, isConnected } = useAccount();
  const [action, setAction] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");

  const vault = useVaultOverview();
  const musdBalance = useMusdBalance(address);
  const shareBalance = useVaultShareBalance(address);

  const totalAssets = vault.data?.[0]?.result as bigint | undefined;
  const totalLent = vault.data?.[1]?.result as bigint | undefined;
  const idle = vault.data?.[3]?.result as bigint | undefined;
  const badDebt = vault.data?.[4]?.result as bigint | undefined;

  const utilization =
    totalAssets && totalAssets > 0n && totalLent !== undefined ? Number((totalLent * 10000n) / totalAssets) / 100 : undefined;

  const deposit = useApproveThenWrite();
  const { writeContract: writeRedeem, data: redeemHash, error: redeemError } = useWriteContract();
  const redeemReceipt = useWaitForTransactionReceipt({ hash: redeemHash });

  const wallet = musdBalance.data as bigint | undefined;
  const shares = shareBalance.data as bigint | undefined;
  const amountNum = Number(amount || 0);
  const overBalance = wallet !== undefined && amountNum > Number(formatUnits(wallet, 18));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;

    if (action === "deposit") {
      if (!amount || overBalance) return;
      const amountWad = BigInt(Math.floor(amountNum * 1e18));
      deposit.run(
        { address: addresses.musd, abi: erc20Abi, functionName: "approve", args: [addresses.vault, amountWad] },
        { address: addresses.vault, abi: abis.vault as any, functionName: "deposit", args: [amountWad, address] },
      );
    } else {
      writeRedeem({
        address: addresses.vault,
        abi: abis.vault as any,
        functionName: "requestRedeem",
        args: [shares ?? 0n, address],
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Lend"
        description="Deposit MUSD into the tMUSD vault. It's lent to borrowers whose locks repay them every Thursday."
      />

      {!isConfigured && <NotConfiguredBanner />}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Vault deposits" value={formatMusd(totalAssets, { compact: true })} unit="MUSD" />
        <StatTile
          label="Utilization"
          value={utilization !== undefined ? `${utilization.toFixed(0)}%` : "—"}
          hint="Share of deposits currently lent out to open loans."
          tone="ember"
        />
        <StatTile
          label="Available now"
          value={formatMusd(idle, { compact: true })}
          unit="MUSD"
          tone="neutral"
          hint="Idle MUSD you can withdraw instantly. It earns the MUSD Savings Rate while it waits."
        />
        <StatTile
          label="Bad debt to date"
          value={formatMusd(badDebt, { compact: true })}
          unit="MUSD"
          hint="Losses absorbed by the vault when an auction didn't fully cover a defaulted loan."
          tone={badDebt && badDebt > 0n ? "ember" : "neutral"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="frost-panel p-5 sm:p-6" aria-labelledby="vault-action">
          <h2 id="vault-action" className="sr-only">
            {action === "deposit" ? "Deposit MUSD" : "Withdraw MUSD"}
          </h2>
          <SegmentedControl
            options={[
              { value: "deposit" as const, label: "Deposit" },
              { value: "withdraw" as const, label: "Withdraw" },
            ]}
            value={action}
            onChange={setAction}
          />

          {!isConnected ? (
            <div className="mt-8 flex flex-col items-start gap-4">
              <p className="text-sm text-mist-400">Connect a wallet to deposit or withdraw.</p>
              <ConnectButton label="Connect wallet" />
            </div>
          ) : action === "deposit" ? (
            <form onSubmit={handleSubmit} className="mt-6">
              <div className="flex items-baseline justify-between text-sm">
                <label htmlFor="deposit-amount" className="text-mist-300">
                  Amount
                </label>
                <span className="text-xs text-mist-500">
                  In wallet: <span className="tabular text-mist-300">{formatMusd(wallet)} MUSD</span>
                </span>
              </div>
              <div className="field mt-2 !py-1.5 !pr-1.5">
                <input
                  id="deposit-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  aria-invalid={overBalance}
                  aria-describedby={overBalance ? "deposit-error" : undefined}
                  className="tabular !py-2 font-display text-2xl font-semibold"
                />
                <span className="text-sm text-mist-400">MUSD</span>
                <button
                  type="button"
                  onClick={() => wallet !== undefined && setAmount(formatUnits(wallet, 18))}
                  disabled={!wallet}
                  className="min-h-[36px] rounded-lg bg-frost-400/10 px-3 text-xs font-medium text-frost-200 transition-colors hover:bg-frost-400/20 disabled:opacity-40"
                >
                  Max
                </button>
              </div>
              {overBalance && (
                <p id="deposit-error" className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                  <Icon name="warning" size={14} />
                  That's more MUSD than this wallet holds.
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="mt-5 w-full"
                disabled={!amountNum || overBalance || deposit.isApproving || deposit.isActing}
              >
                {deposit.isApproving ? "Approving MUSD…" : deposit.isActing ? "Depositing…" : "Deposit MUSD"}
              </Button>
              <p className="mt-3 text-xs leading-relaxed text-mist-500">
                Your wallet asks twice: once to let the vault use this MUSD, then to deposit it. You get tMUSD shares back.
              </p>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6">
              <div className="rounded-xl bg-glacier-900/60 px-4 py-4">
                <div className="text-xs text-mist-400">Your tMUSD shares</div>
                <div className="tabular mt-1 font-display text-2xl font-semibold text-frostwhite">{formatMusd(shares)}</div>
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-mist-400">
                <Icon name="clock" size={14} className="mt-0.5 text-frost-300" />
                Withdrawals up to the available amount arrive right away. Anything beyond that joins a queue and fills from
                the next Thursday's harvest.
              </p>
              {redeemError && (
                <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-danger">
                  <Icon name="warning" size={14} />
                  The withdrawal didn't go through. Check your wallet and try again.
                </p>
              )}
              {redeemReceipt.isSuccess && (
                <p role="status" className="mt-3 flex items-center gap-1.5 text-xs text-frost-200">
                  <Icon name="check" size={14} />
                  Withdrawal requested.
                </p>
              )}
              <Button type="submit" size="lg" className="mt-5 w-full" disabled={!shares || redeemReceipt.isLoading}>
                {redeemReceipt.isLoading ? "Requesting…" : "Withdraw everything"}
              </Button>
            </form>
          )}
        </section>

        <section aria-labelledby="yield-sources" className="px-1 lg:pt-2">
          <h2 id="yield-sources" className="section-title">
            Where the yield comes from
          </h2>
          <ul className="mt-5 space-y-5">
            <YieldSource icon="coins" title="Loan interest">
              Borrowers pay a fixed APR on what they owe, straight into the vault.
            </YieldSource>
            <YieldSource icon="drop" title="A share of every harvest">
              Part of each Thursday's claimed bribes and fees goes to lenders, not just the borrower's debt.
            </YieldSource>
            <YieldSource icon="shield" title="Savings Rate on idle MUSD">
              Whatever isn't lent out sits in the MUSD Savings Rate, so nothing is ever sitting still.
            </YieldSource>
          </ul>
        </section>
      </div>
    </div>
  );
}

function YieldSource({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-glacier-600 text-frost-300">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <h3 className="text-sm font-medium text-frostwhite">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-mist-400">{children}</p>
      </div>
    </li>
  );
}

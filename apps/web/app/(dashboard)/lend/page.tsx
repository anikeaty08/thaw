"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Abi } from "viem";
import { fetchLender, type LenderRow } from "@/lib/graphql";
import { useAsync } from "@/lib/useAsync";
import { useToast, describeTxError, type TxLabels } from "@/components/providers/ToastProvider";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
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
  const toast = useToast();
  const { writeContract: writeRedeem, data: redeemHash, error: redeemError } = useWriteContract({
    mutation: { onError: (e) => toast.fail("Withdrawal not sent", describeTxError(e)) },
  });
  const redeemReceipt = useWaitForTransactionReceipt({ hash: redeemHash });
  const redeemLabels = useRef<TxLabels | null>(null);

  useEffect(() => {
    if (redeemHash && redeemLabels.current) toast.track(redeemHash, redeemLabels.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redeemHash]);

  const wallet = musdBalance.data as bigint | undefined;
  const shares = shareBalance.data as bigint | undefined;

  // What the lender's shares are worth, and how much of that can leave right now. `redeem` pays
  // instantly up to idle liquidity (maxRedeem); `requestRedeem` queues the rest for the next harvest.
  const position = useReadContracts({
    contracts: [
      { address: addresses.vault, abi: abis.vault as Abi, functionName: "convertToAssets", args: [shares ?? 0n] },
      { address: addresses.vault, abi: abis.vault as Abi, functionName: "maxRedeem", args: [address ?? addresses.vault] },
    ],
    query: { enabled: isConfigured && !!address && shares !== undefined, refetchInterval: 15_000 },
  });
  const positionValue = position.data?.[0]?.result as bigint | undefined;
  const instantShares = (position.data?.[1]?.result as bigint | undefined) ?? 0n;
  const queuedShares = shares !== undefined && shares > instantShares ? shares - instantShares : 0n;
  const instantValue = positionValue !== undefined && shares ? (positionValue * instantShares) / shares : undefined;
  const queuedValue = positionValue !== undefined && instantValue !== undefined ? positionValue - instantValue : undefined;

  const lender = useAsync<LenderRow | null>(address && isConfigured ? () => fetchLender(address) : null, null, [address, deposit.isDone, redeemReceipt.isSuccess]);
  const netDeposited = lender.data ? BigInt(lender.data.deposited) - BigInt(lender.data.withdrawn) : undefined;
  const earned = positionValue !== undefined && netDeposited !== undefined ? positionValue - netDeposited : undefined;

  function withdraw(kind: "now" | "queue") {
    if (!address) return;
    if (kind === "now") {
      redeemLabels.current = { pending: `Withdrawing ${formatMusd(instantValue)} MUSD`, success: `Withdrew ${formatMusd(instantValue)} MUSD` };
      writeRedeem({ address: addresses.vault, abi: abis.vault as Abi, functionName: "redeem", args: [instantShares, address, address] });
    } else {
      redeemLabels.current = {
        pending: `Queueing ${formatMusd(queuedValue)} MUSD`,
        success: "Withdrawal queued",
        successBody: "It pays out from the next Thursday's harvest inflow.",
      };
      writeRedeem({ address: addresses.vault, abi: abis.vault as Abi, functionName: "requestRedeem", args: [queuedShares, address] });
    }
  }
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
        {
          approve: { pending: "Approving MUSD for the vault", success: "MUSD approved" },
          action: { pending: `Depositing ${amount} MUSD`, success: `Deposited ${amount} MUSD`, successBody: "Your tMUSD shares are in your wallet." },
        },
      );
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

      {isConnected && !!shares && <PositionStrip value={positionValue} netDeposited={netDeposited} earned={earned} />}

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
          ) : !shares ? (
            <p className="mt-6 text-sm text-mist-400">You don't have anything in the vault yet. Deposit first, then withdraw here.</p>
          ) : (
            <div className="mt-6 space-y-3">
              <WithdrawRow
                title="Available now"
                note="Paid from idle MUSD in this transaction."
                value={instantValue}
                button={redeemReceipt.isLoading ? "Withdrawing…" : "Withdraw now"}
                disabled={instantShares === 0n || redeemReceipt.isLoading}
                onClick={() => withdraw("now")}
              />
              {queuedShares > 0n && (
                <WithdrawRow
                  title="Lent out right now"
                  note="Queue it and it pays out from the next Thursday's harvest."
                  value={queuedValue}
                  button="Queue withdrawal"
                  variant="secondary"
                  disabled={redeemReceipt.isLoading}
                  onClick={() => withdraw("queue")}
                />
              )}
              {redeemError && (
                <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
                  <Icon name="warning" size={14} />
                  The withdrawal didn't go through. Check your wallet and try again.
                </p>
              )}
            </div>
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

function WithdrawRow({
  title,
  note,
  value,
  button,
  onClick,
  disabled,
  variant = "primary",
}: {
  title: string;
  note: string;
  value: bigint | undefined;
  button: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-glacier-700 bg-glacier-950/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xs text-mist-400">{title}</div>
        <div className="tabular mt-0.5 text-xl font-semibold text-frostwhite">
          {formatMusd(value)} <span className="text-xs font-normal text-mist-500">MUSD</span>
        </div>
        <p className="mt-0.5 text-xs text-mist-500">{note}</p>
      </div>
      <Button onClick={onClick} disabled={disabled} variant={variant} className="w-full shrink-0 sm:w-auto">
        {button}
      </Button>
    </div>
  );
}

function PositionStrip({ value, netDeposited, earned }: { value: bigint | undefined; netDeposited: bigint | undefined; earned: bigint | undefined }) {
  const positive = earned !== undefined && earned >= 0n;
  return (
    <section aria-label="Your position" className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-glacier-700 bg-glacier-700 shadow-frost sm:grid-cols-3">
      <Cell label="Your deposit is worth" value={`${formatMusd(value)} MUSD`} />
      <Cell label="You put in (net)" value={netDeposited !== undefined ? `${formatMusd(netDeposited)} MUSD` : "—"} />
      <Cell
        label="Earned so far"
        value={earned !== undefined ? `${positive ? "+" : "−"}${formatMusd(positive ? earned : -earned)} MUSD` : "—"}
        tone={earned === undefined ? undefined : positive ? "text-success" : "text-danger"}
      />
    </section>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-glacier-900 px-5 py-4">
      <div className="text-xs text-mist-400">{label}</div>
      <div className={clsx("tabular mt-1 text-xl font-semibold", tone ?? "text-frostwhite")}>{value}</div>
    </div>
  );
}

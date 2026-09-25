"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { addresses, abis, erc721Abi } from "@/lib/contracts";
import { useMaxBorrow, isConfigured } from "@/lib/hooks";
import { formatMusd, bpsToPercent } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Slider } from "@/components/ui/Slider";
import { Icon } from "@/components/ui/Icon";

type Mode = "advance" | "creditLine";
type Step = "configure" | "approving" | "approved" | "borrowing" | "done";

const WAD = 10n ** 18n;

export function BorrowDrawer({ tokenId, onClose }: { tokenId: bigint; onClose: () => void }) {
  const { address } = useAccount();
  const [mode, setMode] = useState<Mode>("advance");
  const [amountWad, setAmountWad] = useState(0n);
  const [repayShareBps, setRepayShareBps] = useState(10000);
  const [step, setStep] = useState<Step>("configure");

  const modeIndex = mode === "advance" ? 0 : 1;
  const maxBorrow = useMaxBorrow(addresses.mockAdapter, tokenId, modeIndex as 0 | 1);
  const cap = (maxBorrow.data as bigint) ?? 0n;

  const weeklyIncome = useReadContract({
    address: addresses.riskEngine,
    abi: abis.riskEngine,
    functionName: "estimateWeeklyIncomeUSD",
    args: [addresses.mockAdapter, tokenId],
    query: { enabled: isConfigured },
  });

  const collateralValue = useReadContract({
    address: addresses.mockAdapter,
    abi: abis.mockAdapter,
    functionName: "collateralValueUSD",
    args: [tokenId],
    query: { enabled: isConfigured },
  });

  const config = useReadContract({
    address: addresses.riskEngine,
    abi: abis.riskEngine,
    functionName: "configOf",
    args: [addresses.mockAdapter],
    query: { enabled: isConfigured },
  });

  const capNum = Number(cap) / 1e18;
  const amountNum = Number(amountWad) / 1e18;

  const payoffWeeks = useMemo(() => {
    const iw = weeklyIncome.data as bigint | undefined;
    if (!iw || iw === 0n || amountWad === 0n) return null;
    const weeklyPaydown = (Number(iw) / 1e18) * (repayShareBps / 10000);
    if (weeklyPaydown <= 0) return null;
    return Math.ceil(amountNum / weeklyPaydown);
  }, [weeklyIncome.data, amountWad, repayShareBps, amountNum]);

  const projectedHF = useMemo(() => {
    if (mode !== "creditLine" || amountWad === 0n || !collateralValue.data || !config.data) return null;
    const v = collateralValue.data as bigint;
    const liqLtvBps = (config.data as any).liqLtvBps as number;
    const hf = (v * BigInt(liqLtvBps) * WAD) / (10000n * amountWad);
    return Number(hf) / 1e18;
  }, [mode, amountWad, collateralValue.data, config.data]);

  // --- approve + borrow ---
  const approveNftApproved = useReadContract({
    address: addresses.mockVe,
    abi: erc721Abi,
    functionName: "getApproved",
    args: [tokenId],
    query: { enabled: isConfigured },
  });

  const { writeContract: writeApprove, data: approveHash, error: approveError, reset: resetApprove } = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveHash });

  const { writeContract: writeBorrow, data: borrowHash, error: borrowError, reset: resetBorrow } = useWriteContract();
  const txError = approveError ?? borrowError;

  // A rejected or failed wallet prompt drops the flow back to the form.
  useEffect(() => {
    if (txError) setStep("configure");
  }, [txError]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const borrowReceipt = useWaitForTransactionReceipt({ hash: borrowHash });

  useEffect(() => {
    if (approveReceipt.isSuccess) setStep("approved");
  }, [approveReceipt.isSuccess]);

  useEffect(() => {
    if (borrowReceipt.isSuccess) setStep("done");
  }, [borrowReceipt.isSuccess]);

  const alreadyApproved =
    (approveNftApproved.data as string | undefined)?.toLowerCase() === addresses.escrow.toLowerCase();

  function handleSubmit() {
    resetApprove();
    resetBorrow();
    if (!alreadyApproved) {
      setStep("approving");
      writeApprove({ address: addresses.mockVe, abi: erc721Abi, functionName: "approve", args: [addresses.escrow, tokenId] });
      return;
    }
    submitBorrow();
  }

  function submitBorrow() {
    setStep("borrowing");
    writeBorrow({
      address: addresses.loanManager,
      abi: abis.loanManager,
      functionName: "openLoan",
      args: [addresses.mockAdapter, tokenId, modeIndex, amountWad, repayShareBps],
    });
  }

  useEffect(() => {
    if (step === "approved") submitBorrow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 bg-glacier-950/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrow-title"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-3xl border-t border-glacier-700 bg-glacier-900 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0 sm:px-7 sm:py-8"
        initial={{ x: 0, y: "100%" }}
        animate={{ x: 0, y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <span className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-glacier-600 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-mist-400">
              <Icon name="lock" size={14} className="text-frost-300" />
              Lock #{tokenId.toString()}
            </div>
            <h2 id="borrow-title" className="mt-1 font-display text-2xl font-semibold text-frostwhite">
              Set up your loan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-mist-400 transition-colors hover:bg-glacier-800 hover:text-frostwhite"
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {step === "done" ? (
          <DoneState onClose={onClose} />
        ) : (
          <>
            <div className="mt-6">
              <SegmentedControl
                options={[
                  { value: "advance" as Mode, label: "Advance" },
                  { value: "creditLine" as Mode, label: "Credit Line" },
                ]}
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setAmountWad(0n);
                }}
              />
              <p className="mt-3 text-xs leading-relaxed text-mist-400">
                {mode === "advance"
                  ? "Sized by trailing income. Never price-liquidated — if rewards drop, the loan just extends."
                  : "Sized by collateral value. Larger loans; falls into a Dutch auction if health factor drops below 1."}
              </p>
            </div>

            <div className="mt-8">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-mist-300">Borrow amount</span>
                <span className="tabular font-display text-xl font-semibold text-frostwhite">{amountNum.toFixed(0)} MUSD</span>
              </div>
              <div className="mt-3">
                <Slider
                  min={0}
                  max={Math.max(capNum, 1)}
                  step={Math.max(capNum / 100, 1)}
                  value={amountNum}
                  onChange={(v) => setAmountWad(BigInt(Math.floor(v * 1e18)))}
                  ariaLabel="Borrow amount"
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-mist-500">
                <span>0</span>
                <span>max {capNum.toFixed(0)} MUSD</span>
              </div>
            </div>

            {mode === "advance" && (
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-mist-300">Repay share</span>
                  <span className="tabular font-display text-xl font-semibold text-frostwhite">{bpsToPercent(repayShareBps)}</span>
                </div>
                <p className="mt-1 text-xs text-mist-500">Share of each harvest applied to your debt. The rest is yours.</p>
                <div className="mt-3">
                  <Slider min={5000} max={10000} step={500} value={repayShareBps} onChange={setRepayShareBps} ariaLabel="Repay share" />
                </div>
              </div>
            )}

            <div className="mt-8 space-y-3 border-t border-glacier-700 pt-6">
              {mode === "advance" ? (
                <Row label="Estimated payoff" value={payoffWeeks ? `${payoffWeeks} week${payoffWeeks === 1 ? "" : "s"}` : "—"} />
              ) : (
                <Row
                  label="Health factor after borrow"
                  value={projectedHF ? projectedHF.toFixed(2) : "—"}
                  tone={projectedHF && projectedHF < 1.2 ? "ember" : "frost"}
                />
              )}
              <Row label="Fixed APR" value="6%" />
            </div>

            {txError && (
              <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/[0.06] px-4 py-3 text-sm text-mist-300">
                <Icon name="warning" size={16} className="mt-0.5 text-danger" />
                <span>
                  {txError.message.toLowerCase().includes("reject")
                    ? "You declined the request in your wallet. Nothing was sent, so you can try again."
                    : "The transaction didn't go through. Check your wallet and network, then try again."}
                </span>
              </div>
            )}

            <div className="mt-auto pt-8">
              <Button size="lg" className="w-full" disabled={amountWad === 0n || step === "approving" || step === "borrowing"} onClick={handleSubmit}>
                {step === "approving"
                  ? "Approving…"
                  : step === "borrowing"
                    ? "Borrowing…"
                    : alreadyApproved
                      ? "Borrow"
                      : "Approve & borrow"}
              </Button>
            </div>
          </>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}

function Row({ label, value, tone = "frost" }: { label: string; value: string; tone?: "frost" | "ember" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-mist-400">{label}</span>
      <span className={clsx("tabular font-medium", tone === "ember" ? "text-ember-400" : "text-frost-200")}>{value}</span>
    </div>
  );
}

function DoneState({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ember-500/15 text-ember-400">
        <Icon name="check" size={26} />
      </div>
      <p className="mt-2 font-display text-xl font-semibold text-frostwhite">
        MUSD is in your wallet
      </p>
      <p className="max-w-xs text-sm leading-relaxed text-mist-400">
        Your first repayment comes from next Thursday's harvest, at 00:05 UTC. You don't need to do anything.
      </p>
      <Button variant="secondary" onClick={onClose} className="mt-4">
        Done
      </Button>
    </div>
  );
}

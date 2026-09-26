"use client";

import { useToast, describeTxError, type TxLabels } from "@/components/providers/ToastProvider";
import { useEffect, useRef } from "react";
import { useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Abi } from "viem";
import { addresses, abis, erc20Abi, faucetAbi, mockVeAbi } from "./contracts";
import type { Address } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";
export const isConfigured = addresses.loanManager !== ZERO;

export function useLoan(loanId: bigint | undefined) {
  return useReadContract({
    address: addresses.loanManager,
    abi: abis.loanManager,
    functionName: "getLoan",
    args: loanId !== undefined ? [loanId] : undefined,
    query: { enabled: isConfigured && loanId !== undefined },
  });
}

export function useLoanDebt(loanId: bigint | undefined) {
  return useReadContract({
    address: addresses.loanManager,
    abi: abis.loanManager,
    functionName: "debtOf",
    args: loanId !== undefined ? [loanId] : undefined,
    query: { enabled: isConfigured && loanId !== undefined, refetchInterval: 30_000 },
  });
}

export function useLoanHealthFactor(loanId: bigint | undefined) {
  return useReadContract({
    address: addresses.loanManager,
    abi: abis.loanManager,
    functionName: "healthFactor",
    args: loanId !== undefined ? [loanId] : undefined,
    query: { enabled: isConfigured && loanId !== undefined, refetchInterval: 30_000 },
  });
}

export function useMaxBorrow(adapter: Address | undefined, tokenId: bigint | undefined, mode: 0 | 1) {
  return useReadContract({
    address: addresses.riskEngine,
    abi: abis.riskEngine,
    functionName: "maxBorrowTotal",
    args: adapter && tokenId !== undefined ? [adapter, tokenId, mode] : undefined,
    query: { enabled: isConfigured && !!adapter && tokenId !== undefined },
  });
}

export function useVaultOverview() {
  return useReadContracts({
    contracts: [
      { address: addresses.vault, abi: abis.vault, functionName: "totalAssets" },
      { address: addresses.vault, abi: abis.vault, functionName: "totalLent" },
      { address: addresses.vault, abi: abis.vault, functionName: "totalSupply" },
      { address: addresses.vault, abi: abis.vault, functionName: "idleLiquidity" },
      { address: addresses.vault, abi: abis.vault, functionName: "badDebtProvision" },
    ],
    query: { enabled: isConfigured, refetchInterval: 30_000 },
  });
}

export function useMusdBalance(account: Address | undefined) {
  return useReadContract({
    address: addresses.musd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: isConfigured && !!account, refetchInterval: 15_000 },
  });
}

export function useVaultShareBalance(account: Address | undefined) {
  return useReadContract({
    address: addresses.vault,
    abi: abis.vault,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: isConfigured && !!account, refetchInterval: 15_000 },
  });
}

interface ContractCall {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}

/// ERC-20/721 `approve` only takes effect once mined, so the dependent call must wait for the
/// approve *receipt* — firing it on the write's own submission callback races the RPC's gas
/// estimation (which simulates against the latest mined block, not the pending approve).
/// Each step is reported through the toast system when `run` is given labels.
export function useApproveThenWrite() {
  const toast = useToast();
  const labels = useRef<ApproveThenWriteLabels | null>(null);
  const onError = (error: unknown) => {
    pendingAction.current = null;
    toast.fail("Transaction not sent", describeTxError(error));
  };

  const { writeContract: writeApprove, data: approveHash, reset: resetApprove } = useWriteContract({ mutation: { onError } });
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveHash });

  const { writeContract: writeAction, data: actionHash, reset: resetAction } = useWriteContract({ mutation: { onError } });
  const actionReceipt = useWaitForTransactionReceipt({ hash: actionHash });

  const pendingAction = useRef<ContractCall | null>(null);

  useEffect(() => {
    if (approveHash && labels.current) toast.track(approveHash, labels.current.approve);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveHash]);

  useEffect(() => {
    if (actionHash && labels.current) toast.track(actionHash, labels.current.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionHash]);

  useEffect(() => {
    if (approveReceipt.isSuccess && pendingAction.current) {
      const action = pendingAction.current;
      pendingAction.current = null;
      writeAction(action as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveReceipt.isSuccess]);

  function run(approveCall: ContractCall, actionCall: ContractCall, stepLabels?: ApproveThenWriteLabels) {
    labels.current = stepLabels ?? null;
    resetApprove();
    resetAction();
    pendingAction.current = actionCall;
    writeApprove(approveCall as any);
  }

  function reset() {
    pendingAction.current = null;
    resetApprove();
    resetAction();
  }

  return {
    run,
    reset,
    isApproving: !!approveHash && approveReceipt.isPending,
    isActing: !!actionHash && actionReceipt.isPending,
    isDone: actionReceipt.isSuccess,
    error: actionReceipt.isError ? actionReceipt.error : undefined,
  };
}

export interface ApproveThenWriteLabels {
  approve: TxLabels;
  action: TxLabels;
}

const MAX_LOCK_SCAN = 500;

export interface OwnedLock {
  tokenId: bigint;
  maxAdvance: bigint | undefined;
  maxCreditLine: bigint | undefined;
}

/**
 * Locks the wallet holds right now (locks already in a loan sit in escrow and show as loans).
 * The mock veNFT isn't enumerable, so this reads `nextId` and batches `ownerOf` over every id,
 * which is cheap on testnet. Swap for the indexer once real veMEZO/veBTC are wired.
 */
export function useOwnedLocks(owner: Address | undefined) {
  const enabled = isConfigured && !!owner && addresses.mockVe !== ZERO;

  const nextId = useReadContract({
    address: addresses.mockVe,
    abi: mockVeAbi,
    functionName: "nextId",
    query: { enabled, refetchInterval: 20_000 },
  });

  const count = Math.min(Number((nextId.data as bigint | undefined) ?? 1n) - 1, MAX_LOCK_SCAN);
  const ids = Array.from({ length: Math.max(count, 0) }, (_, i) => BigInt(i + 1));

  const owners = useReadContracts({
    contracts: ids.map((id) => ({ address: addresses.mockVe, abi: mockVeAbi, functionName: "ownerOf" as const, args: [id] })),
    query: { enabled: enabled && ids.length > 0, refetchInterval: 20_000 },
  });

  const mine = ids.filter((_, i) => {
    const o = owners.data?.[i]?.result as string | undefined;
    return !!o && !!owner && o.toLowerCase() === owner.toLowerCase();
  });

  const limits = useReadContracts({
    contracts: mine.flatMap((id) => [
      { address: addresses.riskEngine, abi: abis.riskEngine as Abi, functionName: "maxBorrowTotal", args: [addresses.mockAdapter, id, 0] },
      { address: addresses.riskEngine, abi: abis.riskEngine as Abi, functionName: "maxBorrowTotal", args: [addresses.mockAdapter, id, 1] },
    ]),
    query: { enabled: mine.length > 0 },
  });

  const locks: OwnedLock[] = mine.map((tokenId, i) => ({
    tokenId,
    maxAdvance: limits.data?.[i * 2]?.result as bigint | undefined,
    maxCreditLine: limits.data?.[i * 2 + 1]?.result as bigint | undefined,
  }));

  return {
    locks,
    isLoading: enabled && (nextId.isLoading || owners.isLoading),
    isError: nextId.isError || owners.isError,
    refetch: () => {
      nextId.refetch();
      owners.refetch();
    },
  };
}

/** Testnet faucet: one drip per wallet per cooldown. */
export function useFaucet(account: Address | undefined) {
  const toast = useToast();
  const available = addresses.faucet !== ZERO;

  const nextDripAt = useReadContract({
    address: addresses.faucet,
    abi: faucetAbi,
    functionName: "nextDripAt",
    args: account ? [account] : undefined,
    query: { enabled: available && !!account, refetchInterval: 30_000 },
  });

  const { writeContract, data: hash, isPending } = useWriteContract({
    mutation: { onError: (e) => toast.fail("Test tokens not sent", describeTxError(e)) },
  });
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (hash)
      toast.track(hash, {
        pending: "Sending test tokens",
        success: "1,000 MUSD and a demo lock are in your wallet",
        successBody: "The lock earns 60 MUSD a week. Pick it below to borrow.",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  useEffect(() => {
    if (receipt.isSuccess) nextDripAt.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  const readyAt = Number((nextDripAt.data as bigint | undefined) ?? 0n);

  return {
    available,
    readyAt,
    isBusy: isPending || (!!hash && receipt.isPending),
    isDone: receipt.isSuccess,
    drip: () => writeContract({ address: addresses.faucet, abi: faucetAbi, functionName: "drip" }),
  };
}

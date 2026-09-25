"use client";

import { useEffect, useRef } from "react";
import { useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Abi } from "viem";
import { addresses, abis, erc20Abi } from "./contracts";
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
export function useApproveThenWrite() {
  const { writeContract: writeApprove, data: approveHash, reset: resetApprove } = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveHash });

  const { writeContract: writeAction, data: actionHash, reset: resetAction } = useWriteContract();
  const actionReceipt = useWaitForTransactionReceipt({ hash: actionHash });

  const pendingAction = useRef<ContractCall | null>(null);

  useEffect(() => {
    if (approveReceipt.isSuccess && pendingAction.current) {
      const action = pendingAction.current;
      pendingAction.current = null;
      writeAction(action as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveReceipt.isSuccess]);

  function run(approveCall: ContractCall, actionCall: ContractCall) {
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

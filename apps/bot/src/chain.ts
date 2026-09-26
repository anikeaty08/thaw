import { createPublicClient, http, defineChain } from "viem";
import { config } from "./config.js";
import LoanManagerAbi from "./abis/LoanManager.json" with { type: "json" };

export const mezoTestnet = defineChain({
  id: config.chainId,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
});

export const publicClient = createPublicClient({ chain: mezoTestnet, transport: http(config.rpcUrl) });
export const loanManagerAbi = LoanManagerAbi;

export async function readLoan(loanId: bigint) {
  return publicClient.readContract({
    address: config.loanManagerAddress,
    abi: loanManagerAbi,
    functionName: "getLoan",
    args: [loanId],
  });
}

export async function readDebt(loanId: bigint): Promise<bigint> {
  return publicClient.readContract({
    address: config.loanManagerAddress,
    abi: loanManagerAbi,
    functionName: "debtOf",
    args: [loanId],
  }) as Promise<bigint>;
}

export async function readHealthFactor(loanId: bigint): Promise<bigint> {
  return publicClient.readContract({
    address: config.loanManagerAddress,
    abi: loanManagerAbi,
    functionName: "healthFactor",
    args: [loanId],
  }) as Promise<bigint>;
}

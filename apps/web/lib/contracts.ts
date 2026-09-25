import type { Address } from "viem";

import LoanManagerAbi from "./abis/LoanManager.json";
import HarvesterAbi from "./abis/Harvester.json";
import TMUSDVaultAbi from "./abis/TMUSDVault.json";
import DutchAuctionLiquidatorAbi from "./abis/DutchAuctionLiquidator.json";
import RiskEngineAbi from "./abis/RiskEngine.json";
import MockVeAdapterAbi from "./abis/MockVeAdapter.json";

function addr(env: string | undefined): Address {
  return (env ?? "0x0000000000000000000000000000000000000000") as Address;
}

export const addresses = {
  loanManager: addr(process.env.NEXT_PUBLIC_LOAN_MANAGER_ADDRESS),
  // ThawEscrow pulls the veNFT inside openLoan, so the NFT approval must go to it, not LoanManager.
  escrow: addr(process.env.NEXT_PUBLIC_ESCROW_ADDRESS),
  harvester: addr(process.env.NEXT_PUBLIC_HARVESTER_ADDRESS),
  vault: addr(process.env.NEXT_PUBLIC_TMUSD_VAULT_ADDRESS),
  liquidator: addr(process.env.NEXT_PUBLIC_DUTCH_AUCTION_LIQUIDATOR_ADDRESS),
  riskEngine: addr(process.env.NEXT_PUBLIC_RISK_ENGINE_ADDRESS),
  musd: addr(process.env.NEXT_PUBLIC_MUSD_ADDRESS),
  mockAdapter: addr(process.env.NEXT_PUBLIC_MOCK_ADAPTER_ADDRESS),
  mockVe: addr(process.env.NEXT_PUBLIC_MOCK_VE_ADDRESS),
} as const;

export const abis = {
  loanManager: LoanManagerAbi,
  harvester: HarvesterAbi,
  vault: TMUSDVaultAbi,
  liquidator: DutchAuctionLiquidatorAbi,
  riskEngine: RiskEngineAbi,
  mockAdapter: MockVeAdapterAbi,
} as const;

// Minimal ERC-20/721 surfaces — MUSD and the mock veNFT aren't Thaw's own contracts, so they don't
// get a full generated ABI file; these are the only functions the app actually calls.
export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

export const erc721Abi = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "getApproved", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

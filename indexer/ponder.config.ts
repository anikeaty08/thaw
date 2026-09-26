import { createConfig } from "ponder";
import { http } from "viem";

import { LoanManagerAbi } from "./abis/LoanManager";
import { HarvesterAbi } from "./abis/Harvester";
import { TMUSDVaultAbi } from "./abis/TMUSDVault";
import { DutchAuctionLiquidatorAbi } from "./abis/DutchAuctionLiquidator";
import { StrategyRegistryAbi } from "./abis/StrategyRegistry";

const startBlock = Number(process.env.START_BLOCK ?? 0);

export default createConfig({
  networks: {
    mezoTestnet: {
      chainId: 31611,
      transport: http(process.env.PONDER_RPC_URL_MEZO_TESTNET ?? "https://rpc.test.mezo.org"),
    },
  },
  contracts: {
    LoanManager: {
      network: "mezoTestnet",
      abi: LoanManagerAbi,
      address: process.env.LOAN_MANAGER_ADDRESS as `0x${string}`,
      startBlock,
    },
    Harvester: {
      network: "mezoTestnet",
      abi: HarvesterAbi,
      address: process.env.HARVESTER_ADDRESS as `0x${string}`,
      startBlock,
    },
    TMUSDVault: {
      network: "mezoTestnet",
      abi: TMUSDVaultAbi,
      address: process.env.TMUSD_VAULT_ADDRESS as `0x${string}`,
      startBlock,
    },
    DutchAuctionLiquidator: {
      network: "mezoTestnet",
      abi: DutchAuctionLiquidatorAbi,
      address: process.env.DUTCH_AUCTION_LIQUIDATOR_ADDRESS as `0x${string}`,
      startBlock,
    },
    StrategyRegistry: {
      network: "mezoTestnet",
      abi: StrategyRegistryAbi,
      address: process.env.STRATEGY_REGISTRY_ADDRESS as `0x${string}`,
      startBlock,
    },
  },
});

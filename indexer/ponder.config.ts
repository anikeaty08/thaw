import { createConfig } from "ponder";
import { http } from "viem";

import LoanManagerAbi from "./abis/LoanManager.json";
import HarvesterAbi from "./abis/Harvester.json";
import TMUSDVaultAbi from "./abis/TMUSDVault.json";
import DutchAuctionLiquidatorAbi from "./abis/DutchAuctionLiquidator.json";
import StrategyRegistryAbi from "./abis/StrategyRegistry.json";

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
      abi: LoanManagerAbi as any,
      address: process.env.LOAN_MANAGER_ADDRESS as `0x${string}`,
      startBlock,
    },
    Harvester: {
      network: "mezoTestnet",
      abi: HarvesterAbi as any,
      address: process.env.HARVESTER_ADDRESS as `0x${string}`,
      startBlock,
    },
    TMUSDVault: {
      network: "mezoTestnet",
      abi: TMUSDVaultAbi as any,
      address: process.env.TMUSD_VAULT_ADDRESS as `0x${string}`,
      startBlock,
    },
    DutchAuctionLiquidator: {
      network: "mezoTestnet",
      abi: DutchAuctionLiquidatorAbi as any,
      address: process.env.DUTCH_AUCTION_LIQUIDATOR_ADDRESS as `0x${string}`,
      startBlock,
    },
    StrategyRegistry: {
      network: "mezoTestnet",
      abi: StrategyRegistryAbi as any,
      address: process.env.STRATEGY_REGISTRY_ADDRESS as `0x${string}`,
      startBlock,
    },
  },
});

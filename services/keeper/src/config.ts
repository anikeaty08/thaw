import "dotenv/config";
import type { Address, Hex } from "viem";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  rpcUrl: process.env.RPC_URL ?? "https://rpc.test.mezo.org",
  chainId: Number(process.env.CHAIN_ID ?? 31611),
  keeperPrivateKey: required("KEEPER_PRIVATE_KEY") as Hex,

  harvesterAddress: required("HARVESTER_ADDRESS") as Address,
  loanManagerAddress: required("LOAN_MANAGER_ADDRESS") as Address,
  liquidatorAddress: required("DUTCH_AUCTION_LIQUIDATOR_ADDRESS") as Address,

  indexerUrl: process.env.INDEXER_URL ?? "http://localhost:42069",

  harvestBatchSize: Number(process.env.HARVEST_BATCH_SIZE ?? 25),
  harvestCron: process.env.HARVEST_CRON ?? "5 0 * * 4", // Thu 00:05 UTC, §10.1
  healthCheckCron: process.env.HEALTH_CHECK_CRON ?? "*/10 * * * *", // §10.2

  minBountyToGasRatio: Number(process.env.MIN_BOUNTY_TO_GAS_RATIO ?? 1.2),
};

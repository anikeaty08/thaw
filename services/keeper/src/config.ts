import "dotenv/config";
import type { Address, Hex } from "viem";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Accepts a key with or without the 0x prefix (MetaMask exports it without), ignoring stray whitespace. */
function privateKey(name: string): Hex {
  const raw = required(name).trim();
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(`${name} must be a 32-byte hex private key (64 hex characters, 0x optional).`);
  }
  return key;
}

export const config = {
  rpcUrl: process.env.RPC_URL ?? "https://rpc.test.mezo.org",
  chainId: Number(process.env.CHAIN_ID ?? 31611),
  keeperPrivateKey: privateKey("KEEPER_PRIVATE_KEY"),

  harvesterAddress: required("HARVESTER_ADDRESS") as Address,
  loanManagerAddress: required("LOAN_MANAGER_ADDRESS") as Address,
  liquidatorAddress: required("DUTCH_AUCTION_LIQUIDATOR_ADDRESS") as Address,

  indexerUrl: process.env.INDEXER_URL ?? "http://localhost:42069",

  harvestBatchSize: Number(process.env.HARVEST_BATCH_SIZE ?? 25),
  harvestCron: process.env.HARVEST_CRON ?? "5 0 * * 4", // Thu 00:05 UTC, §10.1
  healthCheckCron: process.env.HEALTH_CHECK_CRON ?? "*/10 * * * *", // §10.2

  // Mezo's RPC can't be trusted to estimate gas (it returned ~21k for a harvest, which reverts), so
  // every keeper transaction sets its limit explicitly. A harvest costs roughly this much per loan.
  harvestGasBase: BigInt(process.env.HARVEST_GAS_BASE ?? 400_000),
  harvestGasPerLoan: BigInt(process.env.HARVEST_GAS_PER_LOAN ?? 900_000),
  auctionGas: BigInt(process.env.AUCTION_GAS ?? 1_500_000),

  minBountyToGasRatio: Number(process.env.MIN_BOUNTY_TO_GAS_RATIO ?? 1.2),
};

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
  optimizerPrivateKey: required("OPTIMIZER_PRIVATE_KEY") as Hex,
  strategyRegistryAddress: required("STRATEGY_REGISTRY_ADDRESS") as Address,
  adapters: required("ADAPTERS").split(",").map((a) => a.trim()) as Address[],
  gaugesConfigPath: process.env.GAUGES_CONFIG_PATH ?? "./gauges.config.json",
  optimizerCron: process.env.OPTIMIZER_CRON ?? "0 21 * * 3",
};

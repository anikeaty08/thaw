import cron from "node-cron";
import type { Address } from "viem";
import { config } from "./config.js";
import { publicClient, walletClient, account } from "./chain.js";
import { strategyRegistryAbi } from "./abis.js";
import { loadGaugeUniverse } from "./gauges.js";
import { waterFillAllocate } from "./strategy.js";

const maxVotingNumAbi = [
  { type: "function", name: "maxVotingNum", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

async function postStrategyFor(adapter: Address): Promise<void> {
  const universe = loadGaugeUniverse(adapter);
  if (universe.gauges.length === 0) {
    console.log(`[optimizer] no gauge data configured for ${adapter}, skipping`);
    return;
  }

  const voter = (await publicClient.readContract({
    address: config.strategyRegistryAddress,
    abi: strategyRegistryAbi,
    functionName: "voterOf",
    args: [adapter],
  })) as Address;

  let maxVotingNum = 10;
  if (voter && voter !== "0x0000000000000000000000000000000000000000") {
    try {
      maxVotingNum = Number(
        await publicClient.readContract({ address: voter, abi: maxVotingNumAbi, functionName: "maxVotingNum" }),
      );
    } catch {
      console.warn(`[optimizer] couldn't read maxVotingNum from ${voter}, defaulting to 10`);
    }
  }

  const allocation = waterFillAllocate(universe.gauges, universe.ourVotingPower, maxVotingNum);
  if (allocation.length === 0) {
    console.log(`[optimizer] water-fill produced no allocation for ${adapter}, skipping`);
    return;
  }

  const gauges = allocation.map((a) => a.gauge);
  const weights = allocation.map((a) => a.weightBps);

  console.log(`[optimizer] posting strategy for ${adapter}:`, allocation.map((a) => `${a.gauge}:${a.weightBps}bps`).join(", "));

  const { request } = await publicClient.simulateContract({
    address: config.strategyRegistryAddress,
    abi: strategyRegistryAbi,
    functionName: "postStrategy",
    args: [adapter, gauges, weights],
    account,
  });
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[optimizer] strategy posted for ${adapter}, tx ${hash}`);
}

async function runOnce(): Promise<void> {
  for (const adapter of config.adapters) {
    try {
      await postStrategyFor(adapter);
    } catch (err) {
      console.error(`[optimizer] failed for ${adapter}:`, err instanceof Error ? err.message : err);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const isCronMode = process.argv.includes("--watch");
  if (isCronMode) {
    console.log(`[optimizer] scheduling with cron "${config.optimizerCron}" (§10.1: before the Wed 22:00 UTC freeze)`);
    cron.schedule(config.optimizerCron, () => {
      runOnce().catch((err) => console.error("[optimizer] run crashed:", err));
    });
  } else {
    runOnce()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }
}

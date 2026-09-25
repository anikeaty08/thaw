import { publicClient, walletClient, account } from "../chain.js";
import { harvesterAbi } from "../abis.js";
import { fetchActiveLoanIds } from "../graphql.js";
import { config } from "../config.js";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/// Weekly harvest pipeline (docs/THAW_SYSTEM_DESIGN.md §10.1-§10.2). Runs shortly after each
/// Thursday 00:00 UTC epoch flip: claim -> swap -> repay -> re-vote, batched through harvestMany
/// so a single bad loan (a stuck adapter, a depegged reward token) can't block the rest.
export async function runHarvestJob(): Promise<void> {
  const loanIds = await fetchActiveLoanIds();
  if (loanIds.length === 0) {
    console.log("[harvest] no active loans, nothing to do");
    return;
  }

  console.log(`[harvest] ${loanIds.length} active loan(s), batching by ${config.harvestBatchSize}`);

  for (const batch of chunk(loanIds, config.harvestBatchSize)) {
    try {
      const { request, result } = await publicClient.simulateContract({
        address: config.harvesterAddress,
        abi: harvesterAbi,
        functionName: "harvestMany",
        args: [batch],
        account,
      });

      const hash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      console.log(
        `[harvest] batch of ${batch.length} -> ${result} succeeded, tx ${hash}, status ${receipt.status}, gasUsed ${receipt.gasUsed}`,
      );
    } catch (err) {
      console.error(`[harvest] batch failed (loanIds ${batch.join(",")}):`, err instanceof Error ? err.message : err);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHarvestJob()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

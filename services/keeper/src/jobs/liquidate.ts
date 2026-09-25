import { publicClient, walletClient, account } from "../chain.js";
import { loanManagerAbi, dutchAuctionLiquidatorAbi } from "../abis.js";
import { fetchAllOpenLoanIds } from "../graphql.js";
import { config } from "../config.js";

const WAD = 10n ** 18n;

/// Health-check sweep (docs/THAW_SYSTEM_DESIGN.md §10.2): every ~10 minutes, read every open
/// loan's health factor and start a Dutch auction the moment HF < 1. Advance loans return
/// type(uint256).max here unless the 8-missed-epoch backstop has kicked in (§11.1), so this one
/// loop naturally covers both CreditLine liquidations and Advance-mode defaults.
export async function runLiquidationSweep(): Promise<void> {
  const loanIds = await fetchAllOpenLoanIds();
  if (loanIds.length === 0) {
    console.log("[liquidate] no open loans");
    return;
  }

  const healthFactors = await publicClient.multicall({
    contracts: loanIds.map((loanId) => ({
      address: config.loanManagerAddress,
      abi: loanManagerAbi,
      functionName: "healthFactor",
      args: [loanId],
    })),
    allowFailure: true,
  });

  const underwater = loanIds.filter((_, i) => {
    const r = healthFactors[i];
    return r.status === "success" && (r.result as bigint) < WAD;
  });

  if (underwater.length === 0) {
    console.log(`[liquidate] checked ${loanIds.length} loan(s), all healthy`);
    return;
  }

  console.log(`[liquidate] ${underwater.length} underwater loan(s): ${underwater.join(",")}`);

  for (const loanId of underwater) {
    try {
      const { request } = await publicClient.simulateContract({
        address: config.liquidatorAddress,
        abi: dutchAuctionLiquidatorAbi,
        functionName: "checkAndStartAuction",
        args: [loanId],
        account,
      });
      const hash = await walletClient.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[liquidate] started auction for loan ${loanId}, tx ${hash}`);
    } catch (err) {
      // Likely already liquidating (another keeper won the race) or HF recovered between reads.
      console.warn(`[liquidate] skip loan ${loanId}:`, err instanceof Error ? err.message : err);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLiquidationSweep()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

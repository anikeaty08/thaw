import { Api } from "grammy";
import { formatUnits } from "viem";
import { config } from "./config.js";
import { allLinkedChats } from "./store.js";
import { fetchLoansForBorrower } from "./graphql.js";
import { readHealthFactor } from "./chain.js";

// A bare Api client is enough to push messages — no need for a full Bot (update polling, command
// middleware) in a job that only ever sends, never receives.
const api = new Api(config.botToken);

/// Weekly epoch report (§13, §21.3 video script: "Your debt fell 38.4 -> 12.1 MUSD"). Scheduled
/// for after the keeper's Thursday harvest window (§10.1: 00:05-06:00 UTC), so `totalRepaid`
/// already reflects this epoch's harvest by the time it runs.
export async function sendEpochReports(): Promise<void> {
  for (const { chatId, address } of await allLinkedChats()) {
    try {
      const loans = await fetchLoansForBorrower(address);
      if (loans.length === 0) continue;

      const lines = loans.map((l) => {
        const debt = Number(formatUnits(BigInt(l.principal), 18)).toFixed(2);
        return `#${l.id}: debt now ${debt} MUSD (repaid ${Number(formatUnits(BigInt(l.totalRepaid), 18)).toFixed(2)} to date)`;
      });
      await api.sendMessage(chatId, `Epoch report\n${lines.join("\n")}`);
    } catch (err) {
      console.error(`[bot] epoch report failed for chat ${chatId}:`, err);
    }
  }
}

/// Liquidation warnings: flag any linked wallet with a loan below HF 1.2 so they can react before
/// the Dutch auction actually starts (keeper starts it at HF < 1, per §10.2).
export async function sendLiquidationWarnings(): Promise<void> {
  const WARN_THRESHOLD = 1.2e18;
  for (const { chatId, address } of await allLinkedChats()) {
    try {
      const loans = await fetchLoansForBorrower(address);
      for (const l of loans) {
        const hf = await readHealthFactor(BigInt(l.id));
        if (hf === 2n ** 256n - 1n) continue; // non-liquidating Advance loan
        if (Number(hf) < WARN_THRESHOLD) {
          await api.sendMessage(
            chatId,
            `⚠️ Loan #${l.id} health factor is ${(Number(hf) / 1e18).toFixed(2)}. Repay soon to avoid liquidation: ${config.webappUrl}/loans/${l.id}?action=repay`,
          );
        }
      }
    } catch (err) {
      console.error(`[bot] liquidation warning failed for chat ${chatId}:`, err);
    }
  }
}

// Standalone entrypoint for the GitHub Actions cron: `tsx src/notify.ts <epoch|warnings>`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const job = process.argv[2];
  const run = job === "epoch" ? sendEpochReports : job === "warnings" ? sendLiquidationWarnings : null;
  if (!run) {
    console.error(`Unknown job "${job}". Usage: notify.ts <epoch|warnings>`);
    process.exit(2);
  }
  run()
    .then(() => {
      console.log(`[bot:notify] ${job} done`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[bot:notify] ${job} failed:`, err);
      process.exit(1);
    });
}

import { Bot } from "grammy";
import cron from "node-cron";
import { config } from "./config.js";
import { registerCommands } from "./commands.js";
import { allLinkedChats } from "./store.js";
import { fetchLoansForBorrower } from "./graphql.js";
import { readHealthFactor } from "./chain.js";
import { formatUnits } from "viem";

const bot = new Bot(config.botToken);
registerCommands(bot);

bot.catch((err) => console.error("[bot] handler error:", err));

/// Weekly epoch report (§13, §21.3 video script: "Your debt fell 38.4 -> 12.1 MUSD"). Fires after
/// the keeper's Thursday harvest window (§10.1: 00:05-06:00 UTC), so `totalRepaid` already reflects
/// this epoch's harvest by the time it runs.
async function sendEpochReports(): Promise<void> {
  for (const { chatId, address } of allLinkedChats()) {
    try {
      const loans = await fetchLoansForBorrower(address);
      if (loans.length === 0) continue;

      const lines = loans.map((l) => {
        const debt = Number(formatUnits(BigInt(l.principal), 18)).toFixed(2);
        return `#${l.id}: debt now ${debt} MUSD (repaid ${Number(formatUnits(BigInt(l.totalRepaid), 18)).toFixed(2)} to date)`;
      });
      await bot.api.sendMessage(chatId, `Epoch report\n${lines.join("\n")}`);
    } catch (err) {
      console.error(`[bot] epoch report failed for chat ${chatId}:`, err);
    }
  }
}

/// Liquidation warnings: flag any linked wallet with a loan below HF 1.2 so they can react before
/// the Dutch auction actually starts (keeper starts it at HF < 1, per §10.2).
async function sendLiquidationWarnings(): Promise<void> {
  const WARN_THRESHOLD = 1.2e18;
  for (const { chatId, address } of allLinkedChats()) {
    try {
      const loans = await fetchLoansForBorrower(address);
      for (const l of loans) {
        const hf = await readHealthFactor(BigInt(l.id));
        if (hf === 2n ** 256n - 1n) continue; // non-liquidating Advance loan
        if (Number(hf) < WARN_THRESHOLD) {
          await bot.api.sendMessage(
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

cron.schedule(config.epochReportCron, () => {
  sendEpochReports().catch((err) => console.error("[bot] epoch report job crashed:", err));
});

// More frequent than the epoch report: health can deteriorate any time a price moves.
cron.schedule("*/15 * * * *", () => {
  sendLiquidationWarnings().catch((err) => console.error("[bot] liquidation warning job crashed:", err));
});

bot.start();
console.log("[bot] Thaw Telegram bot running");

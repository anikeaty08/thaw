import cron from "node-cron";
import { config } from "./config.js";
import { createBot } from "./bot.js";
import { sendEpochReports, sendLiquidationWarnings } from "./notify.js";

/// Local-dev / self-host entrypoint: long-polls Telegram and runs the notify jobs on an in-process
/// cron. In production the bot instead runs as a stateless Vercel webhook (api/webhook.ts) with
/// the same two jobs fired by a GitHub Actions schedule (.github/workflows/bot-notify.yml) — see
/// DEPLOYMENT.md. Don't run both this and the webhook against the same bot token at once: Telegram
/// only delivers updates one way at a time, and long-polling will steal updates from the webhook.
const bot = createBot();

cron.schedule(config.epochReportCron, () => {
  sendEpochReports().catch((err) => console.error("[bot] epoch report job crashed:", err));
});

// More frequent than the epoch report: health can deteriorate any time a price moves.
cron.schedule("*/15 * * * *", () => {
  sendLiquidationWarnings().catch((err) => console.error("[bot] liquidation warning job crashed:", err));
});

bot.start();
console.log("[bot] Thaw Telegram bot running in long-polling mode (local dev / self-host)");

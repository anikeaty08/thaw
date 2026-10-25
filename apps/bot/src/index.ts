import cron from "node-cron";
import { config } from "./config.js";
import { createBot } from "./bot.js";
import { sendEpochReports, sendLiquidationWarnings } from "./notify.js";

/// Production entrypoint (ECS, see .github/workflows/deploy-bot.yml) and local dev: long-polls
/// Telegram and runs the notify jobs on an in-process cron. It runs inside AWS because the chat-to-
/// wallet links live in the private RDS database. Only run one poller per bot token: Telegram
/// delivers each update once, and a second poller (or a webhook) would steal updates from this one.
const bot = createBot();

cron.schedule(config.epochReportCron, () => {
  sendEpochReports().catch((err) => console.error("[bot] epoch report job crashed:", err));
});

// More frequent than the epoch report: health can deteriorate any time a price moves.
cron.schedule("*/15 * * * *", () => {
  sendLiquidationWarnings().catch((err) => console.error("[bot] liquidation warning job crashed:", err));
});

// Exit on a startup failure (bad token, another poller on the same token) so ECS restarts the task
// and the failure shows up in the logs instead of leaving a bot that silently receives nothing.
bot
  .start({ onStart: (me) => console.log(`[bot] @${me.username} is polling for updates (long-polling mode)`) })
  .catch((err) => {
    console.error("[bot] polling stopped:", err);
    process.exit(1);
  });

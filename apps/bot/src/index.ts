import cron from "node-cron";
import { config, redact } from "./config.js";
import { createBot } from "./bot.js";
import { sendEpochReports, sendLiquidationWarnings } from "./notify.js";

/// Production entrypoint (ECS, see .github/workflows/deploy-bot.yml) and local dev: long-polls
/// Telegram and runs the notify jobs on an in-process cron. It runs inside AWS because the chat-to-
/// wallet links live in the private RDS database. Only run one poller per bot token: Telegram
/// delivers each update once, and a second poller (or a webhook) would steal updates from this one.
const bot = createBot();

cron.schedule(config.epochReportCron, () => {
  sendEpochReports().catch((err) => console.error("[bot] epoch report job crashed:", redact(err)));
});

// More frequent than the epoch report: health can deteriorate any time a price moves.
cron.schedule("*/15 * * * *", () => {
  sendLiquidationWarnings().catch((err) => console.error("[bot] liquidation warning job crashed:", redact(err)));
});

// Exit on a startup failure (bad token, no route to Telegram, another poller on the same token) so
// ECS restarts the task and the cause shows up in the logs instead of a bot that silently receives
// nothing. The first call to Telegram gets a time limit so a hang is reported rather than waited on.
async function main(): Promise<void> {
  console.log("[bot] starting");
  const me = await Promise.race([
    bot.api.getMe(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no answer from Telegram within 20s")), 20_000)),
  ]);
  console.log(`[bot] connected to Telegram as @${me.username}`);
  await bot.start({ onStart: () => console.log("[bot] polling for updates") });
}

main().catch((err) => {
  console.error("[bot] stopped:", redact(err));
  process.exit(1);
});

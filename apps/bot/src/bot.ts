import { Bot } from "grammy";
import { config } from "./config.js";
import { registerCommands } from "./commands.js";

/// Shared bot construction for both run modes: index.ts calls bot.start() for local dev / a
/// self-hosted long-running process, and api/webhook.ts instead feeds updates in via
/// webhookCallback() from Vercel — same commands, same handler registration either way.
export function createBot(): Bot {
  const bot = new Bot(config.botToken);
  bot.use(async (ctx, next) => {
    console.log(`[bot] update from chat ${ctx.chat?.id ?? "?"}: ${ctx.message?.text ?? ctx.update.update_id}`);
    await next();
  });
  registerCommands(bot);
  bot.catch(async (err) => {
    console.error("[bot] handler error:", err.error);
    await err.ctx.reply("Something went wrong on our side. Please try again in a minute.").catch(() => {});
  });
  return bot;
}

import { Bot } from "grammy";
import { config } from "./config.js";
import { registerCommands } from "./commands.js";

/// Shared bot construction for both run modes: index.ts calls bot.start() for local dev / a
/// self-hosted long-running process, and api/webhook.ts instead feeds updates in via
/// webhookCallback() from Vercel — same commands, same handler registration either way.
export function createBot(): Bot {
  const bot = new Bot(config.botToken);
  registerCommands(bot);
  bot.catch((err) => console.error("[bot] handler error:", err));
  return bot;
}

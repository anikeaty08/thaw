import type { IncomingMessage, ServerResponse } from "node:http";
import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";
import { config } from "../src/config.js";

// Built once per cold start, reused across warm invocations of this function.
const bot = createBot();
// Vercel's Node runtime hands the handler a plain (IncomingMessage, ServerResponse) pair, so the
// "http" adapter fits without pulling in @vercel/node just for types (its own transitive deps
// carry a handful of build-tool CVEs we don't need in this small a function).
const handleUpdate = webhookCallback(bot, "http", { secretToken: config.webhookSecret });

/// POST target for Telegram's webhook (registered once via scripts/set-webhook.ts). Runs as a
/// stateless Vercel serverless function instead of the long-polling bot in src/index.ts — see
/// DEPLOYMENT.md for why, and .github/workflows/bot-notify.yml for the epoch-report/liquidation-
/// warning jobs that used to be an in-process cron here.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }
  await handleUpdate(req, res);
}

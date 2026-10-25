import "dotenv/config";
import type { Address } from "viem";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/// Error text from Telegram requests contains the request URL, which contains the bot token. Run
/// anything that might include one through this before logging it.
export function redact(value: unknown): string {
  let text = value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  // grammY wraps network failures in an HttpError; the real reason (ETIMEDOUT, ECONNREFUSED, …) is
  // on the wrapped error, so include its code and message.
  const inner = (value as { error?: { code?: string; errno?: string; message?: string } } | null)?.error;
  if (inner && typeof inner === "object") text += ` [${inner.code ?? inner.errno ?? "?"}] ${inner.message ?? ""}`;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return (token ? text.split(token).join("<bot-token>") : text).replace(/bot\d+:[\w-]+/g, "bot<bot-token>");
}

export const config = {
  botToken: required("TELEGRAM_BOT_TOKEN"),
  rpcUrl: process.env.RPC_URL ?? "https://rpc.test.mezo.org",
  chainId: Number(process.env.CHAIN_ID ?? 31611),
  loanManagerAddress: required("LOAN_MANAGER_ADDRESS") as Address,
  indexerUrl: process.env.INDEXER_URL ?? "http://localhost:42069",
  webappUrl: process.env.WEBAPP_URL ?? "https://thaw.mezo.org",
  // Shared chat<->wallet link store (Postgres/Supabase). Replaces the old JSON file, which can't
  // be shared between the Vercel webhook function and the GitHub Actions notify cron.
  databaseUrl: required("DATABASE_URL"),
  // Verifies inbound webhook calls actually came from Telegram (grammy checks the
  // X-Telegram-Bot-Api-Secret-Token header against this). Set when calling setWebhook too.
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  epochReportCron: process.env.EPOCH_REPORT_CRON ?? "0 7 * * 4",
};

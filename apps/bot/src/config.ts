import "dotenv/config";
import type { Address } from "viem";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
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

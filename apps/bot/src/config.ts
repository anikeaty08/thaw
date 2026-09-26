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
  linksStorePath: process.env.LINKS_STORE_PATH ?? "./data/links.json",
  epochReportCron: process.env.EPOCH_REPORT_CRON ?? "0 7 * * 4",
};

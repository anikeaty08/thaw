import postgres from "postgres";
import { config } from "./config.js";

/// Shared Postgres store for chat<->wallet links. This replaces the original JSON-file store: the
/// bot now runs as a stateless Vercel webhook function (src/../api/webhook.ts) plus a separate
/// GitHub Actions cron process (src/notify.ts) for epoch reports and liquidation warnings, and
/// neither of those share a filesystem, so the link table has to live somewhere both can reach.
/// `max: 1` keeps each short-lived serverless invocation to a single connection instead of opening
/// a pool it will never reuse.
export const sql = postgres(config.databaseUrl, { max: 1, idle_timeout: 20, connect_timeout: 10 });

let ensured: Promise<void> | null = null;

/// Runs once per process; safe to call before every query since it's idempotent and memoized.
export function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = sql`
      create table if not exists bot_links (
        chat_id bigint primary key,
        address text not null,
        linked_at timestamptz not null default now()
      )
    `.then(() => undefined);
  }
  return ensured;
}

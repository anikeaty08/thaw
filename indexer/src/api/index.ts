import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { graphql } from "ponder";
import postgres from "postgres";
import { SCHEMA_SQL, createRateLimiter, linkChat, type Db } from "./telegramLink.js";

// Ponder >=0.9 serves nothing unless an API entry exists. apps/web, apps/bot and the keeper all
// POST to /graphql (plus Ponder's built-in /health, /ready), and the web app POSTs to
// /telegram/link to finish linking a Telegram chat to a wallet.
const app = new Hono();

// The public dashboard is hosted separately from this API. GraphQL exposes
// only indexed, public chain data, so permit browser reads from that origin.
app.use("*", cors());
app.use("/graphql", graphql({ db, schema }));

// Telegram linking shares the database with the bot (its tables live in the default schema, not the
// indexer's own). Connected lazily so the indexer still starts if linking is ever misconfigured.
let linkDb: ReturnType<typeof postgres> | null = null;
let schemaReady: Promise<unknown> | null = null;
function linkSql(): ReturnType<typeof postgres> {
  if (!linkDb) {
    linkDb = postgres(process.env.DATABASE_URL!, { max: 2, idle_timeout: 20, connect_timeout: 10 });
  }
  return linkDb;
}
const allow = createRateLimiter(20, 60_000);

app.post("/telegram/link", async (c) => {
  const client = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allow(client)) return c.json({ ok: false, error: "rate_limited" }, 429);
  if (!process.env.DATABASE_URL) return c.json({ ok: false, error: "unavailable" }, 503);

  const body = await c.req.json().catch(() => null);
  try {
    const sql = linkSql();
    schemaReady ??= Promise.all(SCHEMA_SQL.map((ddl) => sql.unsafe(ddl)));
    await schemaReady;
    const result = await linkChat(sql as unknown as Db, body ?? {});
    if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
    return c.json({ ok: true, address: result.address });
  } catch (err) {
    schemaReady = null;
    console.error("[telegram/link] failed:", err instanceof Error ? err.message : err);
    return c.json({ ok: false, error: "unavailable" }, 503);
  }
});

export default app;

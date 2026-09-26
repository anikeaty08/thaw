# Deploying Thaw

Everything here runs on free tiers. Nothing needs a credit card except Supabase and Render sign-up
(no charge on the plans used).

## What runs where, and why

| Piece | Host | Why not a paid "always-on" plan |
|---|---|---|
| Frontend (`apps/web`) | **Vercel** | Next.js is what Vercel is built for; free tier is generous for this traffic level. |
| Indexer (`indexer`) — GraphQL API the frontend reads | **Render**, free Web Service | Needs to be a running server (syncs the chain continuously), but Render's free tier sleeps after ~15 idle minutes and wakes on the next request in 30-60s. The frontend's `BackendStatus` pill (top bar) pings it on every page load specifically to trigger that wake-up, and shows "Waking up…" while it happens. |
| Postgres (indexer's data + the bot's chat links) | **Supabase**, free project | One database, two schemas: the indexer's tables live under schema `thaw`; the bot's `bot_links` table lives under the default `public` schema. No collision. |
| Keeper (`services/keeper`) — weekly harvest + liquidation sweep | **GitHub Actions**, scheduled workflow | It only needs to *wake up* on a schedule, not run continuously. Render only offers that for money (a paid "Background Worker"); GitHub Actions cron is free on a public repo. See `.github/workflows/keeper.yml`. |
| Telegram bot (`apps/bot`) — commands | **Vercel**, as its own small serverless-function project | Rewritten from long-polling (which needs a resident process) to a webhook: Telegram POSTs to us instead of us asking it for updates, so it fits a stateless function. See `apps/bot/api/webhook.ts`. |
| Telegram bot — epoch reports & liquidation warnings | **GitHub Actions**, scheduled workflow | Same reasoning as the keeper: these used to be an in-process cron inside the long-polling bot; now `.github/workflows/bot-notify.yml` fires them instead. |

If you'd rather pay for simplicity, every GitHub Actions job here can be a Render Background Worker
instead — same code, just run `npm start` (keeper) or keep the old polling `apps/bot` `npm start`
resident instead of deploying `api/webhook.ts`. Both entrypoints still exist for that reason.

## 1. Contracts (skip if already deployed)

```bash
cd contracts
PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast
```

Note every address it prints — you'll paste them into Render, Vercel and GitHub below.

## 2. Supabase (database)

1. Create a free project at [supabase.com](https://supabase.com).
2. Project Settings → Database → Connection string → **Session pooler** (port 5432; the
   transaction pooler on 6543 also works and is friendlier to serverless functions if you outgrow
   session mode's connection limit). Copy it — you'll need it twice, for Render (indexer) and for
   the bot's `DATABASE_URL`.
3. Nothing to run by hand: the indexer creates its own tables on first start (Ponder migrates
   automatically), and the bot's `ensureSchema()` creates `bot_links` on its first call.

## 3. Indexer → Render

This repo includes `render.yaml`. In the Render dashboard: **New → Blueprint**, point it at this
repo, and it reads the file. Or set it up by hand: **New → Web Service**, root directory `indexer`,
runtime Node, build command `npm install`, start command
`npx ponder start --schema thaw --port $PORT --hostname 0.0.0.0`, health check path `/ready`.

Environment variables (Render dashboard → Environment):

| Key | Value |
|---|---|
| `DATABASE_URL` | the Supabase connection string from step 2 |
| `PONDER_RPC_URL_MEZO_TESTNET` | `https://rpc.test.mezo.org` (already set in render.yaml) |
| `START_BLOCK` | the block `LoanManager` was deployed at |
| `LOAN_MANAGER_ADDRESS`, `HARVESTER_ADDRESS`, `TMUSD_VAULT_ADDRESS`, `DUTCH_AUCTION_LIQUIDATOR_ADDRESS`, `STRATEGY_REGISTRY_ADDRESS` | from your deploy output |

Once it's live, note the URL Render gives it (`https://thaw-indexer.onrender.com` or similar) —
that's your `NEXT_PUBLIC_INDEXER_URL` for Vercel and `INDEXER_URL` everywhere else below.

## 4. Frontend → Vercel

**New Project** → import this repo → root directory `apps/web` (Next.js auto-detected).

Environment variables (copy from `apps/web/.env.example`, all `NEXT_PUBLIC_*` ones get baked into
the build, so set them *before* the first deploy):

- `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID` — `https://rpc.test.mezo.org` / `31611`
- `NEXT_PUBLIC_INDEXER_URL` — the Render URL from step 3
- `NEXT_PUBLIC_*_ADDRESS` (8 of them) — from your deploy output
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from [cloud.reown.com](https://cloud.reown.com)

The top bar's connection pill (`components/ui/BackendStatus.tsx`) pings the indexer's `/ready` as
soon as anyone opens the site — that's the "trigger the backend on visit" behavior, and it's also
what wakes a sleeping Render instance.

## 5. Telegram bot → Vercel (webhook) + GitHub Actions (notifications)

**5a. Deploy the webhook.** A *second*, separate Vercel project (it's not a Next.js app): **New
Project** → same repo → root directory `apps/bot`. Environment variables (from
`apps/bot/.env.example`): `TELEGRAM_BOT_TOKEN`, `DATABASE_URL` (the same Supabase string from step
2), `RPC_URL`, `CHAIN_ID`, `LOAN_MANAGER_ADDRESS`, `INDEXER_URL`, `WEBAPP_URL` (your Vercel frontend
URL), and `TELEGRAM_WEBHOOK_SECRET` (any long random string — verifies a request really came from
Telegram).

**5b. Point Telegram at it.** One-time, from your machine, after the Vercel deploy finishes:

```bash
cd apps/bot
npm run set-webhook -- https://<your-bot-project>.vercel.app
```

**5c. Wire up notifications.** In this GitHub repo, **Settings → Secrets and variables → Actions**:

- Secrets: `TELEGRAM_BOT_TOKEN`, `BOT_DATABASE_URL` (same Supabase string again), and separately
  `KEEPER_PRIVATE_KEY` for the keeper workflow (§6). Never put these in a `vars` — they're readable
  by anyone with read access to the repo.
- Variables: `RPC_URL`, `CHAIN_ID`, `LOAN_MANAGER_ADDRESS`, `INDEXER_URL`, `WEBAPP_URL`, and for the
  keeper: `HARVESTER_ADDRESS`, `DUTCH_AUCTION_LIQUIDATOR_ADDRESS`.

`.github/workflows/bot-notify.yml` then sends the weekly epoch report and checks for underwater
loans every 15 minutes, without any server of its own.

## 6. Keeper → GitHub Actions

Same Settings page as 5c. Add the secret `KEEPER_PRIVATE_KEY` (a **fresh** wallet, funded with a
little testnet BTC for gas — never reuse the contract deployer key here) and the variables above.
`.github/workflows/keeper.yml` runs the harvest every Thursday 00:05 UTC and a liquidation health
check every 10 minutes.

Both `keeper.yml` and `bot-notify.yml` also have a manual **Run workflow** button (Actions tab) for
testing without waiting for the schedule.

## Caveats worth knowing

- **GitHub Actions cron is best-effort.** A scheduled run can slip a few minutes under GitHub's
  load, and GitHub pauses a schedule after ~60 days with zero repository activity (any push or
  merge resets that clock). Fine for a weekly harvest and a 10-minute health check; not a
  substitute for sub-minute liquidation response. If that ever matters, that's what the paid
  Render Background Worker path (`npm start` in `services/keeper`) is for.
- **Render free tier sleeps.** The first request after 15 idle minutes waits out a cold start
  (usually well under a minute). `BackendStatus` covers this in the UI; anything hitting the
  indexer directly (`curl`, the bot, the keeper) will also just see that first request take longer.
- **Long-polling and the webhook are mutually exclusive.** Don't run `apps/bot`'s `npm start`
  (§index.ts, long-polling) against the same bot token as the deployed webhook — Telegram delivers
  updates one way at a time, and starting the poller will silently steal them from Vercel.
  `npm run delete-webhook` switches back to polling if you ever need to.

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
| Telegram bot (`apps/bot`) — commands, epoch reports and liquidation warnings | **AWS ECS Fargate** (`thaw-bot`), same cluster and network as the indexer | One small always-on task. It long-polls Telegram and runs its own alert schedule, and it needs to sit inside AWS because the chat-to-wallet links live in the indexer's **private** RDS database, which GitHub and Vercel cannot reach. |

If you'd rather pay for simplicity, every GitHub Actions job here can be a Render Background Worker
instead — same code, just run `npm start` (keeper) or keep the old polling `apps/bot` `npm start`
resident instead of deploying `api/webhook.ts`. Both entrypoints still exist for that reason.

## 1. Contracts (skip if already deployed)

```bash
cd contracts
PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast
```

For a real veBTC deployment, supply `VEBTC_ADDRESS`, `VEBTC_VOTER`, `BTC_PRICE_TOKEN`, and
`BTC_USD_FEED`; the deploy script checks the BTC/USD feed before broadcasting. Use a fresh deployer
key kept outside the repository. Note every address it prints — you'll paste them into Render,
Vercel and GitHub below. Record the first contract deployment block from
`contracts/broadcast/Deploy.s.sol/31611/run-latest.json` for the indexer's `START_BLOCK`.

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
- `NEXT_PUBLIC_*_ADDRESS` (10 of them) — from your deploy output; follow every entry in
  `apps/web/.env.example`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from [cloud.reown.com](https://cloud.reown.com)

The top bar's connection pill (`components/ui/BackendStatus.tsx`) pings the indexer's `/ready` as
soon as anyone opens the site — that's the "trigger the backend on visit" behavior, and it's also
what wakes a sleeping Render instance.

## 5. Telegram bot → AWS ECS

The bot runs as the `thaw-bot` ECS service and is deployed by `.github/workflows/deploy-bot.yml`
whenever `apps/bot/**` changes on `main`. It long-polls Telegram, sends the Thursday 07:00 UTC epoch
report and checks for unhealthy loans every 15 minutes, all inside the one process
(`apps/bot/src/index.ts`).

**What it needs**

- The bot token in AWS Secrets Manager as `thaw/bot/telegram-token` (the task reads it at start).
- The existing database secret `thaw/rds/database`. The bot creates its own `bot_links` table in
  that database on first use, so there is no second database.
- The task execution role allowed to read both (`infra/iam/thaw-read-rds-secret.json`).
- Plain settings are in `infra/ecs/thaw-bot-task.json`: `RPC_URL`, `CHAIN_ID`, `LOAN_MANAGER_ADDRESS`,
  `INDEXER_URL`, `WEBAPP_URL`.

**Check it is alive**

```bash
aws ecs describe-services --cluster kishan-saathi-cluster --services thaw-bot --region ap-southeast-2   --query 'services[0].{running:runningCount,desired:desiredCount}'
aws logs tail /ecs/thaw-bot --since 30m --region ap-southeast-2
```

The log should show `[bot] @<username> is polling for updates`, then one `[bot] update from chat …`
line per message people send.

**Only one poller per token.** Telegram hands each update to exactly one consumer. Do not run
`npm start` locally, or a webhook, against the same bot token while the ECS task is running; they
steal each other's updates. `npm run delete-webhook` clears a leftover webhook.

## 6. Keeper → GitHub Actions

Same Settings page as 5c. Add the secret `KEEPER_PRIVATE_KEY` (a **fresh** wallet, funded with a
little testnet BTC for gas — never reuse the contract deployer key here) and the variables above.
`.github/workflows/keeper.yml` runs the harvest every Thursday 00:05 UTC and a liquidation health
check every 10 minutes.

`keeper.yml` also has a manual **Run workflow** button (Actions tab) for testing without waiting
for the schedule.

## 7. Verify the live stack

After Render and Vercel have deployed, run this from the repository root. It checks every public
frontend route, indexer health and readiness, the GraphQL response shape, and that each supplied
contract address has bytecode on Mezo Testnet:

```bash
THAW_WEB_URL=https://<web-project>.vercel.app \
THAW_INDEXER_URL=https://<indexer>.onrender.com \
THAW_CONTRACT_LOAN_MANAGER=0x... \
THAW_CONTRACT_ESCROW=0x... \
THAW_CONTRACT_HARVESTER=0x... \
npm run verify:live
```

Then connect a fresh testnet wallet and perform the user transaction flow: faucet drip, approve the
demo lock, open a loan, make a repayment, and confirm the resulting event and loan data appear in
the UI through the deployed indexer.

## Caveats worth knowing

- **GitHub Actions cron is best-effort.** A scheduled run can slip a few minutes under GitHub's
  load, and GitHub pauses a schedule after ~60 days with zero repository activity (any push or
  merge resets that clock). Fine for a weekly harvest and a 10-minute health check; not a
  substitute for sub-minute liquidation response. If that ever matters, that's what the paid
  Render Background Worker path (`npm start` in `services/keeper`) is for.
- **Render free tier sleeps.** The first request after 15 idle minutes waits out a cold start
  (usually well under a minute). `BackendStatus` covers this in the UI; anything hitting the
  indexer directly (`curl`, the bot, the keeper) will also just see that first request take longer.
- **Polling and webhooks are mutually exclusive.** The bot polls from ECS. Don't run `npm start` in
  `apps/bot` locally, or register a webhook, with the same bot token: Telegram delivers updates one
  way at a time and the second consumer silently steals them. `npm run delete-webhook` switches back.
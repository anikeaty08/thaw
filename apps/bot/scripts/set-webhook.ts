import "dotenv/config";

/// One-time setup after deploying api/webhook.ts to Vercel: tells Telegram where to POST updates.
/// Usage: `npm run set-webhook -- https://<your-bot-project>.vercel.app`
/// (Run `npm run delete-webhook` first if this bot token was previously used in polling mode —
/// Telegram refuses to deliver to a webhook while a long-poll getUpdates call is still open.)
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = process.argv[2];

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in the environment.");
  process.exit(1);
}
if (!baseUrl) {
  console.error("Usage: npm run set-webhook -- https://<your-bot-project>.vercel.app");
  process.exit(1);
}

const url = `${baseUrl.replace(/\/$/, "")}/api/webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url, secret_token: secret, drop_pending_updates: true }),
});
const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!body.ok) process.exit(1);
console.log(`\nWebhook set to ${url}${secret ? " (with secret token)" : " (no secret token — set TELEGRAM_WEBHOOK_SECRET and rerun for verified requests)"}`);

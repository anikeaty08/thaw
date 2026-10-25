// The Thaw Telegram bot (apps/bot). Override the username with NEXT_PUBLIC_TELEGRAM_BOT.
export const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "thaww08_bot";

const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:42069";

/** Opens the bot, which answers /start link with a one-time code and a button back to /link-telegram. */
export const TELEGRAM_START_LINK = `https://t.me/${TELEGRAM_BOT}?start=link`;

/** One-time codes: 8 characters without the look-alikes I, O, 0 and 1. Matches the bot and indexer. */
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

/** Uppercase and drop dashes and spaces, so "abcd-2345" works the same as "ABCD2345". */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * The exact text the wallet signs. It must match linkMessage in indexer/src/api/telegramLink.ts
 * character for character, or the server will reject the signature.
 */
export function linkMessage(code: string, address: string): string {
  return [
    "Link this Telegram chat to your wallet on Thaw.",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Code: ${code}`,
    "",
    "This signature is free and sends no transaction.",
  ].join("\n");
}

export type LinkError = "bad_request" | "bad_signature" | "code_expired" | "rate_limited" | "unavailable" | "network";

/** Sends the signature to the indexer, which checks it and links the chat. */
export async function submitLink(input: { code: string; address: string; signature: string }): Promise<{ ok: true } | { ok: false; error: LinkError }> {
  try {
    const res = await fetch(`${INDEXER_URL}/telegram/link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: LinkError } | null;
    if (res.ok && body?.ok) return { ok: true };
    return { ok: false, error: body?.error ?? "unavailable" };
  } catch {
    return { ok: false, error: "network" };
  }
}

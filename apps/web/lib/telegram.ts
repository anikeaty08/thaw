// The Thaw Telegram bot (apps/bot). Override the username with NEXT_PUBLIC_TELEGRAM_BOT.
export const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? "thaww08_bot";

/**
 * Link that opens the bot and tells it which wallet to watch. Telegram passes everything after
 * `?start=` to the bot as "/start <payload>"; a wallet address (42 characters, letters and digits)
 * fits the payload rules.
 */
export function telegramLink(address: string): string {
  return `https://t.me/${TELEGRAM_BOT}?start=${address}`;
}

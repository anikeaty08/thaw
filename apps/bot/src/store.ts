import { randomInt } from "node:crypto";
import type { Address } from "viem";
import { sql, ensureSchema } from "./db.js";

// 32 symbols without the look-alikes I, O, 0 and 1. The indexer's CODE_PATTERN must match.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MINUTES = 10;

/**
 * A fresh one-time code for this chat, valid for ten minutes. The web app has the wallet sign a
 * message containing it, and the indexer's /telegram/link endpoint checks the signature and spends
 * the code. A chat only ever has one live code; asking again replaces it.
 */
export async function createLinkCode(chatId: number): Promise<string> {
  await ensureSchema();
  const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  await sql`delete from bot_link_codes where chat_id = ${chatId} or expires_at < now()`;
  await sql`
    insert into bot_link_codes (code, chat_id, expires_at)
    values (${code}, ${chatId}, now() + ${CODE_TTL_MINUTES} * interval '1 minute')
  `;
  return code;
}

export const LINK_CODE_TTL_MINUTES = CODE_TTL_MINUTES;

export async function unlinkWallet(chatId: number): Promise<boolean> {
  await ensureSchema();
  const rows = await sql`delete from bot_links where chat_id = ${chatId} returning chat_id`;
  return rows.length > 0;
}

export async function getLinkedWallet(chatId: number): Promise<Address | undefined> {
  await ensureSchema();
  const rows = await sql<{ address: string }[]>`select address from bot_links where chat_id = ${chatId}`;
  return rows[0]?.address as Address | undefined;
}

export async function allLinkedChats(): Promise<{ chatId: number; address: Address }[]> {
  await ensureSchema();
  const rows = await sql<{ chat_id: string; address: string }[]>`select chat_id, address from bot_links`;
  return rows.map((r) => ({ chatId: Number(r.chat_id), address: r.address as Address }));
}

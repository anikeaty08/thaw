import type { Address } from "viem";
import { sql, ensureSchema } from "./db.js";

export async function linkWallet(chatId: number, address: Address): Promise<void> {
  await ensureSchema();
  await sql`
    insert into bot_links (chat_id, address)
    values (${chatId}, ${address.toLowerCase()})
    on conflict (chat_id) do update set address = excluded.address, linked_at = now()
  `;
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

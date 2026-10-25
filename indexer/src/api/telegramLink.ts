import { isAddress, verifyMessage, type Address, type Hex } from "viem";

// Verified Telegram linking. The bot hands a chat a one-time code (stored in bot_link_codes); the
// web app has the wallet sign a message that contains that code and the address; this module checks
// both halves, then links the chat. The code proves who holds the chat, the signature proves who
// holds the wallet, so nobody can attach an address they don't control to their chat.
//
// The message text must match apps/web/lib/telegram.ts exactly.

export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

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

/** The slice of a postgres.js client this module needs, so tests can supply a fake. */
export interface Db {
  begin<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  // Tagged-template query, as postgres.js provides.
  <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[] & { count?: number }>;
}

export const SCHEMA_SQL = [
  `create table if not exists bot_links (
     chat_id bigint primary key,
     address text not null,
     linked_at timestamptz not null default now()
   )`,
  `create table if not exists bot_link_codes (
     code text primary key,
     chat_id bigint not null,
     expires_at timestamptz not null
   )`,
];

export type LinkResult =
  | { ok: true; address: Address }
  | { ok: false; status: 400 | 401 | 410; error: "bad_request" | "bad_signature" | "code_expired" };

/**
 * Verifies the signature, then, in one transaction, spends the code and links the chat. A code can be
 * used once, only before it expires, and only after the signature has checked out, so a wrong
 * signature never burns somebody else's code.
 */
export async function linkChat(sql: Db, input: { code?: unknown; address?: unknown; signature?: unknown }): Promise<LinkResult> {
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase().replace(/[-\s]/g, "") : "";
  const { address, signature } = input;
  if (!CODE_PATTERN.test(code) || typeof address !== "string" || !isAddress(address) || typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    return { ok: false, status: 400, error: "bad_request" };
  }

  let valid = false;
  try {
    valid = await verifyMessage({ address, message: linkMessage(code, address), signature: signature as Hex });
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, status: 401, error: "bad_signature" };

  return sql.begin(async (tx) => {
    // Spend the code atomically: only one request can ever delete it, and only while it is fresh.
    const spent = await tx<{ chat_id: string }>`
      delete from bot_link_codes where code = ${code} and expires_at > now() returning chat_id
    `;
    if (spent.length === 0) return { ok: false, status: 410, error: "code_expired" } as const;
    await tx`
      insert into bot_links (chat_id, address)
      values (${spent[0].chat_id}, ${address.toLowerCase()})
      on conflict (chat_id) do update set address = excluded.address, linked_at = now()
    `;
    return { ok: true, address: address as Address } as const;
  });
}

/** Small fixed-window limiter so the endpoint can't be hammered; per key (client address). */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now = Date.now()): boolean => {
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

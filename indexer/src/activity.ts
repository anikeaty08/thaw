import { activity } from "ponder:schema";

type LogEvent = { transaction: { hash: `0x${string}` }; log: { logIndex: number }; block: { timestamp: bigint } };

export function logId(event: Pick<LogEvent, "transaction" | "log">) {
  return `${event.transaction.hash}-${event.log.logIndex}`;
}

/** Adds one entry to a wallet's History feed (see the `activity` table). */
export async function recordActivity(
  context: { db: { insert: (table: typeof activity) => { values: (v: typeof activity.$inferInsert) => Promise<unknown> } } },
  event: LogEvent,
  entry: { account: `0x${string}`; kind: string; loanId?: bigint; amount?: bigint },
) {
  await context.db.insert(activity).values({
    id: logId(event),
    account: entry.account.toLowerCase() as `0x${string}`,
    kind: entry.kind,
    loanId: entry.loanId,
    amount: entry.amount,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
}

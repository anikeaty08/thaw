import { ponder } from "ponder:registry";
import { vaultFlow } from "ponder:schema";

function logId(event: { transaction: { hash: `0x${string}` }; log: { logIndex: number } }) {
  return `${event.transaction.hash}-${event.log.logIndex}`;
}

ponder.on("TMUSDVault:Lent", async ({ event, context }) => {
  await context.db.insert(vaultFlow).values({
    id: logId(event),
    kind: "lend",
    amount: event.args.amount,
    counterparty: event.args.to,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});

ponder.on("TMUSDVault:RepaymentReceived", async ({ event, context }) => {
  await context.db.insert(vaultFlow).values({
    id: logId(event),
    kind: "repay",
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});

ponder.on("TMUSDVault:BadDebtRealized", async ({ event, context }) => {
  await context.db.insert(vaultFlow).values({
    id: logId(event),
    kind: "bad_debt",
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});

ponder.on("TMUSDVault:ParkedInMSR", async ({ event, context }) => {
  await context.db.insert(vaultFlow).values({
    id: logId(event),
    kind: "park_msr",
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});

ponder.on("TMUSDVault:PulledFromMSR", async ({ event, context }) => {
  await context.db.insert(vaultFlow).values({
    id: logId(event),
    kind: "pull_msr",
    amount: event.args.amount,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});

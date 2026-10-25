import { ponder } from "ponder:registry";
import { loan, vaultFlow } from "ponder:schema";
import { recordActivity } from "./activity";

/** The borrower of a loan the indexer has already seen (LoanOpened always comes first). */
async function borrowerOf(context: { db: { find: (t: typeof loan, k: { id: bigint }) => Promise<{ borrower: `0x${string}` } | null> } }, loanId: bigint) {
  return (await context.db.find(loan, { id: loanId }))?.borrower;
}

const MODE_NAMES = ["Advance", "CreditLine"] as const;

ponder.on("LoanManager:LoanOpened", async ({ event, context }) => {
  await context.db.insert(loan).values({
    id: event.args.loanId,
    adapter: event.args.adapter,
    tokenId: event.args.tokenId,
    mode: MODE_NAMES[event.args.mode] ?? "Advance",
    borrower: event.args.borrower,
    principal: event.args.principal,
    repayShareBps: 0, // filled by the LoanOpened call's own repayShareBps isn't in this event; UI reads getLoan for the live value
    aprBps: 0,
    openedAt: event.block.timestamp,
  });
  await recordActivity(context, event, { account: event.args.borrower, kind: "loan_opened", loanId: event.args.loanId, amount: event.args.principal });
});

ponder.on("LoanManager:Borrowed", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set((row) => ({
    principal: row.principal + event.args.amount,
  }));
  const borrower = await borrowerOf(context, event.args.loanId);
  if (borrower) await recordActivity(context, event, { account: borrower, kind: "borrowed", loanId: event.args.loanId, amount: event.args.amount });
});

ponder.on("LoanManager:Repaid", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set((row) => ({
    principal: event.args.remainingDebt,
    totalRepaid: row.totalRepaid + event.args.amount,
  }));
  // The Thursday harvest repays through the same event; tell it apart by who paid.
  const byHarvest = event.args.payer.toLowerCase() === context.contracts.Harvester.address.toLowerCase();
  const borrower = await borrowerOf(context, event.args.loanId);
  if (borrower) {
    await recordActivity(context, event, {
      account: borrower,
      kind: byHarvest ? "harvest" : "repaid",
      loanId: event.args.loanId,
      amount: event.args.amount,
    });
  }
});

ponder.on("LoanManager:LoanClosed", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    closed: true,
    principal: 0n,
  });
  const borrower = await borrowerOf(context, event.args.loanId);
  if (borrower) await recordActivity(context, event, { account: borrower, kind: "loan_closed", loanId: event.args.loanId });
});

ponder.on("LoanManager:RepayShareUpdated", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    repayShareBps: event.args.bps,
  });
});

ponder.on("LoanManager:MissedEpochRecorded", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    missedEpochs: Number(event.args.missedEpochs), // uint64 in the event, integer column
  });
});

ponder.on("LoanManager:LiquidationStarted", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    liquidating: true,
  });
  const borrower = await borrowerOf(context, event.args.loanId);
  if (borrower) await recordActivity(context, event, { account: borrower, kind: "liquidation_started", loanId: event.args.loanId });
});

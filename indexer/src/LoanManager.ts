import { ponder } from "ponder:registry";
import { loan, vaultFlow } from "ponder:schema";

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
});

ponder.on("LoanManager:Borrowed", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set((row) => ({
    principal: row.principal + event.args.amount,
  }));
});

ponder.on("LoanManager:Repaid", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set((row) => ({
    principal: event.args.remainingDebt,
    totalRepaid: row.totalRepaid + event.args.amount,
  }));
});

ponder.on("LoanManager:LoanClosed", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    closed: true,
    principal: 0n,
  });
});

ponder.on("LoanManager:RepayShareUpdated", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    repayShareBps: event.args.bps,
  });
});

ponder.on("LoanManager:MissedEpochRecorded", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    missedEpochs: event.args.missedEpochs,
  });
});

ponder.on("LoanManager:LiquidationStarted", async ({ event, context }) => {
  await context.db.update(loan, { id: event.args.loanId }).set({
    liquidating: true,
  });
});

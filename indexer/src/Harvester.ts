import { ponder } from "ponder:registry";
import { loan, harvestEvent, voteEvent } from "ponder:schema";

ponder.on("Harvester:Harvested", async ({ event, context }) => {
  const { loanId, epoch, musdIn, toDebt, fee, surplus, bounty } = event.args;

  await context.db.insert(harvestEvent).values({
    id: `${loanId}-${epoch}`,
    loanId,
    epoch,
    musdIn,
    toDebt,
    fee,
    surplus,
    bounty,
    keeper: event.transaction.from,
    timestamp: event.block.timestamp,
    txHash: event.transaction.hash,
  });

  await context.db.update(loan, { id: loanId }).set((row) => ({
    principal: row.principal >= toDebt ? row.principal - toDebt : 0n,
    totalHarvested: row.totalHarvested + musdIn,
    totalRepaid: row.totalRepaid + toDebt,
    lastHarvestEpoch: epoch,
    missedEpochs: toDebt > 0n ? 0 : row.missedEpochs + 1,
  }));
});

ponder.on("Harvester:Voted", async ({ event, context }) => {
  const { loanId, epoch } = event.args;
  await context.db.insert(voteEvent).values({
    id: `${loanId}-${epoch}`,
    loanId,
    epoch,
    timestamp: event.block.timestamp,
  });
});

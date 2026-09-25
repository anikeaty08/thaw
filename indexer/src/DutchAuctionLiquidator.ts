import { ponder } from "ponder:registry";
import { auction } from "ponder:schema";

ponder.on("DutchAuctionLiquidator:AuctionStarted", async ({ event, context }) => {
  await context.db.insert(auction).values({
    id: event.args.loanId,
    adapter: event.args.adapter,
    tokenId: event.args.tokenId,
    startPrice: event.args.startPrice,
    floorPrice: event.args.floorPrice,
    startedAt: event.block.timestamp,
  });
});

ponder.on("DutchAuctionLiquidator:AuctionSettled", async ({ event, context }) => {
  const { loanId, buyer, price, debtPortion, penalty, borrowerAmount, badDebt } = event.args;
  await context.db.update(auction, { id: loanId }).set({
    settled: true,
    buyer,
    clearingPrice: price,
    debtPortion,
    penalty,
    borrowerAmount,
    badDebt,
    settledAt: event.block.timestamp,
  });
});

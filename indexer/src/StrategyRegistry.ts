import { ponder } from "ponder:registry";
import { strategyPost } from "ponder:schema";

ponder.on("StrategyRegistry:StrategyPosted", async ({ event, context }) => {
  const { adapter, epoch, strategyHash } = event.args;
  await context.db.insert(strategyPost).values({
    id: `${adapter}-${epoch}`,
    adapter,
    epoch,
    strategyHash,
    timestamp: event.block.timestamp,
  });
});

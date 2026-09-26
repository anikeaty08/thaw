import cron from "node-cron";
import { config } from "./config.js";
import { runHarvestJob } from "./jobs/harvest.js";
import { runLiquidationSweep } from "./jobs/liquidate.js";

console.log("[keeper] starting Thaw keeper");
console.log(`[keeper] harvest cron: "${config.harvestCron}" (default: Thu 00:05 UTC, §10.1)`);
console.log(`[keeper] health-check cron: "${config.healthCheckCron}" (default: every 10 min, §10.2)`);

cron.schedule(config.harvestCron, () => {
  console.log("[keeper] harvest job firing");
  runHarvestJob().catch((err) => console.error("[keeper] harvest job crashed:", err));
});

cron.schedule(config.healthCheckCron, () => {
  runLiquidationSweep().catch((err) => console.error("[keeper] liquidation sweep crashed:", err));
});

// Run an immediate liquidation sweep on boot so a restart doesn't leave underwater loans
// unattended until the next cron tick.
runLiquidationSweep().catch((err) => console.error("[keeper] initial liquidation sweep failed:", err));

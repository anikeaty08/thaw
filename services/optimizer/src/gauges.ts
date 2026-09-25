import { readFileSync } from "node:fs";
import type { Address } from "viem";
import { config } from "./config.js";

export interface GaugeState {
  gauge: Address;
  bribePoolUsd: bigint; // estimated total bribes available next epoch, 1e18
  existingVotes: bigint; // current total voting power on the gauge, 1e18
}

export interface AdapterGaugeUniverse {
  ourVotingPower: bigint; // Thaw's aggregate voting power for this adapter this epoch, 1e18
  gauges: GaugeState[];
}

interface GaugesConfigFile {
  adapters: Record<
    string,
    { ourVotingPower: string; gauges: { gauge: string; bribePoolUsd: string; existingVotes: string }[] }
  >;
}

/// Loads the gauge universe from GAUGES_CONFIG_PATH. Real on-chain enumeration needs the Mezo
/// boost-voter ABI, which isn't confirmed yet (docs/THAW_SYSTEM_DESIGN.md §22) — see .env.example.
export function loadGaugeUniverse(adapter: Address): AdapterGaugeUniverse {
  const raw = readFileSync(config.gaugesConfigPath, "utf-8");
  const parsed = JSON.parse(raw) as GaugesConfigFile;
  const entry = parsed.adapters[adapter] ?? parsed.adapters[adapter.toLowerCase()];
  if (!entry) return { ourVotingPower: 0n, gauges: [] };
  return {
    ourVotingPower: BigInt(entry.ourVotingPower),
    gauges: entry.gauges.map((e) => ({
      gauge: e.gauge as Address,
      bribePoolUsd: BigInt(e.bribePoolUsd),
      existingVotes: BigInt(e.existingVotes),
    })),
  };
}

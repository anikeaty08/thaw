import type { Address } from "viem";
import type { GaugeState } from "./gauges.js";

const BPS_DENOM = 10_000n;
const PRECISION = 10n ** 18n;

export interface Allocation {
  gauge: Address;
  weightBps: bigint;
}

/// Greedy water-filling vote allocator (docs/THAW_SYSTEM_DESIGN.md §10.3): repeatedly gives the
/// next slice of our voting power to whichever gauge currently has the highest marginal
/// incentive-per-vote (bribePool / (existingVotes + power already committed to it + this slice)),
/// restricted to at most `maxVotingNum` distinct gauges. Discretizing into `steps` slices keeps
/// this exact-integer (bigint) and avoids floating point entirely.
export function waterFillAllocate(
  gauges: GaugeState[],
  ourVotingPower: bigint,
  maxVotingNum: number,
  steps = 200,
): Allocation[] {
  if (gauges.length === 0 || ourVotingPower === 0n) return [];

  const candidates = gauges.filter((g) => g.bribePoolUsd > 0n);
  if (candidates.length === 0) return [];

  const allocated = new Map<Address, bigint>(candidates.map((g) => [g.gauge, 0n]));
  const activeSet = new Set<Address>();
  const slice = ourVotingPower / BigInt(steps);
  let remainder = ourVotingPower - slice * BigInt(steps);

  const marginalValue = (g: GaugeState, thisSlice: bigint): bigint => {
    const denom = g.existingVotes + (allocated.get(g.gauge) ?? 0n) + thisSlice;
    if (denom === 0n) return 0n;
    return (g.bribePoolUsd * PRECISION) / denom;
  };

  for (let i = 0; i < steps; i++) {
    const thisSlice = slice + (i === steps - 1 ? remainder : 0n);
    if (thisSlice === 0n) continue;

    let best: GaugeState | undefined;
    let bestValue = -1n;
    for (const g of candidates) {
      const isActive = activeSet.has(g.gauge);
      if (!isActive && activeSet.size >= maxVotingNum) continue; // gauge cap reached, can't open a new slot
      const value = marginalValue(g, thisSlice);
      if (value > bestValue) {
        bestValue = value;
        best = g;
      }
    }
    if (!best) break; // every candidate is either capped out or worthless

    activeSet.add(best.gauge);
    allocated.set(best.gauge, (allocated.get(best.gauge) ?? 0n) + thisSlice);
  }

  const totalAllocated = [...allocated.values()].reduce((a, b) => a + b, 0n);
  if (totalAllocated === 0n) return [];

  const result: Allocation[] = [];
  let bpsUsed = 0n;
  const entries = [...allocated.entries()].filter(([, amt]) => amt > 0n);
  entries.forEach(([gauge, amt], idx) => {
    const isLast = idx === entries.length - 1;
    const weightBps = isLast ? BPS_DENOM - bpsUsed : (amt * BPS_DENOM) / totalAllocated;
    bpsUsed += weightBps;
    result.push({ gauge, weightBps });
  });

  return result;
}

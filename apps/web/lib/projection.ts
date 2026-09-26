import { nextHarvestAt } from "@/components/ui/NextHarvest";

const WEEK_MS = 7 * 24 * 3600 * 1000;
const MAX_WEEKS = 156;

export interface ProjectedStep {
  timestamp: number; // seconds
  debt: number;
}

/**
 * Walks a loan forward one Thursday at a time: a week of fixed-APR interest accrues, then that
 * week's harvest pays `weeklyPaydown` off, mirroring LoanManager's accrue-then-applyHarvest order.
 * Returns [] when rewards can't outpace interest, so the UI never promises a payoff that won't come.
 */
export function projectPayoff(currentDebt: number, weeklyPaydown: number, aprBps: number, now = new Date()): ProjectedStep[] {
  if (!(currentDebt > 0) || !(weeklyPaydown > 0)) return [];
  const weeklyRate = aprBps / 10_000 / 52;
  if (weeklyPaydown <= currentDebt * weeklyRate) return [];

  const steps: ProjectedStep[] = [];
  let debt = currentDebt;
  let at = nextHarvestAt(now).getTime();
  for (let i = 0; i < MAX_WEEKS && debt > 0.005; i++, at += WEEK_MS) {
    debt = Math.max(0, debt * (1 + weeklyRate) - weeklyPaydown);
    steps.push({ timestamp: Math.floor(at / 1000), debt });
  }
  return debt > 0.005 ? [] : steps;
}

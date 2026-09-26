const WAD = 10n ** 18n;

export function formatMusd(value: bigint | undefined, opts: { compact?: boolean } = {}): string {
  if (value === undefined) return "—";
  const whole = value / WAD;
  const frac = value % WAD;
  const asNumber = Number(whole) + Number(frac) / 1e18;
  if (opts.compact) {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(asNumber);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(asNumber);
}

export function formatHealthFactor(hf: bigint | undefined): string {
  if (hf === undefined) return "—";
  if (hf >= (1n << 200n)) return "∞";
  return (Number(hf) / 1e18).toFixed(2);
}

export function bpsToPercent(bps: number | bigint): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(n / 100).toFixed(1)}%`;
}

export function shortAddress(address: string | undefined): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function weeksUntil(payoffTimestampSec: number): string {
  const now = Date.now() / 1000;
  const weeks = Math.max(0, Math.ceil((payoffTimestampSec - now) / (7 * 24 * 3600)));
  if (weeks === 0) return "This week";
  if (weeks === 1) return "1 week";
  return `${weeks} weeks`;
}

export function formatDate(timestampSec: number): string {
  return new Date(timestampSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

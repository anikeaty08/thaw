"use client";

import { Icon } from "@/components/ui/Icon";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface DebtPoint {
  label: string;
  timestamp: number;
  /** Actual debt from harvest history. */
  debt?: number;
  /** Projected debt going forward. The first projected point repeats the last actual one so the lines join. */
  projected?: number;
}

const FROST = "#2d9cff";
const EMBER = "#f77f3a";

export function DebtMeltChart({
  data,
  payoffLabel,
  currency = "MUSD",
}: {
  data: DebtPoint[];
  /** e.g. "Dec 11, 2026"; shown when a projection exists. */
  payoffLabel?: string;
  currency?: string;
}) {
  const actual = data.filter((d) => d.debt !== undefined);
  if (actual.length === 0 && !data.some((d) => d.projected !== undefined)) {
    return <EmptyMeltState />;
  }

  const latest = actual[actual.length - 1];

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="meltLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={FROST} />
              <stop offset="100%" stopColor={EMBER} />
            </linearGradient>
            <linearGradient id="meltFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={FROST} stopOpacity={0.16} />
              <stop offset="100%" stopColor={EMBER} stopOpacity={0.16} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={48} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${Math.round(v)}`)}
          />
          <Tooltip content={<MeltTooltip currency={currency} />} cursor={{ stroke: FROST, strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="debt"
            stroke="url(#meltLine)"
            strokeWidth={2}
            fill="url(#meltFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke={EMBER}
            strokeOpacity={0.75}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 text-xs text-mist-400">
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-thaw-gradient" aria-hidden />
            Actual
          </span>
          {payoffLabel && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-[1.5px] border-dashed border-ember-500" aria-hidden />
              Projected
            </span>
          )}
        </span>
        <span>
          {latest && (
            <>
              Now <span className="tabular font-medium text-frostwhite">{formatCompact(latest.debt!)} {currency}</span>
            </>
          )}
          {payoffLabel && (
            <>
              <span className="mx-2 text-mist-500">·</span>
              Paid off around <span className="font-medium text-ember-400">{payoffLabel}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

function MeltTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  const actual = payload.find((p: any) => p.dataKey === "debt");
  const projected = payload.find((p: any) => p.dataKey === "projected");
  const row = actual?.value !== undefined ? actual : projected;
  if (!row) return null;
  const isProjection = row === projected;
  return (
    <div className="rounded-lg border border-glacier-600 bg-glacier-900 px-3 py-2 shadow-frost">
      <div className="tabular text-sm font-medium text-frostwhite">
        {formatCompact(row.value as number)} {currency}
      </div>
      <div className="mt-0.5 text-xs text-mist-400">
        {label}
        {isProjection && " (projected)"}
      </div>
    </div>
  );
}

function EmptyMeltState() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-glacier-700 px-6 text-center">
      <Icon name="snowflake" size={20} className="text-frost-300" />
      <p className="text-sm text-mist-300">Nothing has melted yet</p>
      <p className="text-xs text-mist-500">The debt line starts dropping after this loan's first Thursday harvest.</p>
    </div>
  );
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
}

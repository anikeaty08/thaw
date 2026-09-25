"use client";

import { Icon } from "@/components/ui/Icon";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface DebtPoint {
  label: string;
  timestamp: number;
  debt: number;
}

const FROST = "#2d9cff";
const EMBER = "#f77f3a";

export function DebtMeltChart({ data, currency = "MUSD" }: { data: DebtPoint[]; currency?: string }) {
  if (data.length === 0) {
    return <EmptyMeltState />;
  }

  const latest = data[data.length - 1];

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
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
          <CartesianGrid stroke="#172536" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8b9aad", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#8b9aad", fontSize: 11 }}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`)}
          />
          <Tooltip content={<MeltTooltip currency={currency} />} cursor={{ stroke: "#2d9cff", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="debt"
            stroke="url(#meltLine)"
            strokeWidth={2}
            fill="url(#meltFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#00050b" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-end pr-2 text-xs text-mist-400">
        current: <span className="ml-1 font-medium text-ember-400">{formatCompact(latest.debt)} {currency}</span>
      </div>
    </div>
  );
}

function MeltTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value as number;
  return (
    <div className="rounded-lg border border-glacier-600 bg-glacier-900 px-3 py-2 shadow-frost">
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: "linear-gradient(90deg, #2d9cff, #f77f3a)" }} />
        <span className="font-display text-sm text-frostwhite">
          {formatCompact(value)} {currency}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-mist-400">{label}</div>
    </div>
  );
}

function EmptyMeltState() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-glacier-700 px-6 text-center">
      <Icon name="snowflake" size={20} className="text-frost-300" />
      <p className="text-sm text-mist-300">Nothing has melted yet</p>
      <p className="text-xs text-mist-500">The debt line starts dropping after this loan's first Thursday harvest.</p>
    </div>
  );
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
}

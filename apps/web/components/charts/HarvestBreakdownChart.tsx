"use client";

import { Icon } from "@/components/ui/Icon";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface HarvestBar {
  label: string;
  toDebt: number;
  surplus: number;
  overhead: number; // protocol fee + keeper bounty
}

const SERIES = [
  { key: "toDebt", name: "Paid to debt", color: "#f77f3a" },
  { key: "surplus", name: "Sent to you", color: "#2d9cff" },
  { key: "overhead", name: "Fee and keeper bounty", color: "#6b7c92" },
] as const;

export function HarvestBreakdownChart({ data }: { data: HarvestBar[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-glacier-700 px-6 text-center">
        <Icon name="drop" size={20} className="text-ember-400" />
        <p className="text-sm text-mist-300">No harvests yet</p>
        <p className="text-xs text-mist-500">Each Thursday adds a bar showing where that week's rewards went.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-mist-300">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke="#172536" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#8b9aad", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8b9aad", fontSize: 11 }} width={44} />
          <Tooltip content={<HarvestTooltip />} cursor={{ fill: "rgba(110,203,230,0.06)" }} />
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="epoch"
              fill={s.color}
              maxBarSize={22}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HarvestTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-glacier-600 bg-glacier-900 px-3 py-2 shadow-frost">
      <div className="text-xs text-mist-400">{label}</div>
      <div className="mt-1 space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-sm">
            <span className="h-0.5 w-3 rounded-full" style={{ background: p.color }} />
            <span className="font-medium text-frostwhite">{p.value.toFixed(2)}</span>
            <span className="text-xs text-mist-400">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const FROST = "#2d9cff";

export function AuctionPriceChart({
  startPrice,
  floorPrice,
  startedAt,
  currentPrice,
}: {
  startPrice: number;
  floorPrice: number;
  startedAt: number;
  currentPrice: number;
}) {
  const durationHrs = 24;
  const points = Array.from({ length: 25 }, (_, i) => {
    const price = Math.max(floorPrice, startPrice - ((startPrice - floorPrice) * i) / durationHrs);
    return { hour: i, price };
  });

  const elapsedHrs = Math.min(durationHrs, (Date.now() / 1000 - startedAt) / 3600);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="hour"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8b9aad", fontSize: 11 }}
          tickFormatter={(h: number) => `${h}h`}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8b9aad", fontSize: 11 }} width={56} />
        <Tooltip content={<AuctionTooltip />} cursor={{ stroke: "#2d9cff", strokeWidth: 1 }} />
        <ReferenceLine y={floorPrice} stroke="#6b7c92" strokeDasharray="4 4" label={{ value: "Reserve floor", fill: "#8b9aad", fontSize: 10, position: "insideBottomRight" }} />
        <Line type="linear" dataKey="price" stroke={FROST} strokeWidth={2} dot={false} />
        <ReferenceDot x={Math.round(elapsedHrs)} y={currentPrice} r={5} fill="#f77f3a" stroke="#00050b" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AuctionTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-glacier-600 bg-glacier-900 px-3 py-2 shadow-frost">
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full bg-frost-400" />
        <span className="font-display text-sm text-frostwhite">{p.value.toFixed(2)} MUSD</span>
      </div>
      <div className="mt-0.5 text-xs text-mist-400">hour {p.payload.hour}</div>
    </div>
  );
}

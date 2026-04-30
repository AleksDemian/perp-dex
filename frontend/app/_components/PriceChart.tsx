"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { useTraderPositions } from "@/hooks/usePositions";
import { useAccount } from "wagmi";
import { format } from "date-fns";

type Range = "1H" | "4H" | "1D" | "ALL";

const RANGES: Range[] = ["1H", "4H", "1D", "ALL"];

interface ChartPoint {
  ts: number;
  price: number;
  label: string;
}

export function PriceChart() {
  const [range, setRange] = useState<Range>("1D");
  const { data } = usePriceHistory(range);
  const { address } = useAccount();
  const { data: traderData } = useTraderPositions(address);

  const points: ChartPoint[] = useMemo(() => {
    if (!data?.points?.length) return [];
    return data.points.map((p) => ({
      ts:    p.timestamp,
      price: Number(BigInt(p.price) / 10n ** 14n) / 10_000, // 1e18 → dollar float
      label: format(new Date(p.timestamp * 1000), "HH:mm"),
    }));
  }, [data]);

  const entryLines = useMemo(() => {
    if (!traderData?.positions) return [];
    return traderData.positions
      .filter((p) => p.is_open === 1)
      .map((p) => Number(BigInt(p.entry_price) / 10n ** 14n) / 10_000);
  }, [traderData]);

  const minPrice = points.length ? Math.min(...points.map((p) => p.price)) * 0.998 : 0;
  const maxPrice = points.length ? Math.max(...points.map((p) => p.price)) * 1.002 : 100_000;

  return (
    <div className="rounded-lg border border-border bg-surface-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">Price Chart</span>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={[
                "rounded px-2 py-0.5 text-xs transition-colors",
                range === r
                  ? "bg-border text-text-primary"
                  : "text-text-dim hover:text-text-muted",
              ].join(" ")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-xs text-text-muted">
          No price data yet — update the price in Admin to see the chart.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
              width={72}
            />
            <Tooltip
              contentStyle={{
                background: "#141c2b",
                border: "1px solid #1e293b",
                borderRadius: 4,
                fontSize: 11,
              }}
              labelStyle={{ color: "#94a3b8" }}
              formatter={(v) => [`$${Number(v).toLocaleString()}`, "Price"]}
            />
            {entryLines.map((price, i) => (
              <ReferenceLine
                key={i}
                y={price}
                stroke="#bcfb9f"
                strokeDasharray="4 2"
                strokeOpacity={0.5}
              />
            ))}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#bcfb9f"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#bcfb9f" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

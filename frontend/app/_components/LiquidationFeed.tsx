"use client";

import { useLiquidations } from "@/hooks/useLiquidations";
import { formatUsdc, formatPrice, priceToBigInt, usdcToBigInt } from "@/lib/perp-math";
import { formatDistanceToNowStrict } from "date-fns";

export function LiquidationFeed() {
  const { data } = useLiquidations(20);
  const liquidations = data?.liquidations ?? [];

  return (
    <div className="rounded-lg border border-border bg-surface-card">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Liquidations
        </span>
        <span className="text-xs text-text-dim">{liquidations.length}</span>
      </div>

      {liquidations.length === 0 ? (
        <div className="px-4 py-6 text-xs text-text-muted text-center">
          No liquidations yet.
        </div>
      ) : (
        <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
          {liquidations.map((l) => (
            <div
              key={`${l.tx_hash}-${l.log_index}`}
              className="px-4 py-2 hover:bg-surface-hover"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${l.is_long ? "text-yes" : "text-no"}`}
                  >
                    {l.is_long ? "Long" : "Short"}
                  </span>
                  <span className="text-xs text-text-dim">#{l.position_id}</span>
                </div>
                <span className="font-mono text-xs text-warning">
                  {formatPrice(priceToBigInt(l.mark_price))}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-xs text-text-dim">
                <span className="truncate max-w-[120px]">
                  {l.trader.slice(0, 6)}…{l.trader.slice(-4)}
                </span>
                <span>
                  +${formatUsdc(usdcToBigInt(l.bonus))} bonus ·{" "}
                  {formatDistanceToNowStrict(new Date(l.timestamp * 1000), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

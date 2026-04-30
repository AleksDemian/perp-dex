"use client";

import { useCurrentPrice } from "@/hooks/useCurrentPrice";
import { usePositions } from "@/hooks/usePositions";
import { useLiquidations } from "@/hooks/useLiquidations";
import { formatPrice } from "@/lib/perp-math";
import { MARKET_SYMBOL } from "@/lib/contracts";

export function MarketBar() {
  const { data: priceData } = useCurrentPrice();
  const { data: posData } = usePositions("open");
  const { data: liqData   } = useLiquidations(100);

  const price = priceData?.price ? BigInt(priceData.price) : null;
  const openCount =
    posData &&
    typeof posData === "object" &&
    "total" in posData &&
    typeof posData.total === "number"
      ? posData.total
      : 0;
  const liq24h     = (liqData?.liquidations ?? []).filter(
    (l) => l.timestamp > Date.now() / 1000 - 86_400
  ).length;

  return (
    <div className="flex items-center gap-6 border-b border-border bg-surface px-4 py-2 text-xs">
      <span className="font-semibold text-text-primary">{MARKET_SYMBOL}</span>

      <div className="flex items-center gap-1">
        <span className="text-text-muted">Mark</span>
        <span className="font-mono font-semibold text-brand">
          {price ? formatPrice(price) : "—"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-text-muted">Open</span>
        <span className="font-mono text-text-primary">{openCount}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-text-muted">Liq 24h</span>
        <span className={`font-mono ${liq24h > 0 ? "text-no" : "text-text-primary"}`}>
          {liq24h}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
        <span className="text-text-dim">Live</span>
      </div>
    </div>
  );
}

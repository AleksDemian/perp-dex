"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { useCurrentPrice } from "@/hooks/useCurrentPrice";
import { useLiquidate } from "@/hooks/usePerp";
import { useLiquidations, type LiquidationRow } from "@/hooks/useLiquidations";
import { PRICE_FEED_ABI, PRICE_FEED_ADDRESS } from "@/lib/contracts";
import {
  formatUsdc,
  formatPrice,
  priceToBigInt,
  usdcToBigInt,
} from "@/lib/perp-math";
import { formatDistanceToNowStrict } from "date-fns";

// 0.50% of opening notional — mirrors LIQUIDATION_BONUS_BPS in PerpEngine.sol
const BONUS_BPS = 50n;

interface AtRiskPosition {
  id: number;
  trader: string;
  is_long: number;
  collateral: string;
  leverage: number;
  notional: string;
  entry_price: string;
  liquidation_price: string;
  distanceBps: number;
}

function calcBonus(notional: string): bigint {
  return (usdcToBigInt(notional) * BONUS_BPS) / 10_000n;
}

// ── Per-row liquidate button with isolated pending/error state ──────────────
function LiquidateButton({ positionId }: { positionId: number }) {
  const { liquidate, isPending } = useLiquidate();
  const [err, setErr] = useState("");

  async function handle() {
    try {
      setErr("");
      await liquidate(positionId);
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 60) : "tx failed");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={isPending}
        className="rounded border border-no/70 bg-no px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-no-muted disabled:opacity-50"
      >
        {isPending ? "Confirming…" : "Liquidate"}
      </button>
      {err && (
        <span className="max-w-[140px] text-right text-xs text-no opacity-80">
          {err}
        </span>
      )}
    </div>
  );
}

// ── At-risk positions table ─────────────────────────────────────────────────
function AtRiskTable({
  positions,
  showAction,
}: {
  positions: AtRiskPosition[];
  showAction: boolean;
}) {
  if (positions.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-text-muted">
        No positions in this category.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-text-dim">
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Side</th>
            <th className="px-3 py-2 text-left">Trader</th>
            <th className="px-3 py-2 text-right">Entry</th>
            <th className="px-3 py-2 text-right">Liq Price</th>
            <th className="px-3 py-2 text-right">Distance</th>
            <th className="px-3 py-2 text-right">Bonus</th>
            {showAction && <th className="px-3 py-2 text-right" />}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border/50 hover:bg-surface-hover"
            >
              <td className="px-3 py-2 font-mono text-text-dim">#{p.id}</td>
              <td className="px-3 py-2">
                <span className={`font-semibold ${p.is_long ? "text-yes" : "text-no"}`}>
                  {p.is_long ? "Long" : "Short"}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-text-dim">
                {p.trader.slice(0, 6)}…{p.trader.slice(-4)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-secondary">
                {formatPrice(priceToBigInt(p.entry_price))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-no">
                {formatPrice(priceToBigInt(p.liquidation_price))}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {p.distanceBps === 0 ? (
                  <span className="font-semibold text-no">NOW</span>
                ) : (
                  <span className="text-warning">
                    {(p.distanceBps / 100).toFixed(1)}%
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono text-yes">
                +${formatUsdc(calcBonus(p.notional))}
              </td>
              {showAction && (
                <td className="px-3 py-2 text-right">
                  <LiquidateButton positionId={p.id} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Recent liquidations mini-feed ───────────────────────────────────────────
function RecentLiquidations({ rows }: { rows: LiquidationRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-text-muted">
        No liquidations yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-text-dim">
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Side</th>
            <th className="px-3 py-2 text-left">Trader</th>
            <th className="px-3 py-2 text-left">Liquidator</th>
            <th className="px-3 py-2 text-right">Mark Price</th>
            <th className="px-3 py-2 text-right">Bonus Paid</th>
            <th className="px-3 py-2 text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr
              key={`${l.tx_hash}-${l.log_index}`}
              className="border-b border-border/50 hover:bg-surface-hover"
            >
              <td className="px-3 py-2 font-mono text-text-dim">
                #{l.position_id}
              </td>
              <td className="px-3 py-2">
                {l.is_long != null ? (
                  <span className={`font-semibold ${l.is_long ? "text-yes" : "text-no"}`}>
                    {l.is_long ? "Long" : "Short"}
                  </span>
                ) : (
                  <span className="text-text-dim">—</span>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-text-dim">
                {l.trader.slice(0, 6)}…{l.trader.slice(-4)}
              </td>
              <td className="px-3 py-2 font-mono text-text-dim">
                {l.liquidator.slice(0, 6)}…{l.liquidator.slice(-4)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-text-secondary">
                {formatPrice(priceToBigInt(l.mark_price))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-yes">
                +${formatUsdc(usdcToBigInt(l.bonus))}
              </td>
              <td className="px-3 py-2 text-right text-text-dim">
                {formatDistanceToNowStrict(new Date(l.timestamp * 1000), {
                  addSuffix: true,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function LiquidationsPage() {
  const { data: priceData }   = useCurrentPrice();
  const { data: historyData } = useLiquidations(50);
  const { data: chainPrice } = useReadContract({
    address: PRICE_FEED_ADDRESS,
    abi: PRICE_FEED_ABI,
    functionName: "latestPrice",
    query: { refetchInterval: 15_000, refetchOnWindowFocus: false },
  });

  const markStr = priceData?.price ?? (chainPrice ? chainPrice.toString() : "0");

  const { data: atRiskData, isLoading } = useQuery<{
    positions: AtRiskPosition[];
  }>({
    queryKey: ["positions", "at-risk", markStr],
    queryFn: async () => {
      const r = await fetch(`/api/positions/at-risk?mark=${markStr}`);
      const json = await r.json();
      return json;
    },
    enabled: !!markStr && markStr !== "0",
    refetchOnWindowFocus: false,
  });

  const allPositions = atRiskData?.positions ?? [];
  const liquidatable = allPositions.filter((p) => p.distanceBps === 0);
  const atRisk       = allPositions.filter((p) => p.distanceBps > 0);
  const history      = historyData?.liquidations ?? [];

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            Liquidations
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">
            Liquidate under-margined positions and earn{" "}
            <span className="text-yes font-semibold">0.50% of notional</span> as bonus.
            Permissionless — any connected wallet can liquidate.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="text-text-dim">Liquidatable Now</span>
            <span className={`font-mono font-semibold ${liquidatable.length > 0 ? "text-no" : "text-text-secondary"}`}>
              {isLoading ? "…" : liquidatable.length}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-text-dim">Watchlist</span>
            <span className={`font-mono font-semibold ${atRisk.length > 0 ? "text-warning" : "text-text-secondary"}`}>
              {isLoading ? "…" : atRisk.length}
            </span>
          </div>
        </div>
      </div>

      {/* Liquidatable Now */}
      <div className="rounded-lg border border-no/30 bg-surface-card">
        <div className="flex items-center justify-between border-b border-no/20 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-no" />
            <span className="text-xs font-medium uppercase tracking-wider text-no">
              Liquidatable Now
            </span>
          </div>
          <span className="text-xs text-text-dim">{liquidatable.length}</span>
        </div>
        <AtRiskTable positions={liquidatable} showAction />
      </div>

      {/* Watchlist */}
      <div className="rounded-lg border border-warning/30 bg-surface-card">
        <div className="flex items-center justify-between border-b border-warning/20 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-xs font-medium uppercase tracking-wider text-warning">
              Watchlist — within 10% of liquidation
            </span>
          </div>
          <span className="text-xs text-text-dim">{atRisk.length}</span>
        </div>
        <AtRiskTable positions={atRisk} showAction={false} />
      </div>

      {/* History */}
      <div className="rounded-lg border border-border bg-surface-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Liquidation History
          </span>
          <span className="text-xs text-text-dim">{history.length}</span>
        </div>
        <RecentLiquidations rows={history} />
      </div>

    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { MARKET_SYMBOL } from "@/lib/contracts";
import {
  calcMarginRatio,
  calcPnlUsdc,
  formatPnl,
  formatPrice,
  formatUsdc,
  priceToBigInt,
  usdcToBigInt,
} from "@/lib/perp-math";
import { useCurrentPrice } from "@/hooks/useCurrentPrice";
import { useTraderPositions, type PositionRow } from "@/hooks/usePositions";
import { useClosePosition } from "@/hooks/usePerp";

type DashboardTab = "positions" | "history";

const TOKEN_DECIMALS = 18n;
const TOKEN_PRECISION = 10n ** TOKEN_DECIMALS;

function pnlPctOfCollateral(pnl: bigint, collateral: bigint): number {
  if (collateral === 0n) return 0;
  return Number((pnl * 10_000n) / collateral) / 100;
}

function formatTokenAmount(amount: bigint, decimals = 4): string {
  const whole = amount / TOKEN_PRECISION;
  const frac = amount % TOKEN_PRECISION;
  const fracStr = frac.toString().padStart(Number(TOKEN_DECIMALS), "0").slice(0, decimals);
  return `${whole.toLocaleString()}.${fracStr}`;
}

function tokensToBigInt(tokenString: string): bigint {
  try {
    return BigInt(tokenString);
  } catch {
    return 0n;
  }
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function EmptyRow({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-xs text-text-muted">
        {children}
      </td>
    </tr>
  );
}

function PnlCell({ position, markPrice }: { position: PositionRow; markPrice: bigint | null }) {
  const collateral = usdcToBigInt(position.collateral);
  const pnl = position.is_open === 1 && markPrice !== null
    ? calcPnlUsdc(
        tokensToBigInt(position.size_tokens),
        priceToBigInt(position.entry_price),
        markPrice,
        position.is_long === 1
      )
    : position.realized_pnl
      ? BigInt(position.realized_pnl)
      : null;

  if (pnl === null) {
    return <span className="text-text-dim">-</span>;
  }

  const pct = pnlPctOfCollateral(pnl, collateral);

  return (
    <div className="text-right">
      <div className={`font-mono text-xs font-medium ${pnl >= 0n ? "text-yes" : "text-no"}`}>
        {formatPnl(pnl)}
      </div>
      <div className={`font-mono text-[11px] ${pnl >= 0n ? "text-yes/70" : "text-no/70"}`}>
        {pct >= 0 ? "+" : ""}
        {pct.toFixed(1)}%
      </div>
    </div>
  );
}

function HealthCell({ position, markPrice }: { position: PositionRow; markPrice: bigint | null }) {
  if (markPrice === null) return <span className="text-text-dim">-</span>;

  const pnl = calcPnlUsdc(
    tokensToBigInt(position.size_tokens),
    priceToBigInt(position.entry_price),
    markPrice,
    position.is_long === 1
  );
  const ratio = calcMarginRatio(
    usdcToBigInt(position.collateral),
    pnl,
    usdcToBigInt(position.notional)
  );
  const color = ratio <= 5 ? "text-no" : ratio <= 10 ? "text-warning" : "text-yes";

  return (
    <span className={`font-mono text-xs ${color}`}>
      {ratio < 0 ? "<0" : ratio.toFixed(1)}%
    </span>
  );
}

function CloseButton({ position, markPrice }: { position: PositionRow; markPrice: bigint | null }) {
  const { closePosition, isPending } = useClosePosition();
  const isLiquidatable = (() => {
    if (markPrice === null) return false;
    const liqPrice = priceToBigInt(position.liquidation_price);
    return position.is_long === 1 ? markPrice <= liqPrice : markPrice >= liqPrice;
  })();

  if (isLiquidatable) {
    return (
      <span className="rounded border border-no-muted px-2 py-0.5 text-[11px] text-no/80">
        Liquidatable
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        closePosition(position.id).catch(() => undefined);
      }}
      disabled={isPending}
      className="rounded border border-border px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:border-brand/60 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Closing..." : "Close"}
    </button>
  );
}

function PositionsTable({
  isConnected,
  isLoading,
  positions,
  markPrice,
}: {
  isConnected: boolean;
  isLoading: boolean;
  positions: PositionRow[];
  markPrice: bigint | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-xs">
        <thead>
          <tr className="border-b border-border/80 text-text-dim">
            <th className="px-4 py-2 text-left font-medium">Coin</th>
            <th className="px-3 py-2 text-left font-medium">Side</th>
            <th className="px-3 py-2 text-right font-medium">Size</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
            <th className="px-3 py-2 text-right font-medium">Entry</th>
            <th className="px-3 py-2 text-right font-medium">Mark</th>
            <th className="px-3 py-2 text-right font-medium">Liq Price</th>
            <th className="px-3 py-2 text-right font-medium">Margin</th>
            <th className="px-3 py-2 text-right font-medium">Health</th>
            <th className="px-3 py-2 text-right font-medium">PnL</th>
            <th className="px-4 py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {!isConnected && <EmptyRow colSpan={11}>Connect wallet to view positions.</EmptyRow>}
          {isConnected && isLoading && <EmptyRow colSpan={11}>Loading positions...</EmptyRow>}
          {isConnected && !isLoading && positions.length === 0 && (
            <EmptyRow colSpan={11}>No open positions yet.</EmptyRow>
          )}
          {isConnected && !isLoading && positions.map((position) => (
            <tr key={position.id} className="border-b border-border/40 text-text-secondary transition-colors hover:bg-surface-hover/70">
              <td className="px-4 py-2.5 font-mono text-text-primary">{MARKET_SYMBOL}</td>
              <td className="px-3 py-2.5">
                <span className={`font-semibold ${position.is_long === 1 ? "text-yes" : "text-no"}`}>
                  {position.is_long === 1 ? "Long" : "Short"}
                </span>
                <span className="ml-1 font-mono text-text-dim">{position.leverage}x</span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {formatTokenAmount(tokensToBigInt(position.size_tokens))}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                ${formatUsdc(usdcToBigInt(position.notional))}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {formatPrice(priceToBigInt(position.entry_price))}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                {markPrice !== null ? formatPrice(markPrice) : "-"}
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-no">
                {formatPrice(priceToBigInt(position.liquidation_price))}
              </td>
              <td className="px-3 py-2.5 text-right font-mono">
                ${formatUsdc(usdcToBigInt(position.collateral))}
              </td>
              <td className="px-3 py-2.5 text-right">
                <HealthCell position={position} markPrice={markPrice} />
              </td>
              <td className="px-3 py-2.5 text-right">
                <PnlCell position={position} markPrice={markPrice} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <CloseButton position={position} markPrice={markPrice} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradeHistoryTable({
  isConnected,
  isLoading,
  positions,
}: {
  isConnected: boolean;
  isLoading: boolean;
  positions: PositionRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-xs">
        <thead>
          <tr className="border-b border-border/80 text-text-dim">
            <th className="px-4 py-2 text-left font-medium">Time</th>
            <th className="px-3 py-2 text-left font-medium">Coin</th>
            <th className="px-3 py-2 text-left font-medium">Direction</th>
            <th className="px-3 py-2 text-right font-medium">Entry</th>
            <th className="px-3 py-2 text-right font-medium">Exit</th>
            <th className="px-3 py-2 text-right font-medium">Size</th>
            <th className="px-3 py-2 text-right font-medium">Trade Value</th>
            <th className="px-3 py-2 text-right font-medium">Fee</th>
            <th className="px-3 py-2 text-right font-medium">Closed PNL</th>
            <th className="px-4 py-2 text-right font-medium">Kind</th>
          </tr>
        </thead>
        <tbody>
          {!isConnected && <EmptyRow colSpan={10}>Connect wallet to view trade history.</EmptyRow>}
          {isConnected && isLoading && <EmptyRow colSpan={10}>Loading trade history...</EmptyRow>}
          {isConnected && !isLoading && positions.length === 0 && (
            <EmptyRow colSpan={10}>No trades yet.</EmptyRow>
          )}
          {isConnected && !isLoading && positions.map((position) => {
            const pnl = position.realized_pnl ? BigInt(position.realized_pnl) : null;
            return (
              <tr key={position.id} className="border-b border-border/40 text-text-secondary transition-colors hover:bg-surface-hover/70">
                <td className="px-4 py-2.5 font-mono text-text-muted">
                  {formatTime(position.closed_at_ts)}
                </td>
                <td className="px-3 py-2.5 font-mono text-text-primary">{MARKET_SYMBOL}</td>
                <td className="px-3 py-2.5">
                  <span className={`font-semibold ${position.is_long === 1 ? "text-yes" : "text-no"}`}>
                    {position.is_long === 1 ? "Long" : "Short"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {formatPrice(priceToBigInt(position.entry_price))}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {position.exit_price ? formatPrice(priceToBigInt(position.exit_price)) : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {formatTokenAmount(tokensToBigInt(position.size_tokens))}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  ${formatUsdc(usdcToBigInt(position.notional))}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {position.fee_paid ? `$${formatUsdc(usdcToBigInt(position.fee_paid))}` : "-"}
                </td>
                <td className={`px-3 py-2.5 text-right font-mono font-medium ${pnl !== null && pnl >= 0n ? "text-yes" : "text-no"}`}>
                  {pnl !== null ? formatPnl(pnl) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {position.close_kind === "liquidate" ? (
                    <span className="text-warning">Liquidated</span>
                  ) : (
                    <span className="text-text-dim">Closed</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TradingDashboardPanel() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("positions");
  const { address, isConnected } = useAccount();
  const { data, isLoading } = useTraderPositions(address);
  const { data: priceData } = useCurrentPrice();

  const positions = data?.positions ?? [];
  const openPositions = positions.filter((position) => position.is_open === 1);
  const closedPositions = positions.filter((position) => position.is_open === 0);
  const markPrice = priceData?.price ? priceToBigInt(priceData.price) : null;

  const tabs: Array<{ id: DashboardTab; label: string; count: number }> = [
    { id: "positions", label: "Positions", count: openPositions.length },
    { id: "history", label: "Trade History", count: closedPositions.length },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface-card">
      <div className="flex flex-col gap-2 border-b border-border/80 bg-surface/60 px-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-end gap-5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative whitespace-nowrap pb-2 text-xs font-medium transition-colors ${
                  isActive ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                  isActive ? "bg-brand-ghost text-brand" : "bg-border/60 text-text-dim"
                }`}>
                  {tab.count}
                </span>
                {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />}
              </button>
            );
          })}
        </div>

        <div className="pb-2 text-[11px] text-text-dim">
          {isConnected ? "Wallet connected" : "Connect wallet to view data"}
        </div>
      </div>

      {activeTab === "positions" ? (
        <PositionsTable
          isConnected={isConnected}
          isLoading={isLoading}
          positions={openPositions}
          markPrice={markPrice}
        />
      ) : (
        <TradeHistoryTable
          isConnected={isConnected}
          isLoading={isLoading}
          positions={closedPositions}
        />
      )}
    </section>
  );
}

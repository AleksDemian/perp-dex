"use client";

import { useActivity, type ActivityEvent } from "@/hooks/useActivity";
import {
  formatUsdc,
  formatPrice,
  priceToBigInt,
  usdcToBigInt,
} from "@/lib/perp-math";
import { formatDistanceToNowStrict } from "date-fns";

function OpenIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yes-muted text-yes text-xs font-bold flex-shrink-0">
      ↑
    </span>
  );
}

function CloseIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-border text-text-dim text-xs font-bold flex-shrink-0">
      ✕
    </span>
  );
}

function LiquidateIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-no-muted text-no text-xs font-bold flex-shrink-0">
      ⚡
    </span>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const side =
    event.is_long === 1 ? "Long" : event.is_long === 0 ? "Short" : "—";
  const sideColor = event.is_long === 1 ? "text-yes" : "text-no";

  const timeAgo = formatDistanceToNowStrict(
    new Date(event.timestamp * 1000),
    { addSuffix: true }
  );

  const shortAddr = event.trader
    ? `${event.trader.slice(0, 6)}…${event.trader.slice(-4)}`
    : "—";

  if (event.kind === "open") {
    const collateral = event.collateral
      ? formatUsdc(usdcToBigInt(event.collateral))
      : "—";
    const price = event.entry_price
      ? formatPrice(priceToBigInt(event.entry_price))
      : "—";

    return (
      <div className="flex gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
        <OpenIcon />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">
              <span className={`font-semibold ${sideColor}`}>{side}</span>
              <span className="text-text-muted ml-1">opened</span>
              <span className="text-text-dim ml-1">#{event.id}</span>
            </span>
            <span className="text-xs text-text-dim whitespace-nowrap">{timeAgo}</span>
          </div>
          <div className="mt-0.5 flex gap-3 text-xs text-text-dim">
            <span className="font-mono">
              <span className="text-text-muted">${collateral}</span>
              <span className="mx-1">·</span>
              <span>{event.leverage}×</span>
            </span>
            <span className="font-mono text-text-muted">@ {price}</span>
            <span className="truncate">{shortAddr}</span>
          </div>
        </div>
      </div>
    );
  }

  if (event.kind === "close") {
    const pnl = event.realized_pnl ? BigInt(event.realized_pnl) : null;
    const pnlText = pnl !== null
      ? `${pnl >= 0n ? "+" : ""}$${formatUsdc(pnl < 0n ? -pnl : pnl)}`
      : null;
    const pnlColor = pnl !== null && pnl >= 0n ? "text-yes" : "text-no";
    const price = event.exit_price
      ? formatPrice(priceToBigInt(event.exit_price))
      : "—";

    return (
      <div className="flex gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
        <CloseIcon />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">
              <span className={`font-semibold ${sideColor}`}>{side}</span>
              <span className="text-text-muted ml-1">closed</span>
              <span className="text-text-dim ml-1">#{event.id}</span>
              {pnlText && (
                <span className={`ml-2 font-mono font-semibold ${pnlColor}`}>
                  {pnlText}
                </span>
              )}
            </span>
            <span className="text-xs text-text-dim whitespace-nowrap">{timeAgo}</span>
          </div>
          <div className="mt-0.5 flex gap-3 text-xs text-text-dim">
            <span className="font-mono text-text-muted">exit {price}</span>
            <span className="truncate">{shortAddr}</span>
          </div>
        </div>
      </div>
    );
  }

  // liquidate
  const price = event.exit_price
    ? formatPrice(priceToBigInt(event.exit_price))
    : "—";
  const bonus = event.bonus
    ? formatUsdc(usdcToBigInt(event.bonus))
    : "—";

  return (
    <div className="flex gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
      <LiquidateIcon />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs">
            <span className={`font-semibold ${sideColor}`}>{side}</span>
            <span className="text-warning ml-1 font-semibold">liquidated</span>
            <span className="text-text-dim ml-1">#{event.id}</span>
          </span>
          <span className="text-xs text-text-dim whitespace-nowrap">{timeAgo}</span>
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-text-dim">
          <span className="font-mono">
            <span className="text-text-muted">@ {price}</span>
            <span className="mx-1">·</span>
            <span className="text-yes">+${bonus} bonus</span>
          </span>
          <span className="truncate">{shortAddr}</span>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const { data, isLoading } = useActivity(30);
  const events = data?.events ?? [];

  return (
    <div className="rounded-lg border border-border bg-surface-card">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Activity
        </span>
        <div className="flex items-center gap-2 text-xs text-text-dim">
          {isLoading && (
            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <span>{events.length}</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="px-4 py-6 text-xs text-text-muted text-center">
          No activity yet.
        </div>
      ) : (
        <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
          {events.map((e, i) => (
            <EventRow key={`${e.kind}-${e.id}-${e.timestamp}-${i}`} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

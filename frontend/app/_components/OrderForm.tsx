"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useOpenPosition,
  useUsdcBalance,
} from "@/hooks/usePerp";
import { useCurrentPrice } from "@/hooks/useCurrentPrice";
import {
  calcLiquidationPrice,
  calcOpenFee,
  calcNotional,
  calcSizeTokens,
  formatUsdc,
  formatPrice,
  priceToBigInt,
} from "@/lib/perp-math";

const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10];

export function OrderForm() {
  const { address, isConnected } = useAccount();
  const [isLong,     setIsLong]     = useState(true);
  const [collateral, setCollateral] = useState("");
  const [leverage,   setLeverage]   = useState(5);

  const { data: balance }   = useUsdcBalance();
  const { data: priceData } = useCurrentPrice();
  const { openPosition, isPending } = useOpenPosition();

  const mark = priceData?.price ? priceToBigInt(priceData.price) : 0n;

  const collateralBig = useMemo(() => {
    const n = parseFloat(collateral);
    if (!n || isNaN(n) || n <= 0) return 0n;
    return BigInt(Math.floor(n * 1_000_000));
  }, [collateral]);

  const fee          = collateralBig > 0n ? calcOpenFee(collateralBig, leverage)        : 0n;
  const netCollat    = collateralBig > fee ? collateralBig - fee                         : 0n;
  const notional     = netCollat > 0n      ? calcNotional(netCollat, leverage)           : 0n;
  const sizeTokens   = mark > 0n           ? calcSizeTokens(notional, mark)              : 0n;
  const liqPrice     = mark > 0n && leverage > 0
    ? calcLiquidationPrice(isLong, mark, leverage)
    : 0n;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (collateralBig === 0n) return;
    try {
      await openPosition({ collateral: collateralBig, leverage, isLong });
      setCollateral("");
    } catch {
      // error handled by useOpenPosition via toast
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-border bg-surface-card p-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-text-muted">Connect wallet to trade</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Open Position
        </span>
        <div className="flex items-center gap-1 text-xs text-text-dim">
          <span>Balance:</span>
          <span className="font-mono text-text-secondary">
            {balance !== undefined ? formatUsdc(balance) : "—"} mUSDC
          </span>
        </div>
      </div>

      {/* Long / Short toggle */}
      <div className="mb-4 flex rounded overflow-hidden border border-border">
        <button
          type="button"
          onClick={() => setIsLong(true)}
          className={[
            "flex-1 py-2 text-xs font-semibold transition-colors",
            isLong
              ? "bg-brand text-black hover:bg-brand-light"
              : "bg-transparent text-text-dim hover:text-text-muted",
          ].join(" ")}
        >
          LONG
        </button>
        <button
          type="button"
          onClick={() => setIsLong(false)}
          className={[
            "flex-1 py-2 text-xs font-semibold transition-colors",
            !isLong
              ? "bg-no text-white hover:bg-no-muted"
              : "bg-transparent text-text-dim hover:text-text-muted",
          ].join(" ")}
        >
          SHORT
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Collateral input */}
        <div>
          <label className="mb-1 block text-xs text-text-muted">
            Collateral (mUSDC)
          </label>
          <input
            type="number"
            min="10"
            step="1"
            placeholder="100"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            className="w-full rounded border border-border bg-navy-800 px-3 py-2 font-mono text-sm text-text-primary placeholder-text-dim focus:border-border-light focus:outline-none"
          />
        </div>

        {/* Leverage selector */}
        <div>
          <label className="mb-1 block text-xs text-text-muted">
            Leverage
          </label>
          <div className="flex gap-1">
            {LEVERAGE_OPTIONS.map((lev) => (
              <button
                key={lev}
                type="button"
                onClick={() => setLeverage(lev)}
                className={[
                  "flex-1 rounded border py-1.5 text-xs font-semibold transition-colors",
                  leverage === lev
                    ? "border-brand text-brand"
                    : "border-border text-text-dim hover:border-border-light hover:text-text-muted",
                ].join(" ")}
              >
                {lev}×
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {collateralBig > 0n && mark > 0n && (
          <div className="rounded border border-border-light bg-navy p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Entry Price</span>
              <span className="font-mono text-text-primary">{formatPrice(mark)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Notional</span>
              <span className="font-mono text-text-primary">${formatUsdc(notional)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Open Fee</span>
              <span className="font-mono text-text-secondary">${formatUsdc(fee)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <span className="text-text-muted">Liq Price</span>
              <span className="font-mono font-semibold text-no">
                {formatPrice(liqPrice)}
              </span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || collateralBig === 0n}
          className={[
            "rounded py-2.5 text-sm font-semibold transition-colors disabled:opacity-50",
            isLong
              ? "bg-brand text-black hover:bg-brand-light"
              : "bg-no text-white hover:bg-no-muted",
          ].join(" ")}
        >
          {isPending ? "Confirming…" : isLong ? "Open Long" : "Open Short"}
        </button>

      </form>
    </div>
  );
}

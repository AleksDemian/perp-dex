"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useSetPrice } from "@/hooks/usePerp";
import { formatUsdc, formatPrice, priceToBigInt } from "@/lib/perp-math";
import { useCurrentPrice } from "@/hooks/useCurrentPrice";

interface AdminStatus {
  lastIndexedBlock: string;
  openPositions: number;
  latestPrice: string | null;
  priceTimestamp: number | null;
  contractTokenBalance: string;
}

// ── Price Control ─────────────────────────────────────────────────────────────

function PriceControl() {
  const [newPrice, setNewPrice] = useState("");
  const { data: priceData } = useCurrentPrice();
  const { isConnected } = useAccount();
  const { setPrice, isPending } = useSetPrice();

  const currentNum = priceData?.price
    ? Number(priceToBigInt(priceData.price)) / 1e18
    : null;

  const disabled = !isConnected || !newPrice || isPending;

  async function handleSetPrice(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    try {
      await setPrice(newPrice);
      setNewPrice("");
    } catch {
      // Toast already surfaces the error inside useSetPrice.
    }
  }

  function quickSet(pct: number) {
    if (currentNum === null) return;
    setNewPrice(String(Math.round(currentNum * (1 + pct / 100))));
  }

  return (
    <div className="rounded-lg border border-border bg-surface-card p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">
        Price Control
      </h2>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-text-muted">Current mark</span>
        <span className="font-mono text-brand">
          {priceData?.price ? formatPrice(priceToBigInt(priceData.price)) : "—"}
        </span>
      </div>

      <form onSubmit={handleSetPrice} className="flex gap-2">
        <input
          type="number"
          min="1"
          placeholder="New price in USD (e.g. 68000)"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          disabled={!isConnected || isPending}
          className="flex-1 rounded border border-border bg-navy-800 px-3 py-2 font-mono text-sm text-text-primary placeholder-text-dim focus:border-border-light focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          {isPending ? "…" : "Set"}
        </button>
      </form>

      {!isConnected && (
        <p className="mt-2 font-mono text-xs text-text-muted">
          Connect a wallet to update the price.
        </p>
      )}

      {currentNum !== null && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-text-dim">Quick adjust</p>
          <div className="flex flex-wrap gap-1">
            {[-10, -5, -2, +2, +5, +10].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => quickSet(pct)}
                disabled={!isConnected || isPending}
                className={`rounded border px-2 py-1 text-xs font-mono transition-colors disabled:opacity-50 ${
                  pct < 0
                    ? "border-no/70 bg-no text-white hover:bg-no-muted"
                    : "border-brand bg-brand text-black hover:bg-brand-light"
                }`}
              >
                {pct > 0 ? "+" : ""}{pct}%
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: adminStatus } = useQuery<AdminStatus>({
    queryKey: ["admin", "status"],
    queryFn:  async () => (await fetch("/api/admin/status")).json(),
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold text-text-primary">Admin Panel</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <PriceControl />

        <div className="rounded-lg border border-border bg-surface-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-secondary">
            Indexer Status
          </h2>
          <div className="space-y-1.5 text-xs">
            {[
              { label: "Last Indexed Block", value: adminStatus?.lastIndexedBlock ?? "—" },
              { label: "Open Positions",     value: String(adminStatus?.openPositions ?? "—") },
              {
                label: "Contract Token Balance",
                value:
                  adminStatus?.contractTokenBalance !== undefined
                    ? `$${formatUsdc(BigInt(adminStatus.contractTokenBalance))} mUSDC`
                    : "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-text-muted">{label}</span>
                <span className="font-mono text-text-primary">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useFaucet, useLastFaucet } from "@/hooks/usePerp";

const NAV = [
  { href: "/",              label: "Trade"       },
  { href: "/liquidations",  label: "Liquidate"   },
  { href: "/leaderboard",   label: "Leaderboard" },
  { href: "/admin",         label: "Admin"       },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { faucet, isPending: fauceting } = useFaucet();
  const { data: lastFaucetTs } = useLastFaucet();
  const canFaucet = !lastFaucetTs || Date.now() / 1000 > Number(lastFaucetTs) + 86_400;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-navy-900/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-widest text-brand uppercase">
              PERP
            </span>
            <span className="text-sm font-light text-text-secondary">DEX</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-surface text-text-primary"
                      : "text-text-muted hover:text-text-secondary",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && canFaucet && (
            <button
              type="button"
              onClick={faucet}
              disabled={fauceting}
              className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {fauceting ? "…" : "Faucet"}
            </button>
          )}
          <ConnectButton
            chainStatus="none"
            showBalance={false}
            accountStatus="address"
          />
        </div>
      </div>
    </header>
  );
}

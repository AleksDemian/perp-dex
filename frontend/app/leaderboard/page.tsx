import { getDb } from "@/lib/db";
import { formatPnl } from "@/lib/perp-math";

interface LeaderRow {
  trader: string;
  total_positions: number;
  closed_count: number;
  liq_count: number;
  total_pnl: string;
}

export const dynamic = "force-dynamic";

function getLeaderboard(): LeaderRow[] {
  try {
    const db = getDb();
    return db
      .prepare(
        `SELECT
           trader,
           COUNT(*) AS total_positions,
           SUM(CASE WHEN is_open=0 AND close_kind='close' THEN 1 ELSE 0 END) AS closed_count,
           SUM(CASE WHEN is_open=0 AND close_kind='liquidate' THEN 1 ELSE 0 END) AS liq_count,
           CAST(SUM(CASE WHEN realized_pnl IS NOT NULL THEN CAST(realized_pnl AS REAL) ELSE 0 END) AS TEXT) AS total_pnl
         FROM positions
         GROUP BY trader
         ORDER BY CAST(total_pnl AS REAL) DESC
         LIMIT 50`
      )
      .all() as LeaderRow[];
  } catch {
    return [];
  }
}

export default function LeaderboardPage() {
  const rows = getLeaderboard();

  return (
    <div className="mx-auto max-w-screen-lg px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold text-text-primary">Leaderboard</h1>
      <p className="mb-4 text-xs text-text-muted">Ranked by realized PnL on closed positions.</p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface text-text-dim">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Trader</th>
              <th className="px-3 py-2 text-right">Positions</th>
              <th className="px-3 py-2 text-right">Closed</th>
              <th className="px-3 py-2 text-right">Liquidated</th>
              <th className="px-3 py-2 text-right">Realized PnL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pnl = BigInt(Math.round(parseFloat(row.total_pnl ?? "0")));
              return (
                <tr key={row.trader} className="border-b border-border/50 hover:bg-surface-hover">
                  <td className="px-3 py-2 text-text-dim font-mono">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    {row.trader.slice(0, 6)}…{row.trader.slice(-4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-text-primary">
                    {row.total_positions}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-text-secondary">
                    {row.closed_count}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-warning">
                    {row.liq_count}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${pnl >= 0n ? "text-yes" : "text-no"}`}>
                    {formatPnl(pnl)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

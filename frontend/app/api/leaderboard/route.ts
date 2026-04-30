import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT
           trader,
           COUNT(*) AS total_positions,
           SUM(CASE WHEN is_open = 0 AND close_kind = 'close' THEN 1 ELSE 0 END) AS closed_count,
           SUM(CASE WHEN is_open = 0 AND close_kind = 'liquidate' THEN 1 ELSE 0 END) AS liq_count,
           CAST(SUM(CASE WHEN realized_pnl IS NOT NULL THEN CAST(realized_pnl AS REAL) ELSE 0 END) AS TEXT) AS total_pnl
         FROM positions
         GROUP BY trader
         ORDER BY CAST(total_pnl AS REAL) DESC
         LIMIT 50`
      )
      .all();
    return NextResponse.json({ leaderboard: rows });
  } catch {
    return NextResponse.json({ leaderboard: [] }, { status: 503 });
  }
}

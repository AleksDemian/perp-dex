import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(req: NextRequest) {
  const limit = Math.min(
    Number(new URL(req.url).searchParams.get("limit") ?? 30),
    100
  );

  try {
    const db = getDb();

    const opens = db
      .prepare(
        `SELECT
           id, trader, is_long, collateral, leverage, notional,
           opened_at_ts AS timestamp, opened_tx_hash AS tx_hash,
           entry_price,
           'open' AS kind
         FROM positions
         WHERE opened_at_ts IS NOT NULL
         ORDER BY opened_at_ts DESC
         LIMIT ?`
      )
      .all(limit) as Record<string, unknown>[];

    const closes = db
      .prepare(
        `SELECT
           id, trader, is_long, collateral, leverage, notional,
           closed_at_ts AS timestamp, close_tx_hash AS tx_hash,
           exit_price, realized_pnl,
           'close' AS kind
         FROM positions
         WHERE is_open = 0 AND close_kind = 'close' AND closed_at_ts IS NOT NULL
         ORDER BY closed_at_ts DESC
         LIMIT ?`
      )
      .all(limit) as Record<string, unknown>[];

    const liquidations = db
      .prepare(
        `SELECT
           l.position_id AS id, l.trader, l.mark_price AS exit_price,
           l.bonus, l.timestamp, l.tx_hash,
           p.is_long, p.collateral, p.leverage, p.notional,
           'liquidate' AS kind
         FROM liquidations l
         LEFT JOIN positions p ON l.position_id = p.id
         ORDER BY l.timestamp DESC
         LIMIT ?`
      )
      .all(limit) as Record<string, unknown>[];

    const events = [...opens, ...closes, ...liquidations]
      .sort(
        (a, b) =>
          ((b.timestamp as number) ?? 0) - ((a.timestamp as number) ?? 0)
      )
      .slice(0, limit);

    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] }, { status: 503 });
  }
}

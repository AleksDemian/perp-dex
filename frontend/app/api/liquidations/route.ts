import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT l.*, p.is_long, p.collateral, p.leverage, p.notional
         FROM liquidations l
         LEFT JOIN positions p ON l.position_id = p.id
         ORDER BY l.timestamp DESC
         LIMIT ?`
      )
      .all(limit);
    return NextResponse.json({ liquidations: rows });
  } catch {
    return NextResponse.json({ liquidations: [] }, { status: 503 });
  }
}

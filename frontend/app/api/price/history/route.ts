import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from  = Number(searchParams.get("from")  ?? 0);
  const to    = Number(searchParams.get("to")    ?? Math.floor(Date.now() / 1000));
  const limit = Math.min(Number(searchParams.get("limit") ?? 500), 2000);

  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT price, timestamp, block_number
         FROM price_history
         WHERE timestamp BETWEEN ? AND ?
         ORDER BY timestamp ASC
         LIMIT ?`
      )
      .all(from, to, limit) as Array<{
        price: string;
        timestamp: number;
        block_number: number;
      }>;

    return NextResponse.json({ points: rows });
  } catch {
    return NextResponse.json({ points: [] }, { status: 503 });
  }
}

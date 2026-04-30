import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET() {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT price, timestamp, block_number FROM price_history ORDER BY block_number DESC LIMIT 1")
      .get() as { price: string; timestamp: number; block_number: number } | undefined;

    if (!row) {
      return NextResponse.json({ price: null, timestamp: null });
    }
    return NextResponse.json({
      price:       row.price,
      timestamp:   row.timestamp,
      blockNumber: row.block_number,
    });
  } catch {
    return NextResponse.json({ price: null, timestamp: null }, { status: 503 });
  }
}

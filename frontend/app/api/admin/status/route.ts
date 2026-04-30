import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET() {
  try {
    const db = getDb();
    const perpAddress = (
      process.env.PERP_ADDRESS ?? process.env.NEXT_PUBLIC_PERP_ADDRESS ?? ""
    ).toLowerCase();
    const scopedMetaKey = `last_indexed_block:${perpAddress}`;

    const lastBlock = (
      db.prepare(
        "SELECT value FROM meta WHERE key IN (?, 'last_indexed_block') ORDER BY key = ? DESC LIMIT 1"
      ).get(scopedMetaKey, scopedMetaKey) as
        | { value: string }
        | undefined
    )?.value ?? "0";

    const openCount = (
      db.prepare("SELECT COUNT(*) as n FROM positions WHERE is_open = 1").get() as { n: number }
    ).n;

    const latestPrice = (
      db.prepare(
        "SELECT price, timestamp FROM price_history ORDER BY block_number DESC LIMIT 1"
      ).get() as { price: string; timestamp: number } | undefined
    );

    return NextResponse.json({
      lastIndexedBlock: lastBlock,
      openPositions:    openCount,
      latestPrice:      latestPrice?.price    ?? null,
      priceTimestamp:   latestPrice?.timestamp ?? null,
    });
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 503 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  return params.then(({ address }) => {
    try {
      const db = getDb();
      const rows = db
        .prepare(
          "SELECT * FROM positions WHERE trader = ? ORDER BY opened_at_block DESC"
        )
        .all(address.toLowerCase());
      return NextResponse.json({ positions: rows });
    } catch {
      return NextResponse.json({ positions: [] }, { status: 503 });
    }
  });
}

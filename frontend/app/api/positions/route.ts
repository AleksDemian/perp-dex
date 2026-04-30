import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all"; // open|closed|all
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit  = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  let where = "";
  if (status === "open")   where = "WHERE is_open = 1";
  if (status === "closed") where = "WHERE is_open = 0";

  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM positions ${where}
         ORDER BY opened_at_block DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    const total = (
      db.prepare(`SELECT COUNT(*) as n FROM positions ${where}`).get() as { n: number }
    ).n;

    return NextResponse.json({ positions: rows, total, offset, limit });
  } catch {
    return NextResponse.json({ positions: [], total: 0 }, { status: 503 });
  }
}

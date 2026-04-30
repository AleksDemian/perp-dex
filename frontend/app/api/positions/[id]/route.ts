import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return params.then(({ id }) => {
    try {
      const db  = getDb();
      const row = db
        .prepare("SELECT * FROM positions WHERE id = ?")
        .get(Number(id));
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(row);
    } catch {
      return NextResponse.json({ error: "DB error" }, { status: 503 });
    }
  });
}

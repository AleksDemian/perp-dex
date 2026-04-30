import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET() {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT value FROM meta WHERE key = 'last_indexed_block'")
      .get() as { value: string } | undefined;
    return NextResponse.json({
      ok: true,
      lastIndexedBlock: row?.value ?? "0",
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

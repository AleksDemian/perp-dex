import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const markPrice = searchParams.get("mark");

  try {
    const db = getDb();

    let rows;
    if (markPrice) {
      // Return positions within 10% of their liquidation price
      const mark = BigInt(markPrice);
      const allOpen = db
        .prepare("SELECT * FROM positions WHERE is_open = 1")
        .all() as Array<{
          id: number;
          is_long: number;
          liquidation_price: string;
          entry_price: string;
        }>;

      rows = allOpen
        .map((p) => {
          const liq  = BigInt(p.liquidation_price);
          const dist = p.is_long
            ? mark > liq ? Number(((mark - liq) * 10_000n) / mark) : 0
            : mark < liq ? Number(((liq - mark) * 10_000n) / liq)  : 0;
          return { ...p, distanceBps: dist };
        })
        .filter((p) => p.distanceBps <= 1000) // within 10%
        .sort((a, b) => a.distanceBps - b.distanceBps);
    } else {
      rows = db
        .prepare("SELECT * FROM positions WHERE is_open = 1 ORDER BY id DESC LIMIT 100")
        .all();
    }

    return NextResponse.json({ positions: rows });
  } catch {
    return NextResponse.json({ positions: [] }, { status: 503 });
  }
}

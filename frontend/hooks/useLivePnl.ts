"use client";

import { useMemo } from "react";
import { useCurrentPrice } from "./useCurrentPrice";
import { calcPnlUsdc, priceToBigInt, usdcToBigInt } from "@/lib/perp-math";
import type { PositionRow } from "./usePositions";

export function useLivePnl(position: PositionRow | null | undefined) {
  const { data: priceData } = useCurrentPrice();

  return useMemo(() => {
    if (!position?.is_open || !priceData?.price) return null;
    const mark      = priceToBigInt(priceData.price);
    const entry     = priceToBigInt(position.entry_price);
    const size      = usdcToBigInt(position.size_tokens);
    return calcPnlUsdc(size, entry, mark, position.is_long === 1);
  }, [position, priceData?.price]);
}

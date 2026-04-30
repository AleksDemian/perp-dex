"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { APP_DATA_GC_TIME } from "@/lib/query-constants";

interface PricePoint {
  price: string;
  timestamp: number;
  block_number: number;
}

export function usePriceHistory(range: "1H" | "4H" | "1D" | "ALL" = "1D") {
  const nowSec   = Math.floor(Date.now() / 1000);
  const bucket   = Math.floor(nowSec / 60);
  const toSec    = bucket * 60;
  const rangeMap = {
    "1H":  3_600,
    "4H":  14_400,
    "1D":  86_400,
    "ALL": toSec,
  };
  const from = toSec - rangeMap[range];

  return useQuery<{ points: PricePoint[] }>({
    queryKey: ["price", "history", range, from, toSec],
    queryFn: () => fetchJson(`/api/price/history?from=${from}&to=${toSec}&limit=500`),
    placeholderData: (previousData) => previousData,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}

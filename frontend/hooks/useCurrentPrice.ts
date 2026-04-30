"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { APP_DATA_GC_TIME } from "@/lib/query-constants";

export interface PriceData {
  price: string | null;
  timestamp: number | null;
  blockNumber: number | null;
}

export function useCurrentPrice() {
  return useQuery<PriceData>({
    queryKey: ["price", "current"],
    queryFn: () => fetchJson("/api/price/current"),
    placeholderData: (previousData) => previousData,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 15_000,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

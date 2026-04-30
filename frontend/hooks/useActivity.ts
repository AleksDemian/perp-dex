"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { APP_DATA_GC_TIME } from "@/lib/query-constants";

export type ActivityKind = "open" | "close" | "liquidate";

export interface ActivityEvent {
  id: number;
  kind: ActivityKind;
  trader: string;
  is_long: number | null;
  collateral: string | null;
  leverage: number | null;
  notional: string | null;
  timestamp: number;
  tx_hash: string | null;
  entry_price?: string | null;
  exit_price?: string | null;
  realized_pnl?: string | null;
  bonus?: string | null;
}

export function useActivity(limit = 30) {
  return useQuery<{ events: ActivityEvent[] }>({
    queryKey: ["activity", limit],
    queryFn: () => fetchJson(`/api/activity?limit=${limit}`),
    placeholderData: (previousData) => previousData,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
}

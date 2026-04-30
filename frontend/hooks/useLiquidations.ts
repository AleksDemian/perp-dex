"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { APP_DATA_GC_TIME } from "@/lib/query-constants";

export interface LiquidationRow {
  tx_hash: string;
  log_index: number;
  position_id: number;
  trader: string;
  liquidator: string;
  mark_price: string;
  bonus: string;
  remaining: string;
  block_number: number;
  timestamp: number;
  is_long: number | null;
  collateral: string | null;
  leverage: number | null;
  notional: string | null;
}

export function useLiquidations(limit = 20) {
  return useQuery<{ liquidations: LiquidationRow[] }>({
    queryKey: ["liquidations", limit],
    queryFn: () => fetchJson(`/api/liquidations?limit=${limit}`),
    placeholderData: (previousData) => previousData,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}

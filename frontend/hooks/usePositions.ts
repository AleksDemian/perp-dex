"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { APP_DATA_GC_TIME } from "@/lib/query-constants";

export interface PositionRow {
  id: number;
  trader: string;
  is_long: number;
  collateral: string;
  leverage: number;
  notional: string;
  size_tokens: string;
  entry_price: string;
  liquidation_price: string;
  opened_at_block: number;
  opened_at_ts: number;
  opened_tx_hash: string;
  closed_at_block: number | null;
  closed_at_ts: number | null;
  close_tx_hash: string | null;
  close_kind: "close" | "liquidate" | null;
  exit_price: string | null;
  realized_pnl: string | null;
  fee_paid: string | null;
  liquidator: string | null;
  liquidation_bonus: string | null;
  is_open: number;
}

type PositionsResult = {
  positions: PositionRow[];
  total?: number;
};

function keepPreviousPositionsOnEmpty<T extends PositionsResult>(
  previousData: T | undefined,
  nextData: T
): T {
  if ((previousData?.positions.length ?? 0) > 0 && nextData.positions.length === 0) {
    return previousData as T;
  }
  return nextData;
}

export function usePositions(status: "open" | "closed" | "all" = "open", limit = 50) {
  return useQuery<{ positions: PositionRow[]; total: number }>({
    queryKey: ["positions", status, limit],
    queryFn: () => fetchJson(`/api/positions?status=${status}&limit=${limit}`),
    placeholderData: (previousData) => previousData,
    structuralSharing: keepPreviousPositionsOnEmpty,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function useTraderPositions(address: string | undefined) {
  return useQuery<{ positions: PositionRow[] }>({
    queryKey: ["positions", "trader", address],
    queryFn: () => fetchJson(`/api/positions/trader/${address}`),
    enabled: !!address,
    placeholderData: (previousData) => previousData,
    structuralSharing: keepPreviousPositionsOnEmpty,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });
}

"use client";

import { useMemo, useRef } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
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

const EMPTY_DATA_GRACE_MS = 30_000;

function useTransientEmptyGuard<T extends { positions: PositionRow[]; total?: number }>(
  query: UseQueryResult<T>
): UseQueryResult<T> {
  const lastNonEmptyRef = useRef<{ data: T; at: number } | null>(null);

  if (query.data?.positions?.length) {
    lastNonEmptyRef.current = { data: query.data, at: Date.now() };
  }

  const guardedData = useMemo(() => {
    if (!query.data || query.data.positions.length > 0) return query.data;

    const snapshot = lastNonEmptyRef.current;
    if (!snapshot) return query.data;

    // During short indexer sync gaps we can receive transient empty snapshots.
    // Keep the latest non-empty snapshot briefly to avoid UI flicker.
    if (Date.now() - snapshot.at <= EMPTY_DATA_GRACE_MS) {
      return {
        ...query.data,
        positions: snapshot.data.positions,
        total: typeof query.data.total === "number" ? query.data.total : snapshot.data.total,
      } as T;
    }

    return query.data;
  }, [query.data]);

  return { ...query, data: guardedData } as UseQueryResult<T>;
}

export function usePositions(status: "open" | "closed" | "all" = "open", limit = 50) {
  const query = useQuery<PositionsResult>({
    queryKey: ["positions", status, limit],
    queryFn: () => fetchJson<PositionsResult>(`/api/positions?status=${status}&limit=${limit}`),
    placeholderData: (previousData) => previousData,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  }) as UseQueryResult<PositionsResult>;

  return useTransientEmptyGuard(query);
}

export function useTraderPositions(address: string | undefined) {
  const query = useQuery<{ positions: PositionRow[] }>({
    queryKey: ["positions", "trader", address],
    queryFn: () => fetchJson<{ positions: PositionRow[] }>(`/api/positions/trader/${address}`),
    enabled: !!address,
    placeholderData: (previousData) => previousData,
    gcTime: APP_DATA_GC_TIME,
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  }) as UseQueryResult<{ positions: PositionRow[] }>;

  return useTransientEmptyGuard(query);
}

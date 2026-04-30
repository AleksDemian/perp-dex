import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ActivityEvent } from "@/hooks/useActivity";
import type { LiquidationRow } from "@/hooks/useLiquidations";
import type { PositionRow } from "@/hooks/usePositions";
import type { PriceData } from "@/hooks/useCurrentPrice";

type PositionsCache = {
  positions: PositionRow[];
  total?: number;
};

type ActivityCache = {
  events: ActivityEvent[];
};

type LiquidationsCache = {
  liquidations: LiquidationRow[];
};

function lowerAddress(address: string): string {
  return address.toLowerCase();
}

function queryLimit(queryKey: QueryKey, fallback: number): number {
  const last = queryKey[queryKey.length - 1];
  return typeof last === "number" ? last : fallback;
}

function shouldIncludePosition(queryKey: QueryKey, position: PositionRow): boolean {
  const scope = queryKey[1];

  if (scope === "trader") {
    return lowerAddress(String(queryKey[2] ?? "")) === lowerAddress(position.trader);
  }

  if (scope === "open") return position.is_open === 1;
  if (scope === "closed") return position.is_open === 0;
  return scope === "all" || typeof scope === "undefined";
}

function sortPositions(positions: PositionRow[]): PositionRow[] {
  return [...positions].sort((a, b) => b.opened_at_block - a.opened_at_block);
}

export function findCachedPosition(
  queryClient: QueryClient,
  positionId: number
): PositionRow | null {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ["positions"] });

  for (const query of queries) {
    const data = queryClient.getQueryData<PositionsCache>(query.queryKey);
    const position = data?.positions.find((row) => row.id === positionId);
    if (position) return { ...position };
  }

  return null;
}

export function upsertPosition(queryClient: QueryClient, position: PositionRow): void {
  const normalized = {
    ...position,
    trader: lowerAddress(position.trader),
  };

  queryClient.setQueryData<PositionsCache>(
    ["positions", "trader", normalized.trader],
    (old) => {
      const previous = old?.positions ?? [];
      const exists = previous.some((row) => row.id === normalized.id);
      return {
        ...old,
        positions: sortPositions([
          normalized,
          ...previous.filter((row) => row.id !== normalized.id),
        ]),
        total: typeof old?.total === "number" ? old.total + (exists ? 0 : 1) : old?.total,
      };
    }
  );

  const queries = queryClient.getQueryCache().findAll({ queryKey: ["positions"] });
  for (const query of queries) {
    const key = query.queryKey;
    if (key[1] === "trader" && lowerAddress(String(key[2] ?? "")) === normalized.trader) {
      continue;
    }

    const old = queryClient.getQueryData<PositionsCache>(key);
    if (!old?.positions || !shouldIncludePosition(key, normalized)) continue;

    const exists = old.positions.some((row) => row.id === normalized.id);
    const next = sortPositions([
      normalized,
      ...old.positions.filter((row) => row.id !== normalized.id),
    ]).slice(0, queryLimit(key, old.positions.length || 50));

    queryClient.setQueryData<PositionsCache>(key, {
      ...old,
      positions: next,
      total: typeof old.total === "number" ? old.total + (exists ? 0 : 1) : old.total,
    });
  }
}

export function markPositionClosed(
  queryClient: QueryClient,
  positionId: number,
  patch: Partial<PositionRow>
): PositionRow | null {
  const cached = findCachedPosition(queryClient, positionId);
  if (!cached) return null;

  const closed: PositionRow = {
    ...cached,
    ...patch,
    id: positionId,
    is_open: 0,
  };

  const queries = queryClient.getQueryCache().findAll({ queryKey: ["positions"] });
  for (const query of queries) {
    const key = query.queryKey;
    const old = queryClient.getQueryData<PositionsCache>(key);
    if (!old?.positions) continue;

    if (key[1] === "open") {
      const removed = old.positions.some((row) => row.id === positionId);
      queryClient.setQueryData<PositionsCache>(key, {
        ...old,
        positions: old.positions.filter((row) => row.id !== positionId),
        total:
          typeof old.total === "number" && removed
            ? Math.max(0, old.total - 1)
            : old.total,
      });
      continue;
    }

    const exists = old.positions.some((row) => row.id === positionId);
    if (!exists && !shouldIncludePosition(key, closed)) continue;

    const next = exists
      ? old.positions.map((row) => (row.id === positionId ? closed : row))
      : [closed, ...old.positions];

    queryClient.setQueryData<PositionsCache>(key, {
      ...old,
      positions: sortPositions(next).slice(0, queryLimit(key, next.length)),
      total:
        typeof old.total === "number" && !exists && key[1] === "closed"
          ? old.total + 1
          : old.total,
    });
  }

  return closed;
}

export function prependActivity(queryClient: QueryClient, event: ActivityEvent): void {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ["activity"] });
  for (const query of queries) {
    const old = queryClient.getQueryData<ActivityCache>(query.queryKey);
    if (!old?.events) continue;

    const limit = queryLimit(query.queryKey, 30);
    queryClient.setQueryData<ActivityCache>(query.queryKey, {
      ...old,
      events: [
        event,
        ...old.events.filter((row) => {
          if (event.tx_hash && row.tx_hash) return row.tx_hash !== event.tx_hash;
          return !(row.kind === event.kind && row.id === event.id);
        }),
      ].slice(0, limit),
    });
  }
}

export function prependLiquidation(
  queryClient: QueryClient,
  liquidation: LiquidationRow
): void {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ["liquidations"] });
  for (const query of queries) {
    const old = queryClient.getQueryData<LiquidationsCache>(query.queryKey);
    if (!old?.liquidations) continue;

    const limit = queryLimit(query.queryKey, 20);
    queryClient.setQueryData<LiquidationsCache>(query.queryKey, {
      ...old,
      liquidations: [
        liquidation,
        ...old.liquidations.filter((row) => row.tx_hash !== liquidation.tx_hash),
      ].slice(0, limit),
    });
  }
}

export function setCurrentPrice(
  queryClient: QueryClient,
  price: bigint,
  blockNumber: number | null,
  timestamp = Math.floor(Date.now() / 1000)
): void {
  queryClient.setQueryData<PriceData>(["price", "current"], {
    price: price.toString(),
    timestamp,
    blockNumber,
  });
}

type PriceHistoryPoint = {
  price: string;
  timestamp: number;
  block_number: number;
};

type PriceHistoryCache = {
  points: PriceHistoryPoint[];
};

export function appendPriceHistoryPoint(
  queryClient: QueryClient,
  priceWei: bigint,
  blockNumber: number,
  timestamp = Math.floor(Date.now() / 1000)
): void {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ["price", "history"] });

  for (const query of queries) {
    const old = queryClient.getQueryData<PriceHistoryCache>(query.queryKey);
    if (!old?.points) continue;

    const exists = old.points.some(
      (p) => p.block_number === blockNumber || p.timestamp === timestamp,
    );
    if (exists) continue;

    queryClient.setQueryData<PriceHistoryCache>(query.queryKey, {
      ...old,
      points: [
        ...old.points,
        { price: priceWei.toString(), timestamp, block_number: blockNumber },
      ].sort((a, b) => a.timestamp - b.timestamp),
    });
  }
}

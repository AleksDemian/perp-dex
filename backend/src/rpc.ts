import { createPublicClient, fallback, http } from "viem";
import { sepolia } from "viem/chains";

export type PublicClient = ReturnType<typeof createClient>;

const BLOCK_TS_CACHE_MAX = 2_000;
/** LRU-ish: Map insertion order; refresh on hit, evict oldest when over capacity */
const blockTimestampCache = new Map<string, number>();

function cacheGet(blockNumber: bigint): number | undefined {
  const key = blockNumber.toString();
  const ts = blockTimestampCache.get(key);
  if (ts === undefined) return undefined;
  blockTimestampCache.delete(key);
  blockTimestampCache.set(key, ts);
  return ts;
}

function cacheSet(blockNumber: bigint, timestamp: number): void {
  const key = blockNumber.toString();
  if (blockTimestampCache.has(key)) blockTimestampCache.delete(key);
  blockTimestampCache.set(key, timestamp);
  while (blockTimestampCache.size > BLOCK_TS_CACHE_MAX) {
    const oldest = blockTimestampCache.keys().next().value;
    if (oldest === undefined) break;
    blockTimestampCache.delete(oldest);
  }
}

export function createClient() {
  const primaryRpc = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;
  const noFallback =
    String(process.env.INDEXER_RPC_FALLBACK ?? "").toLowerCase() === "false";

  const primaryTransport = http(primaryRpc ?? undefined, {
    retryCount: 2,
    retryDelay: 250,
    timeout: 15_000,
  });

  if (noFallback) {
    return createPublicClient({
      chain: sepolia,
      transport: http(primaryRpc ?? "https://ethereum-sepolia-rpc.publicnode.com", {
        retryCount: 2,
        retryDelay: 250,
        timeout: 15_000,
      }),
    });
  }

  return createPublicClient({
    chain: sepolia,
    transport: fallback(
      [
        primaryTransport,
        http("https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 1,
          retryDelay: 300,
        }),
        http("https://sepolia.gateway.tenderly.co", {
          retryCount: 1,
          retryDelay: 300,
        }),
        http("https://rpc.sepolia.org", {
          retryCount: 0,
        }),
      ],
      { rank: false }
    ),
  });
}

export async function fetchBlockTimestamps(
  client: PublicClient,
  blockNumbers: bigint[]
): Promise<Map<bigint, number>> {
  const unique = [
    ...new Set(blockNumbers.map((n) => n.toString())),
  ].map((s) => BigInt(s));

  const map = new Map<bigint, number>();
  const missing: bigint[] = [];

  for (const n of unique) {
    const cached = cacheGet(n);
    if (cached !== undefined) {
      map.set(n, cached);
    } else {
      missing.push(n);
    }
  }

  for (let i = 0; i < missing.length; i += 10) {
    const chunk = missing.slice(i, i + 10);
    const blocks = await Promise.all(
      chunk.map((n) => client.getBlock({ blockNumber: n }))
    );
    blocks.forEach((b, idx) => {
      const bn = chunk[idx];
      const ts = Number(b.timestamp);
      map.set(bn, ts);
      cacheSet(bn, ts);
    });
  }

  return map;
}

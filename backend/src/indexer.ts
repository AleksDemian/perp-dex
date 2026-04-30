import "./load-env";
import { openDb, getLastIndexedBlock, setLastIndexedBlock, purgeFromBlock } from "./db";
import { createClient, fetchBlockTimestamps } from "./rpc";
import { PERP_ADDRESS, PRICE_FEED_ADDRESS, PERP_ENGINE_ABI, PRICE_FEED_ABI } from "./abi";
import { handlePositionOpened, handlePositionClosed, handlePositionLiquidated } from "./handlers/positions";
import { handlePriceUpdated } from "./handlers/prices";

const DB_PATH       = process.env.DATABASE_PATH ?? "../data/app.db";
const DEPLOY_BLOCK  = BigInt(process.env.CONTRACT_DEPLOY_BLOCK ?? "0");
const BATCH_SIZE    = BigInt(process.env.INDEXER_BATCH_SIZE ?? "2000");

function parsePollMs(): number {
  const raw = process.env.INDEXER_POLL_MS;
  if (!raw) return 6_000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 2_000) return 6_000;
  return Math.min(n, 120_000);
}

function parseReorgBuffer(): bigint {
  const raw = process.env.INDEXER_REORG_BUFFER;
  if (!raw?.trim()) return 64n;
  try {
    const n = BigInt(raw.trim());
    if (n < 8n) return 64n;
    return n > 256n ? 256n : n;
  } catch {
    return 64n;
  }
}

const POLL_MS      = parsePollMs();
const REORG_BUFFER = parseReorgBuffer();
const INDEX_META_KEY = `last_indexed_block:${PERP_ADDRESS.toLowerCase()}`;

const RANGE_ERROR_RE =
  /more than \d+ results|query returned more than|log response size|range is too wide|exceed|block range|limit.*exceeded/i;

type Client = ReturnType<typeof createClient>;
type DB     = ReturnType<typeof openDb>;

async function processBatch(
  db: DB,
  client: Client,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  const opened = await client.getContractEvents({
    address: PERP_ADDRESS,
    abi: PERP_ENGINE_ABI,
    eventName: "PositionOpened",
    fromBlock,
    toBlock,
  });
  const closed = await client.getContractEvents({
    address: PERP_ADDRESS,
    abi: PERP_ENGINE_ABI,
    eventName: "PositionClosed",
    fromBlock,
    toBlock,
  });
  const liquidated = await client.getContractEvents({
    address: PERP_ADDRESS,
    abi: PERP_ENGINE_ABI,
    eventName: "PositionLiquidated",
    fromBlock,
    toBlock,
  });
  const prices = await client.getContractEvents({
    address: PRICE_FEED_ADDRESS,
    abi: PRICE_FEED_ABI,
    eventName: "PriceUpdated",
    fromBlock,
    toBlock,
  });

  const allEvents = [...opened, ...closed, ...liquidated, ...prices];
  const blockNums = allEvents
    .map((e) => e.blockNumber)
    .filter((n): n is bigint => n != null);

  const timestamps =
    blockNums.length > 0
      ? await fetchBlockTimestamps(client, blockNums)
      : new Map<bigint, number>();

  db.transaction(() => {
    for (const e of opened) {
      if (!e.transactionHash || e.blockNumber == null) continue;
      const a = e.args as {
        positionId: bigint;
        trader: `0x${string}`;
        isLong: boolean;
        collateral: bigint;
        leverage: number;
        notional: bigint;
        sizeTokens: bigint;
        entryPrice: bigint;
        liquidationPrice: bigint;
        fee: bigint;
      };
      handlePositionOpened(db, a, {
        txHash: e.transactionHash,
        blockNumber: Number(e.blockNumber),
        timestamp: timestamps.get(e.blockNumber) ?? 0,
      });
    }

    for (const e of closed) {
      if (!e.transactionHash || e.blockNumber == null) continue;
      const a = e.args as {
        positionId: bigint;
        trader: `0x${string}`;
        exitPrice: bigint;
        pnl: bigint;
        payout: bigint;
        fee: bigint;
      };
      handlePositionClosed(db, a, {
        txHash: e.transactionHash,
        blockNumber: Number(e.blockNumber),
        timestamp: timestamps.get(e.blockNumber) ?? 0,
      });
    }

    for (const e of liquidated) {
      if (!e.transactionHash || e.blockNumber == null || e.logIndex == null) continue;
      const a = e.args as {
        positionId: bigint;
        trader: `0x${string}`;
        liquidator: `0x${string}`;
        markPrice: bigint;
        bonus: bigint;
        remaining: bigint;
      };
      handlePositionLiquidated(db, a, {
        txHash: e.transactionHash,
        logIndex: e.logIndex,
        blockNumber: Number(e.blockNumber),
        timestamp: timestamps.get(e.blockNumber) ?? 0,
      });
    }

    for (const e of prices) {
      if (!e.transactionHash || e.blockNumber == null || e.logIndex == null) continue;
      const a = e.args as { newPrice: bigint; timestamp: bigint };
      handlePriceUpdated(db, a, {
        txHash: e.transactionHash,
        logIndex: e.logIndex,
        blockNumber: Number(e.blockNumber),
        blockTimestamp: timestamps.get(e.blockNumber) ?? 0,
      });
    }
  })();
}

async function processBatchAdaptive(
  db: DB,
  client: Client,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  try {
    return await processBatch(db, client, fromBlock, toBlock);
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (toBlock <= fromBlock || !RANGE_ERROR_RE.test(msg)) throw err;

    const mid = fromBlock + (toBlock - fromBlock) / 2n;
    console.warn(
      `[indexer] splitting ${fromBlock}-${toBlock} → ${fromBlock}-${mid} + ${mid + 1n}-${toBlock}`
    );
    await processBatchAdaptive(db, client, fromBlock, mid);
    await processBatchAdaptive(db, client, mid + 1n, toBlock);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log(
    `[indexer] Starting — perp: ${PERP_ADDRESS}, db: ${DB_PATH}, pollMs: ${POLL_MS}, reorgBuffer: ${REORG_BUFFER}`
  );

  const db     = openDb(DB_PATH);
  const client = createClient();

  // ── Backfill ──────────────────────────────────────────────────────────────
  let fromBlock = getLastIndexedBlock(db, INDEX_META_KEY);
  if (fromBlock === 0n) fromBlock = DEPLOY_BLOCK;

  const latestBlock = await client.getBlockNumber();
  console.log(`[indexer] Backfilling ${fromBlock}–${latestBlock}`);

  let cursor = fromBlock;
  while (cursor <= latestBlock) {
    const toBlock =
      cursor + BATCH_SIZE - 1n < latestBlock
        ? cursor + BATCH_SIZE - 1n
        : latestBlock;

    console.log(`[indexer] batch ${cursor}–${toBlock}`);
    try {
      await processBatchAdaptive(db, client, cursor, toBlock);
      setLastIndexedBlock(db, toBlock, INDEX_META_KEY);
    } catch (err) {
      console.error(`[indexer] batch error:`, err);
      await sleep(5_000);
      continue;
    }
    cursor = toBlock + 1n;
  }

  console.log("[indexer] Backfill complete — entering poll loop");

  // ── Steady-state poll ──────────────────────────────────────────────────────
  while (true) {
    await sleep(POLL_MS);
    try {
      const latest      = await client.getBlockNumber();
      const lastIndexed = getLastIndexedBlock(db, INDEX_META_KEY);
      const from        = lastIndexed > REORG_BUFFER
        ? lastIndexed - REORG_BUFFER
        : DEPLOY_BLOCK;

      if (from > latest) continue;

      purgeFromBlock(db, Number(from));
      await processBatchAdaptive(db, client, from, latest);
      setLastIndexedBlock(db, latest, INDEX_META_KEY);
    } catch (err) {
      console.error("[indexer] poll error:", err);
    }
  }
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});

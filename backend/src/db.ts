import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";

export type DB = Database.Database;

export function openDb(path: string): DB {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);

  return db;
}

export function getLastIndexedBlock(db: DB, key = "last_indexed_block"): bigint {
  const row = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (row) return BigInt(row.value);

  // Backward compatibility: old installations used a single global key.
  if (key !== "last_indexed_block") {
    const legacy = db
      .prepare("SELECT value FROM meta WHERE key = 'last_indexed_block'")
      .get() as { value: string } | undefined;
    if (legacy) return BigInt(legacy.value);
  }

  return 0n;
}

export function setLastIndexedBlock(db: DB, block: bigint, key = "last_indexed_block"): void {
  db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)"
  ).run(key, block.toString());
}

// ── Position helpers ───────────────────────────────────────────────────────

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
  is_open: number;
}

export function insertPosition(
  db: DB,
  p: {
    id: number;
    trader: string;
    isLong: boolean;
    collateral: string;
    leverage: number;
    notional: string;
    sizeTokens: string;
    entryPrice: string;
    liquidationPrice: string;
    openedAtBlock: number;
    openedAtTs: number;
    openedTxHash: string;
    fee: string;
  }
): void {
  db.prepare(`
    INSERT OR IGNORE INTO positions
      (id, trader, is_long, collateral, leverage, notional, size_tokens,
       entry_price, liquidation_price, opened_at_block, opened_at_ts, opened_tx_hash, is_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    p.id,
    p.trader.toLowerCase(),
    p.isLong ? 1 : 0,
    p.collateral,
    p.leverage,
    p.notional,
    p.sizeTokens,
    p.entryPrice,
    p.liquidationPrice,
    p.openedAtBlock,
    p.openedAtTs,
    p.openedTxHash
  );
}

export function closePosition(
  db: DB,
  p: {
    id: number;
    closedAtBlock: number;
    closedAtTs: number;
    closeTxHash: string;
    exitPrice: string;
    realizedPnl: string;
    feePaid: string;
  }
): void {
  db.prepare(`
    UPDATE positions SET
      is_open       = 0,
      close_kind    = 'close',
      closed_at_block = ?,
      closed_at_ts  = ?,
      close_tx_hash = ?,
      exit_price    = ?,
      realized_pnl  = ?,
      fee_paid      = ?
    WHERE id = ?
  `).run(
    p.closedAtBlock,
    p.closedAtTs,
    p.closeTxHash,
    p.exitPrice,
    p.realizedPnl,
    p.feePaid,
    p.id
  );
}

export function liquidatePosition(
  db: DB,
  p: {
    id: number;
    liquidator: string;
    markPrice: string;
    bonus: string;
    closedAtBlock: number;
    closedAtTs: number;
    closeTxHash: string;
  }
): void {
  db.prepare(`
    UPDATE positions SET
      is_open           = 0,
      close_kind        = 'liquidate',
      closed_at_block   = ?,
      closed_at_ts      = ?,
      close_tx_hash     = ?,
      exit_price        = ?,
      liquidator        = ?,
      liquidation_bonus = ?,
      realized_pnl      = NULL
    WHERE id = ?
  `).run(
    p.closedAtBlock,
    p.closedAtTs,
    p.closeTxHash,
    p.markPrice,
    p.liquidator.toLowerCase(),
    p.bonus,
    p.id
  );
}

// ── Price history ──────────────────────────────────────────────────────────

export function insertPricePoint(
  db: DB,
  p: {
    txHash: string;
    logIndex: number;
    blockNumber: number;
    timestamp: number;
    price: string;
  }
): void {
  db.prepare(`
    INSERT OR IGNORE INTO price_history (tx_hash, log_index, block_number, timestamp, price)
    VALUES (?, ?, ?, ?, ?)
  `).run(p.txHash, p.logIndex, p.blockNumber, p.timestamp, p.price);
}

// ── Liquidations feed ──────────────────────────────────────────────────────

export function insertLiquidation(
  db: DB,
  l: {
    txHash: string;
    logIndex: number;
    positionId: number;
    trader: string;
    liquidator: string;
    markPrice: string;
    bonus: string;
    remaining: string;
    blockNumber: number;
    timestamp: number;
  }
): void {
  db.prepare(`
    INSERT OR IGNORE INTO liquidations
      (tx_hash, log_index, position_id, trader, liquidator, mark_price, bonus, remaining, block_number, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    l.txHash,
    l.logIndex,
    l.positionId,
    l.trader.toLowerCase(),
    l.liquidator.toLowerCase(),
    l.markPrice,
    l.bonus,
    l.remaining,
    l.blockNumber,
    l.timestamp
  );
}

// ── Reorg helpers ──────────────────────────────────────────────────────────

export function purgeFromBlock(db: DB, fromBlock: number): void {
  db.transaction(() => {
    // Reopen positions that were closed in the reorg window
    db.prepare(
      "UPDATE positions SET is_open=1, close_kind=NULL, closed_at_block=NULL, closed_at_ts=NULL, close_tx_hash=NULL, exit_price=NULL, realized_pnl=NULL, fee_paid=NULL, liquidator=NULL, liquidation_bonus=NULL WHERE closed_at_block >= ?"
    ).run(fromBlock);
    // Delete positions that were opened in the reorg window
    db.prepare("DELETE FROM positions WHERE opened_at_block >= ?").run(fromBlock);
    db.prepare("DELETE FROM price_history WHERE block_number >= ?").run(fromBlock);
    db.prepare("DELETE FROM liquidations WHERE block_number >= ?").run(fromBlock);
  })();
}

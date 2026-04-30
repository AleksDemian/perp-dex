CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id                  INTEGER PRIMARY KEY,
  trader              TEXT    NOT NULL,
  is_long             INTEGER NOT NULL,
  collateral          TEXT    NOT NULL,
  leverage            INTEGER NOT NULL,
  notional            TEXT    NOT NULL,
  size_tokens         TEXT    NOT NULL,
  entry_price         TEXT    NOT NULL,
  liquidation_price   TEXT    NOT NULL,
  opened_at_block     INTEGER NOT NULL,
  opened_at_ts        INTEGER NOT NULL,
  opened_tx_hash      TEXT    NOT NULL,
  closed_at_block     INTEGER,
  closed_at_ts        INTEGER,
  close_tx_hash       TEXT,
  close_kind          TEXT,
  exit_price          TEXT,
  realized_pnl        TEXT,
  fee_paid            TEXT,
  liquidator          TEXT,
  liquidation_bonus   TEXT,
  is_open             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_pos_trader   ON positions (trader, opened_at_block DESC);
CREATE INDEX IF NOT EXISTS idx_pos_open     ON positions (is_open, liquidation_price);
CREATE INDEX IF NOT EXISTS idx_pos_closedts ON positions (closed_at_ts DESC);

CREATE TABLE IF NOT EXISTS price_history (
  tx_hash      TEXT    NOT NULL,
  log_index    INTEGER NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp    INTEGER NOT NULL,
  price        TEXT    NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_price_ts ON price_history (timestamp DESC);

CREATE TABLE IF NOT EXISTS liquidations (
  tx_hash      TEXT    NOT NULL,
  log_index    INTEGER NOT NULL,
  position_id  INTEGER NOT NULL,
  trader       TEXT    NOT NULL,
  liquidator   TEXT    NOT NULL,
  mark_price   TEXT    NOT NULL,
  bonus        TEXT    NOT NULL,
  remaining    TEXT    NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp    INTEGER NOT NULL,
  PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_liq_ts     ON liquidations (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_liq_trader ON liquidations (trader, timestamp DESC);

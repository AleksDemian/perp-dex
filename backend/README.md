# Backend (indexer)

Long-running **event indexer** for the Perp DEX demo. It connects to an EVM RPC (Sepolia by default), watches `PerpEngine`, `MockPriceFeed`, and `MockUSDC` logs, and writes structured rows into **SQLite** (`better-sqlite3` + `viem`).

The Next.js frontend **only reads** this database via its API routes; the indexer is the sole writer.

## Layout

| Path | Role |
|------|------|
| `src/indexer.ts` | Main loop: backfill from `CONTRACT_DEPLOY_BLOCK`, configurable poll interval and reorg buffer |
| `src/db.ts` | SQLite schema and queries (`meta`, `positions`, `price_history`, `liquidations`) |
| `src/handlers/` | One module per event family |
| `src/rpc.ts` | Viem public client wrapper; optional single-RPC mode; block timestamp LRU cache |
| `src/load-env.ts` | Loads `.env` from repo root (`../../.env`) or `backend/.env` |

## Prerequisites

- Node.js **22+** (aligned with `Dockerfile`)
- A reachable **RPC_URL** and deployed contract addresses (same as root `.env`)

## Environment variables

The process loads the first existing file among:

1. `<repo>/.env`
2. `<repo>/backend/.env`

**Required at startup** (see `src/load-env.ts`):

| Variable | Purpose |
|----------|---------|
| `PERP_ADDRESS` | PerpEngine contract (checksum not required; normalized internally) |
| `USDC_ADDRESS` | Collateral token address |
| `RPC_URL` | HTTP(S) RPC endpoint (fallback: `NEXT_PUBLIC_RPC_URL` in `rpc.ts` only) |
| `CONTRACT_DEPLOY_BLOCK` | First block to scan for logs (bigint / string) |

**Strongly recommended** (used by `abi.ts` / indexer; set to real deployed addresses):

| Variable | Purpose |
|----------|---------|
| `PRICE_FEED_ADDRESS` | Oracle contract for `PriceUpdated` indexing |

**Optional**

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_PATH` | `../data/app.db` relative to CWD | SQLite file path |
| `INDEXER_BATCH_SIZE` | `2000` | Max log query range chunk size |
| `INDEXER_POLL_MS` | `6000` | Delay between steady-state poll cycles (2000–120000) |
| `INDEXER_REORG_BUFFER` | `64` | Blocks to rewind before `purge` + re-index (8–256) |
| `INDEXER_RPC_FALLBACK` | `true` | If `false`, only `RPC_URL` is used (no extra public fallback transports) |

Docker Compose sets `DATABASE_PATH=/data/app.db` and passes through the same contract/RPC variables as the root `.env`, including the indexer tuning vars above.

**Infura free tier (demo):** use your Infura Sepolia URL as `RPC_URL`, set `INDEXER_RPC_FALLBACK=false`, and try `INDEXER_POLL_MS=10000` with `INDEXER_REORG_BUFFER=32` to cut steady-state RPC volume while keeping the UI responsive.

## Commands

From **`backend/`**:

```bash
npm install
npm run dev      # tsx watch src/indexer.ts
npm run start    # production-style single run
npm run test
npm run test:watch
npm run test:coverage
```

For local runs, keep a populated **`../.env`** at the monorepo root so `load-env` finds `PERP_ADDRESS`, `USDC_ADDRESS`, `RPC_URL`, and `CONTRACT_DEPLOY_BLOCK`.

## Docker

The root [`docker-compose.yml`](../docker-compose.yml) builds this folder’s `Dockerfile` as the `indexer` service, mounts a named volume at `/data`, and sets `DATABASE_PATH=/data/app.db`.

## Operational notes

- **Reorg buffer:** defaults to 64 blocks; tune with `INDEXER_REORG_BUFFER` for your chain and RPC budget.
- **RPC limits:** the indexer splits ranges when the node returns “too many results” style errors.
- **Block timestamps:** repeated blocks inside the reorg window are served from an in-memory LRU cache to reduce `getBlock` traffic.

## See also

- [../README.md](../README.md) — full stack quick start
- [../frontend/README.md](../frontend/README.md) — UI that consumes the indexed DB
- [../CLAUDE.md](../CLAUDE.md) — architecture and invariants

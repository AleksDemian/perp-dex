# Perp DEX (demo)

Full-stack perpetual futures demo: **Solidity** contracts (Foundry), a **TypeScript** event indexer (Node.js + SQLite), and a **Next.js** frontend (wagmi + RainbowKit).

## Repository layout

| Path | Description |
|------|-------------|
| [`contracts/`](contracts/) | Foundry project: `MockUSDC`, `MockPriceFeed`, `PerpEngine`, deploy scripts |
| [`backend/`](backend/) | Event indexer → SQLite |
| [`frontend/`](frontend/) | Next.js 16 app + API routes (read-only DB access) |
| [`docker-compose.yml`](docker-compose.yml) | Runs indexer + frontend with a shared volume for the DB |
| [`.env.example`](.env.example) | Template for RPC, chain, contract addresses, keys |

For deeper contributor notes (invariants, math, architecture), see [`CLAUDE.md`](CLAUDE.md).

## Prerequisites

- **Node.js** 22+ (matches Docker images)
- **Foundry** (`forge`, `cast`) — for contracts only
- **Docker** + Docker Compose — optional but recommended for one-command stack
- **WalletConnect project ID** — for production-quality wallet modal (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env`)

## Using the demo

If the stack is already running (locally or hosted) and you just want to walk through the UI — connect a wallet, claim mUSDC, open a leveraged trade, liquidate, move the oracle price — see [`DEMO.md`](DEMO.md).

## Quick start (Docker)

1. Copy environment file and fill in real values (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

2. After a fresh clone, pull contract dependencies (git submodules):

   ```bash
   git submodule update --init --recursive
   ```

3. From the repository root:

   ```bash
   docker compose up --build
   ```

   - **Frontend:** [http://localhost:3000](http://localhost:3000)
   - **Indexer** writes SQLite to the `app-data` volume at `/data/app.db`; the frontend mounts the same volume read-only.

Ensure `.env` includes deployed `PERP_ADDRESS`, `USDC_ADDRESS`, `PRICE_FEED_ADDRESS`, `RPC_URL`, `CONTRACT_DEPLOY_BLOCK`, `CHAIN_ID` (for client build), and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for WalletConnect. Optional: `MARKET_SYMBOL` / `NEXT_PUBLIC_MARKET_SYMBOL` (see [`.env.example`](.env.example)).

**RPC / Infura:** optional indexer knobs (`INDEXER_POLL_MS`, `INDEXER_REORG_BUFFER`, `INDEXER_RPC_FALLBACK`) are documented in [backend/README.md](backend/README.md).

## Local development (without Docker)

Run each part from its directory after `npm install` (and `forge build` for contracts). Use the same `.env` at the repo root — the backend loads `../../.env` or `../.env` automatically.

- **Contracts:** [contracts/README.md](contracts/README.md)
- **Indexer:** [backend/README.md](backend/README.md)
- **Frontend:** [frontend/README.md](frontend/README.md)

Typical command overview:

```bash
# Contracts (from contracts/)
forge build && forge test

# Indexer (from backend/)
npm run dev

# Frontend (from frontend/)
npm run dev
```

## Security

- Do **not** commit `.env` or real private keys.
- If keys were ever exposed, rotate them and redeploy as needed.

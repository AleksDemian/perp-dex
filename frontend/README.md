# Frontend (Next.js)

Next.js **16** (App Router) trading UI with **wagmi 2** + **RainbowKit** for wallets. Server **API routes** read the same SQLite database the indexer writes (`better-sqlite3`); the browser talks to the chain via wagmi for transactions.

Main routes include `/` (trade), `/admin` (oracle price), `/positions`, `/leaderboard`, `/liquidations`.

## Prerequisites

- Node.js **22+**
- Root `.env` (or `.env.local`) with `NEXT_PUBLIC_*` variables for chain + contracts

## Environment variables

Copy from the monorepo [`.env.example`](../.env.example) and adjust.

**Client (must be prefixed `NEXT_PUBLIC_`)** — inlined at build time for browser code:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_RPC_URL` | Sepolia (or other) HTTP RPC for wagmi transport |
| `NEXT_PUBLIC_CHAIN_ID` | e.g. `11155111` for Sepolia |
| `NEXT_PUBLIC_PERP_ADDRESS` | PerpEngine |
| `NEXT_PUBLIC_USDC_ADDRESS` | MockUSDC |
| `NEXT_PUBLIC_PRICE_FEED_ADDRESS` | MockPriceFeed |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_MARKET_SYMBOL` | Display label, e.g. `BTC-USD` |

**Server (API routes / SSR)** — not exposed to the browser:

| Variable | Purpose |
|----------|---------|
| `DATABASE_PATH` | SQLite path; defaults to `/data/app.db` in Docker, or set for local dev (e.g. point at `../data/app.db`) |

Optional: `NEXT_PUBLIC_E2E=true` enables test-wallet wiring used by Playwright (see `app/providers.tsx`).

Docker Compose passes the same `NEXT_PUBLIC_*` values as build args and runtime env for the `frontend` service.

## Commands

From **`frontend/`**:

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run start
npm run lint
npx playwright test   # E2E
```

## Docker

The root [`docker-compose.yml`](../docker-compose.yml) builds this directory’s multi-stage `Dockerfile`:

- **Build stage** bakes `NEXT_PUBLIC_*` into the Next production bundle.
- **Run stage** uses Next **standalone** output (`node server.js` on port `3000`).

The compose file mounts the shared `app-data` volume read-only at `/data` so API routes can open `app.db`.

## Project pointers

| Area | Path |
|------|------|
| Pages & layouts | `app/` |
| Trading components | `app/_components/` |
| Hooks | `hooks/` |
| On-chain helpers | `lib/contracts.ts`, `lib/perp-math.ts` |
| DB access for API routes | `lib/db.ts` |

## See also

- [../README.md](../README.md) — run full stack with Docker
- [../backend/README.md](../backend/README.md) — indexer that fills the DB
- [../CLAUDE.md](../CLAUDE.md) — contributor-focused architecture and env table

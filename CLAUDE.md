# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack perpetual futures DEX demo with three components: Solidity contracts (Foundry), a TypeScript event indexer (Node.js/SQLite), and a Next.js frontend (wagmi/RainbowKit).

## Commands

### Contracts (Foundry — run from `contracts/`)
```bash
forge build                              # Compile
forge test                               # All tests
forge test --match-contract PerpEngineTest  # Single contract
forge test --match-path test/Liquidation.t.sol  # Single file
forge test --match test_OpenLong         # Single function
forge test -vvv                          # With call traces
forge coverage                           # Coverage report
forge fmt                                # Format Solidity
forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
forge script script/Seed.s.sol:Seed --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
```

### Backend indexer (run from `backend/`)
```bash
npm run dev          # Watch mode (tsx watch)
npm run start        # Production
npm run test         # vitest run
npm run test:watch   # vitest watch
npm run test:coverage
```

### Frontend (run from `frontend/`)
```bash
npm run dev          # Next.js dev server on :3000
npm run build
npm run lint
npx playwright test  # E2E tests
```

### Docker (project root)
```bash
docker-compose up    # Starts indexer + frontend together
```

## Architecture

### Contracts (`contracts/src/`)

Three contracts with a straightforward dependency chain:

- **MockUSDC.sol** — ERC-20 collateral (6 decimals). Has a public `faucet()` dispensing 1,000 mUSDC per address per 24h.
- **MockPriceFeed.sol** — Admin-controlled oracle. Price in 1e18 precision (e.g., `70_000e18` = $70k). Owner calls `setPrice()`.
- **PerpEngine.sol** — Core trading engine. Takes MockUSDC as collateral and MockPriceFeed for mark price.

**PerpEngine mechanics:**
- Leverage: 1–10x. Initial margin 10% (`INITIAL_MARGIN_BPS = 1_000`), maintenance 5% (`MAINTENANCE_MARGIN_BPS = 500`).
- Fees: 0.10% open/close, 0.50% liquidation bonus to caller.
- `MIN_COLLATERAL = 10 * 1e6` (10 mUSDC).
- `TOKEN_TO_USDC = 1e30` — precision bridge between 1e18 price and 1e6 collateral.
- Positions stored in a `mapping(uint256 => Position)` with a per-trader open-position set for pagination.
- Insurance fund covers bad debt on insolvent liquidations; `seedInsuranceFund()` (owner) and `donate()` (public) fill it.

### Backend (`backend/src/`)

Event indexer using viem + better-sqlite3:
- **indexer.ts** — Main loop: backfills from `CONTRACT_DEPLOY_BLOCK`, then polls every 6 s with a 64-block reorg buffer. Splits batches on RPC rate limits.
- **db.ts** — SQLite layer. Tables: `meta`, `positions`, `price_history`, `liquidations`.
- **handlers/** — One handler per event: `PositionOpened`, `PositionClosed`, `PositionLiquidated`, `PriceUpdated`.
- **rpc.ts** — Viem public client wrapper.
- Database lives at `/data/app.db`, shared as a Docker volume (indexer writes, frontend reads).

### Frontend (`frontend/`)

Next.js 16 app-router with wagmi 2 + RainbowKit for wallet connection.

**Pages:** `/` (trading UI), `/admin` (set oracle price), `/positions` (user positions), `/leaderboard` (liquidation stats).

**Key files:**
- `app/_components/` — Page-specific components: `OrderForm`, `TradingDashboardPanel`, `MarketBar`, `PriceChart`.
- `hooks/` — `useCurrentPrice`, `usePositions`, `useLiquidations`, `usePriceHistory` — all read from the SQLite DB via API routes or from the chain via wagmi.
- `lib/contracts.ts` — Contract read/write helpers (wagmi).
- `lib/perp-math.ts` — Liquidation price formula, PnL calculation mirroring on-chain logic.
- `lib/db.ts` — SQLite client used by Next.js API routes.

## Environment

Copy `.env.example` to `.env`. Required variables:

| Variable | Purpose |
|----------|---------|
| `RPC_URL` | Sepolia RPC endpoint |
| `CHAIN_ID` | `11155111` for Sepolia |
| `CONTRACT_DEPLOY_BLOCK` | Start block for indexer backfill |
| `PERP_ADDRESS` / `USDC_ADDRESS` / `PRICE_FEED_ADDRESS` | Deployed contract addresses |
| `MARKET_SYMBOL` | e.g. `BTC-USD` |
| `PRIVATE_KEY` | Deployer/admin key |
| `ETHERSCAN_API_KEY` | For contract verification |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect v2 project ID |
| `INDEXER_BATCH_SIZE` | RPC batch size (default 2000) |

## Key Invariants to Preserve

- **Precision:** collateral is 1e6, prices are 1e18, `sizeTokens` is 1e18. The constant `TOKEN_TO_USDC = 1e30` bridges them — changing this breaks all PnL/liquidation math.
- **Liquidation price formula** is replicated in `lib/perp-math.ts`; keep both in sync when modifying.
- The indexer's reorg buffer (64 blocks) must remain larger than any expected chain reorg.
- SQLite DB is written by the indexer and only read by the frontend — don't add frontend writes.

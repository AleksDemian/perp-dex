# Perp DEX — Demo Walkthrough

A short, end-user guide to the running Perp DEX demo. No setup, no terminal — just a wallet and a browser.

> If you are looking for **how to run** the stack locally or with Docker, see [`README.md`](README.md). This document only covers **how to use** the running app.

## What this is

A testnet-only demo of a perpetual futures DEX deployed on **Sepolia**. Trades use a mock USDC token (`mUSDC`) and a mock oracle price feed — none of it has real value, and no real money is involved.

## Before you start

You need:

- An EVM wallet (MetaMask, Rabby, or any WalletConnect-compatible wallet)
- The wallet pointed at the **Sepolia** test network — chain id `11155111`
- A small amount of **Sepolia ETH** for gas (any public Sepolia faucet will do)
- The demo URL — replace this placeholder with whatever the deployer gave you: `https://perp-dex-demo.hicrystal.com/`

You do **not** need real ETH, real USDC, KYC, or any signup.

## 1. Connect your wallet

1. Open the demo URL.
2. Click **Connect Wallet** in the top-right corner.
3. Pick your wallet from the modal and approve the connection.
4. If your wallet is on the wrong network, the modal will offer to switch you to Sepolia — accept it.

Once connected, your address replaces the **Connect Wallet** button.

## 2. Get test mUSDC (Faucet)

The Perp engine settles in `mUSDC` (mock USDC, 6 decimals). To get some:

1. Make sure your wallet is connected.
2. A green **Faucet** button appears in the header.
3. Click it and confirm the transaction.

You receive **1,000 mUSDC** per address. The faucet has a **24-hour cooldown** per address — once you have used it, the button disappears until the cooldown expires.

If you run out before the cooldown ends, switch to a fresh wallet address.

## 3. Open a position (Trade page `/`)

The default page is the trading view. The order form is on the right.

1. Pick a side: **LONG** (price goes up = profit) or **SHORT** (price goes down = profit).
2. Enter **Collateral** in mUSDC. Minimum is **10 mUSDC**.
3. Pick **Leverage**: `1×`, `2×`, `3×`, `5×`, or `10×`.
4. Review the preview card that appears below the leverage selector:
   - **Entry Price** — current mark price
   - **Notional** — collateral × leverage (your effective position size)
   - **Open Fee** — 0.10% of notional, taken from your collateral
   - **Liq Price** — the price at which the position becomes liquidatable
5. Click **Open Long** / **Open Short**.
6. Confirm two transactions in your wallet:
   - **Approve** mUSDC spending (only the first time, or if you increase your size beyond the previous allowance)
   - **Open** the position itself

After the second transaction is mined, the position shows up in the **Open Positions** tab below the chart.

## 4. Manage open positions

Below the price chart, the trading dashboard has two tabs:

- **Open Positions** — every live position you (or anyone else, for transparency) have open. For your own positions you see live PnL based on the current mark price, plus a **Close** button.
- **Trade History** — every position that has been closed or liquidated, with realized PnL.

Closing is one click + one wallet confirmation. The position settles at the current mark price; collateral plus PnL minus the 0.10% close fee returns to your wallet as mUSDC.

## 5. Liquidations (`/liquidations`)

Liquidations are **permissionless** — any connected wallet can liquidate any under-margined position and earn **0.50% of the position's notional** as a bonus, paid in mUSDC.

The page has three sections:

- **Liquidatable Now** — positions whose mark price has crossed their liquidation price. Each row has a **Liquidate** button. Click it, confirm the transaction, and the bonus lands in your wallet.
- **Watchlist** — positions within 10% of their liquidation price. No action button — these are the ones to keep an eye on.
- **Liquidation History** — recent liquidations with the trader, the liquidator, the mark price at liquidation, and the bonus paid.

The header strip on the page shows live counts of liquidatable and at-risk positions.

## 6. Move the price (`/admin`)

Because the demo uses a mock oracle, you can move the mark price manually to make trades profitable, unprofitable, or liquidatable.

The Admin page has:

- **Price Control** — type any USD price (e.g. `68000`) or use the quick buttons: `-10%`, `-5%`, `-2%`, `+2%`, `+5%`, `+10%` relative to the current price. Click **Set** and confirm the transaction.
- **Indexer Status** — last indexed block, total open positions, and the on-chain **insurance fund** balance.

> Only the wallet that owns the oracle contract can actually change the price. Any other wallet can submit the transaction, but it will revert. If you need price control on a public demo, ask whoever deployed the contracts.

## 7. Leaderboard (`/leaderboard`)

A ranked table of all traders the indexer has seen, sorted by **realized PnL** on closed positions. It also shows total positions, count of normally closed positions, and count of liquidated ones.

## Suggested 3-minute demo script

A "happy path" you can run end to end with two browser profiles (a trader wallet and an admin wallet):

1. **Trader:** connect, click **Faucet** to get 1,000 mUSDC.
2. **Trader:** open a `5×` **LONG** with `100` mUSDC of collateral.
3. **Admin:** open `/admin`, click `+5%`, confirm. Trader closes the position from **Open Positions** for a profit.
4. **Trader:** open a `10×` **LONG** with `100` mUSDC of collateral.
5. **Admin:** click `-10%`, confirm. The position appears under **Liquidatable Now** on `/liquidations`. A third wallet (or the admin) clicks **Liquidate** and pockets the 0.50% bonus.

You will then see the closed trade under **Trade History**, the liquidation under **Liquidation History**, and updated rows on the **Leaderboard**.

## Disclaimer

This is a demo on a public testnet. Tokens are mock tokens with no value. The contracts are not audited and exist solely to demonstrate the architecture. Nothing here is financial advice.

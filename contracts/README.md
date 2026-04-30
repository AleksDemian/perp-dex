# Contracts (Foundry)

Solidity sources for the demo perpetual engine and mocks:

- **`MockUSDC.sol`** — 6-decimal collateral ERC-20 with a cooldown `faucet()`
- **`MockPriceFeed.sol`** — owner-set oracle price (1e18 precision)
- **`PerpEngine.sol`** — core engine (margin, fees, positions, insurance fund)

Sources live in `src/`, tests in `test/`, deployment scripts in `script/`.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)

## Dependencies (git submodules)

This repo vendors Foundry libraries as **git submodules** under `lib/`:

- `lib/openzeppelin-contracts`
- `lib/forge-std`

After cloning the monorepo, from the **repository root**:

```bash
git submodule update --init --recursive
```

If `lib/` folders are empty, `forge build` will fail until submodules are initialized.

## Commands

Run all commands from **`contracts/`** (or pass `--root contracts` if using a workspace wrapper).

```bash
forge build
forge test
forge test -vvv
forge coverage
forge fmt
```

Targeted tests:

```bash
forge test --match-contract PerpEngineTest
forge test --match-path test/Liquidation.t.sol
forge test --match test_OpenLong
```

## Deployment scripts

Full stack (USDC + price feed + engine + insurance seed):

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"
```

Reuse existing USDC + oracle, deploy only `PerpEngine` (requires `USDC_ADDRESS` and `PRICE_FEED_ADDRESS` in the environment):

```bash
forge script script/DeployEngine.s.sol:DeployEngine \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"
```

## Environment variables (scripts)

| Variable | Used for |
|----------|----------|
| `RPC_URL` | Chain RPC for `forge script` |
| `PRIVATE_KEY` | Deployer key (never commit) |
| `ETHERSCAN_API_KEY` | Contract verification on Etherscan-compatible explorers |
| `USDC_ADDRESS` | `DeployEngine` — existing MockUSDC |
| `PRICE_FEED_ADDRESS` | `DeployEngine` — existing oracle |

`foundry.toml` defines a Sepolia Etherscan profile; verify with `forge verify-contract` and `--chain sepolia` after deployment.

## Further reading

Monorepo setup and invariants: [`../CLAUDE.md`](../CLAUDE.md).

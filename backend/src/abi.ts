import { getAddress } from "viem";

export const PERP_ADDRESS = getAddress(
  process.env.PERP_ADDRESS ?? "0x0000000000000000000000000000000000000000"
);

export const PRICE_FEED_ADDRESS = getAddress(
  process.env.PRICE_FEED_ADDRESS ?? "0x0000000000000000000000000000000000000000"
);

export const USDC_ADDRESS = getAddress(
  process.env.USDC_ADDRESS ?? "0x0000000000000000000000000000000000000000"
);

export const PERP_ENGINE_ABI = [
  {
    type: "event",
    name: "PositionOpened",
    inputs: [
      { name: "positionId",       type: "uint256", indexed: true  },
      { name: "trader",           type: "address", indexed: true  },
      { name: "isLong",           type: "bool",    indexed: false },
      { name: "collateral",       type: "uint256", indexed: false },
      { name: "leverage",         type: "uint8",   indexed: false },
      { name: "notional",         type: "uint256", indexed: false },
      { name: "sizeTokens",       type: "uint256", indexed: false },
      { name: "entryPrice",       type: "uint256", indexed: false },
      { name: "liquidationPrice", type: "uint256", indexed: false },
      { name: "fee",              type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PositionClosed",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true  },
      { name: "trader",     type: "address", indexed: true  },
      { name: "exitPrice",  type: "uint256", indexed: false },
      { name: "pnl",        type: "int256",  indexed: false },
      { name: "payout",     type: "uint256", indexed: false },
      { name: "fee",        type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PositionLiquidated",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true  },
      { name: "trader",     type: "address", indexed: true  },
      { name: "liquidator", type: "address", indexed: true  },
      { name: "markPrice",  type: "uint256", indexed: false },
      { name: "bonus",      type: "uint256", indexed: false },
      { name: "remaining",  type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const PRICE_FEED_ABI = [
  {
    type: "event",
    name: "PriceUpdated",
    inputs: [
      { name: "newPrice",  type: "uint256", indexed: false },
      { name: "timestamp", type: "uint64",  indexed: false },
    ],
  },
] as const;

export const PERP_ADDRESS = (process.env.NEXT_PUBLIC_PERP_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const PRICE_FEED_ADDRESS = (process.env.NEXT_PUBLIC_PRICE_FEED_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");

export const MARKET_SYMBOL = process.env.NEXT_PUBLIC_MARKET_SYMBOL ?? "BTC-USD";

export const PERP_ENGINE_ABI = [
  {
    type: "function",
    name: "openPosition",
    inputs: [
      { name: "collateralAmount", type: "uint256" },
      { name: "leverage",         type: "uint8"   },
      { name: "isLong",           type: "bool"    },
    ],
    outputs: [{ name: "positionId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "closePosition",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "liquidate",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "calcLiquidationPrice",
    inputs: [
      { name: "isLong",     type: "bool"    },
      { name: "entryPrice", type: "uint256" },
      { name: "leverage",   type: "uint8"   },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "isLiquidatable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "calcPnl",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "atPrice",    type: "uint256" },
    ],
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPosition",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "trader",           type: "address" },
          { name: "isLong",           type: "bool"    },
          { name: "collateral",       type: "uint128" },
          { name: "leverage",         type: "uint8"   },
          { name: "notional",         type: "uint128" },
          { name: "sizeTokens",       type: "uint256" },
          { name: "entryPrice",       type: "uint256" },
          { name: "liquidationPrice", type: "uint256" },
          { name: "openedAt",         type: "uint64"  },
          { name: "isOpen",           type: "bool"    },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "insuranceFund",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "donate",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
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

export const MOCK_USDC_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "faucet",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "lastFaucet",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const PRICE_FEED_ABI = [
  {
    type: "function",
    name: "latestPrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestTimestamp",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setPrice",
    inputs: [{ name: "newPrice", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

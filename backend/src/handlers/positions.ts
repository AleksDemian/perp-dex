import type { DB } from "../db";
import {
  insertPosition,
  closePosition,
  liquidatePosition,
  insertLiquidation,
} from "../db";

export function handlePositionOpened(
  db: DB,
  args: {
    positionId: bigint;
    trader: `0x${string}`;
    isLong: boolean;
    collateral: bigint;
    leverage: number;
    notional: bigint;
    sizeTokens: bigint;
    entryPrice: bigint;
    liquidationPrice: bigint;
    fee: bigint;
  },
  meta: { txHash: string; blockNumber: number; timestamp: number }
): void {
  insertPosition(db, {
    id: Number(args.positionId),
    trader: args.trader,
    isLong: args.isLong,
    collateral: args.collateral.toString(),
    leverage: args.leverage,
    notional: args.notional.toString(),
    sizeTokens: args.sizeTokens.toString(),
    entryPrice: args.entryPrice.toString(),
    liquidationPrice: args.liquidationPrice.toString(),
    openedAtBlock: meta.blockNumber,
    openedAtTs: meta.timestamp,
    openedTxHash: meta.txHash,
    fee: args.fee.toString(),
  });
}

export function handlePositionClosed(
  db: DB,
  args: {
    positionId: bigint;
    trader: `0x${string}`;
    exitPrice: bigint;
    pnl: bigint;
    payout: bigint;
    fee: bigint;
  },
  meta: { txHash: string; blockNumber: number; timestamp: number }
): void {
  closePosition(db, {
    id: Number(args.positionId),
    closedAtBlock: meta.blockNumber,
    closedAtTs: meta.timestamp,
    closeTxHash: meta.txHash,
    exitPrice: args.exitPrice.toString(),
    realizedPnl: args.pnl.toString(),
    feePaid: args.fee.toString(),
  });
}

export function handlePositionLiquidated(
  db: DB,
  args: {
    positionId: bigint;
    trader: `0x${string}`;
    liquidator: `0x${string}`;
    markPrice: bigint;
    bonus: bigint;
    remaining: bigint;
  },
  meta: {
    txHash: string;
    logIndex: number;
    blockNumber: number;
    timestamp: number;
  }
): void {
  liquidatePosition(db, {
    id: Number(args.positionId),
    liquidator: args.liquidator,
    markPrice: args.markPrice.toString(),
    bonus: args.bonus.toString(),
    closedAtBlock: meta.blockNumber,
    closedAtTs: meta.timestamp,
    closeTxHash: meta.txHash,
  });

  insertLiquidation(db, {
    txHash: meta.txHash,
    logIndex: meta.logIndex,
    positionId: Number(args.positionId),
    trader: args.trader,
    liquidator: args.liquidator,
    markPrice: args.markPrice.toString(),
    bonus: args.bonus.toString(),
    remaining: args.remaining.toString(),
    blockNumber: meta.blockNumber,
    timestamp: meta.timestamp,
  });
}

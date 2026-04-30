import type { DB } from "../db";
import { insertPricePoint } from "../db";

export function handlePriceUpdated(
  db: DB,
  args: { newPrice: bigint; timestamp: bigint },
  meta: { txHash: string; logIndex: number; blockNumber: number; blockTimestamp: number }
): void {
  insertPricePoint(db, {
    txHash: meta.txHash,
    logIndex: meta.logIndex,
    blockNumber: meta.blockNumber,
    timestamp: meta.blockTimestamp,
    price: args.newPrice.toString(),
  });
}

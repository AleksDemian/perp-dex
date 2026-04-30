"use client";

import {
  useWriteContract,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { useAccount } from "wagmi";
import { parseEventLogs, parseUnits, type PublicClient } from "viem";
import { PERP_ADDRESS, USDC_ADDRESS, PERP_ENGINE_ABI, MOCK_USDC_ABI, PRICE_FEED_ADDRESS, PRICE_FEED_ABI } from "@/lib/contracts";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/toast";
import {
  appendPriceHistoryPoint,
  findCachedPosition,
  markPositionClosed,
  prependActivity,
  prependLiquidation,
  setCurrentPrice,
  upsertPosition,
} from "@/lib/query-cache";

const reconciliationTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

function requirePublicClient(client: PublicClient | undefined): PublicClient {
  if (!client) throw new Error("RPC client is not ready");
  return client;
}

function assertSuccessfulReceipt(receipt: { status: "success" | "reverted" }) {
  if (receipt.status !== "success") throw new Error("Transaction reverted");
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function isUserRejectedError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  if (/user rejected|user denied|rejected the request|signature rejected/i.test(text)) {
    return true;
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: number }).code === 4001;
  }
  return false;
}

function safeQueryKeyText(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return "";
  }
}

function invalidateReadContracts(qc: QueryClient, functionNames: string[]) {
  qc.invalidateQueries({
    predicate: (query) => {
      const text = safeQueryKeyText(query.queryKey);
      return functionNames.some((name) => text.includes(name));
    },
  });
}

function reconcileAfterIndexing(qc: QueryClient, keys: string[]) {
  const timerKey = [...keys].sort().join("|");
  for (const timer of reconciliationTimers.get(timerKey) ?? []) {
    clearTimeout(timer);
  }

  qc.invalidateQueries({
    predicate: (query) => keys.includes(String(query.queryKey[0])),
  });

  let timers: ReturnType<typeof setTimeout>[] = [];
  timers = [1_500, 4_000, 8_000].map((delay) =>
    setTimeout(() => {
      qc.refetchQueries({
        predicate: (query) => keys.includes(String(query.queryKey[0])),
        type: "active",
      });
      if (delay === 8_000 && reconciliationTimers.get(timerKey) === timers) {
        reconciliationTimers.delete(timerKey);
      }
    }, delay)
  );
  reconciliationTimers.set(timerKey, timers);
}

interface CurrentPriceApiResponse {
  price: string | null;
  timestamp: number | null;
  blockNumber?: number | null;
}

async function waitForIndexedPriceBlock(targetBlockNumber: number): Promise<void> {
  const timeoutMs = 12_000;
  const intervalMs = 1_200;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch("/api/price/current", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as CurrentPriceApiResponse;
        if ((payload.blockNumber ?? 0) >= targetBlockNumber) return;
      }
    } catch {
      // Ignore transient API errors and retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function useUsdcBalance() {
  const { address } = useAccount();
  return useReadContract({
    address: USDC_ADDRESS,
    abi:     MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address, refetchInterval: 30_000, refetchOnWindowFocus: false },
  });
}

export function useUsdcAllowance() {
  const { address } = useAccount();
  return useReadContract({
    address: USDC_ADDRESS,
    abi:     MOCK_USDC_ABI,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      PERP_ADDRESS,
    ],
    query: { enabled: !!address, refetchInterval: 30_000, refetchOnWindowFocus: false },
  });
}

export function useLastFaucet() {
  const { address } = useAccount();
  return useReadContract({
    address: USDC_ADDRESS,
    abi:     MOCK_USDC_ABI,
    functionName: "lastFaucet",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });
}

export function useFaucet() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const qc = useQueryClient();
  const { push, update } = useToast();

  async function faucet() {
    const id = push({ kind: "pending", title: "Requesting test tokens…" });
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: MOCK_USDC_ABI,
        functionName: "faucet",
      });
      update(id, {
        kind: "pending",
        title: "Waiting for confirmation…",
        txHash: hash,
      });
      const receipt = await requirePublicClient(publicClient).waitForTransactionReceipt({ hash });
      assertSuccessfulReceipt(receipt);
      invalidateReadContracts(qc, ["balanceOf", "lastFaucet"]);
      update(id, { kind: "success", title: "1,000 mUSDC received!", txHash: hash });
      return hash;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      update(id, { kind: "error", title: "Faucet failed", body: msg.slice(0, 120) });
      throw err;
    }
  }

  return { faucet, isPending };
}

export function useApprove() {
  const { writeContractAsync } = useWriteContract();

  async function approve(amount: bigint) {
    return writeContractAsync({
      address: USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: "approve",
      args: [PERP_ADDRESS, amount],
    });
  }

  return { approve };
}

export function useOpenPosition() {
  const { writeContractAsync, isPending } = useWriteContract();
  const { approve } = useApprove();
  const { data: allowance } = useUsdcAllowance();
  const qc = useQueryClient();
  const publicClient = usePublicClient();
  const { push, update } = useToast();

  async function openPosition(params: {
    collateral: bigint;
    leverage: number;
    isLong: boolean;
  }) {
    const needsApproval = (allowance ?? 0n) < params.collateral;
    const totalSteps = needsApproval ? 2 : 1;
    const side = params.isLong ? "Long" : "Short";

    const id = push({
      kind: "pending",
      title: needsApproval ? "Approving USDC…" : `Opening ${side} position…`,
      step: { current: 1, total: totalSteps },
    });

    try {
      if (needsApproval) {
        const approveTx = await approve(params.collateral * 10n);
        update(id, {
          kind: "pending",
          title: "Approval confirmed, opening position…",
          step: { current: 1, total: totalSteps },
          txHash: approveTx,
        });
        const approveReceipt = await requirePublicClient(publicClient).waitForTransactionReceipt({ hash: approveTx });
        assertSuccessfulReceipt(approveReceipt);
        invalidateReadContracts(qc, ["allowance"]);
        update(id, {
          kind: "pending",
          title: `Opening ${side} position…`,
          step: { current: 2, total: totalSteps },
        });
      }

      const tx = await writeContractAsync({
        address:      PERP_ADDRESS,
        abi:          PERP_ENGINE_ABI,
        functionName: "openPosition",
        args: [params.collateral, params.leverage, params.isLong],
      });

      update(id, {
        kind: "pending",
        title: "Waiting for confirmation…",
        step: { current: totalSteps, total: totalSteps },
        txHash: tx,
      });

      const receipt = await requirePublicClient(publicClient).waitForTransactionReceipt({ hash: tx });
      assertSuccessfulReceipt(receipt);
      const [opened] = parseEventLogs({
        abi: PERP_ENGINE_ABI,
        eventName: "PositionOpened",
        logs: receipt.logs,
      });

      if (opened) {
        const timestamp = nowSec();
        const row = {
          id: Number(opened.args.positionId),
          trader: opened.args.trader.toLowerCase(),
          is_long: opened.args.isLong ? 1 : 0,
          collateral: opened.args.collateral.toString(),
          leverage: Number(opened.args.leverage),
          notional: opened.args.notional.toString(),
          size_tokens: opened.args.sizeTokens.toString(),
          entry_price: opened.args.entryPrice.toString(),
          liquidation_price: opened.args.liquidationPrice.toString(),
          opened_at_block: Number(receipt.blockNumber),
          opened_at_ts: timestamp,
          opened_tx_hash: tx,
          closed_at_block: null,
          closed_at_ts: null,
          close_tx_hash: null,
          close_kind: null,
          exit_price: null,
          realized_pnl: null,
          fee_paid: null,
          liquidator: null,
          liquidation_bonus: null,
          is_open: 1,
        };

        upsertPosition(qc, row);
        prependActivity(qc, {
          id: row.id,
          kind: "open",
          trader: row.trader,
          is_long: row.is_long,
          collateral: row.collateral,
          leverage: row.leverage,
          notional: row.notional,
          timestamp,
          tx_hash: tx,
          entry_price: row.entry_price,
        });
      }

      invalidateReadContracts(qc, ["balanceOf", "allowance"]);
      reconcileAfterIndexing(qc, ["positions", "activity"]);

      update(id, {
        kind: "success",
        title: `${side} position opened!`,
        body: `${params.leverage}× leverage`,
        txHash: tx,
        step: undefined,
      });

      return tx;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      update(id, {
        kind: "error",
        title: "Transaction failed",
        body: msg.slice(0, 120),
        step: undefined,
      });
      throw err;
    }
  }

  return { openPosition, isPending };
}

export function useClosePosition() {
  const { writeContractAsync, isPending } = useWriteContract();
  const qc = useQueryClient();
  const publicClient = usePublicClient();
  const { push, update } = useToast();

  async function closePosition(positionId: number) {
    const id = push({ kind: "pending", title: `Closing position #${positionId}…` });
    try {
      const tx = await writeContractAsync({
        address:      PERP_ADDRESS,
        abi:          PERP_ENGINE_ABI,
        functionName: "closePosition",
        args:         [BigInt(positionId)],
      });

      update(id, {
        kind: "pending",
        title: "Waiting for confirmation…",
        txHash: tx,
      });

      const receipt = await requirePublicClient(publicClient).waitForTransactionReceipt({ hash: tx });
      assertSuccessfulReceipt(receipt);
      const [closedLog] = parseEventLogs({
        abi: PERP_ENGINE_ABI,
        eventName: "PositionClosed",
        logs: receipt.logs,
      });
      const timestamp = nowSec();
      const cached = findCachedPosition(qc, positionId);
      const closed = closedLog
        ? markPositionClosed(qc, positionId, {
            closed_at_block: Number(receipt.blockNumber),
            closed_at_ts: timestamp,
            close_tx_hash: tx,
            close_kind: "close",
            exit_price: closedLog.args.exitPrice.toString(),
            realized_pnl: closedLog.args.pnl.toString(),
            fee_paid: closedLog.args.fee.toString(),
          })
        : null;

      if (closedLog && (closed ?? cached)) {
        const position = closed ?? cached!;
        prependActivity(qc, {
          id: positionId,
          kind: "close",
          trader: closedLog.args.trader.toLowerCase(),
          is_long: position.is_long,
          collateral: position.collateral,
          leverage: position.leverage,
          notional: position.notional,
          timestamp,
          tx_hash: tx,
          exit_price: closedLog.args.exitPrice.toString(),
          realized_pnl: closedLog.args.pnl.toString(),
        });
      }

      invalidateReadContracts(qc, ["balanceOf"]);
      reconcileAfterIndexing(qc, ["positions", "activity"]);

      update(id, {
        kind: "success",
        title: `Position #${positionId} closed`,
        txHash: tx,
      });

      return tx;
    } catch (err: unknown) {
      if (isUserRejectedError(err)) {
        update(id, {
          kind: "info",
          title: "Transaction cancelled",
          body: "Request was rejected in wallet",
        });
        return null;
      }
      const msg = err instanceof Error ? err.message : String(err);
      update(id, {
        kind: "error",
        title: "Close failed",
        body: msg.slice(0, 120),
      });
      return null;
    }
  }

  return { closePosition, isPending };
}

export function useLiquidate() {
  const { writeContractAsync, isPending } = useWriteContract();
  const qc = useQueryClient();
  const publicClient = usePublicClient();
  const { push, update } = useToast();

  async function liquidate(positionId: number) {
    const id = push({ kind: "pending", title: `Liquidating position #${positionId}…` });
    try {
      const tx = await writeContractAsync({
        address:      PERP_ADDRESS,
        abi:          PERP_ENGINE_ABI,
        functionName: "liquidate",
        args:         [BigInt(positionId)],
      });

      update(id, { kind: "pending", title: "Waiting for confirmation…", txHash: tx });

      const receipt = await requirePublicClient(publicClient).waitForTransactionReceipt({ hash: tx });
      assertSuccessfulReceipt(receipt);
      const [liquidatedLog] = parseEventLogs({
        abi: PERP_ENGINE_ABI,
        eventName: "PositionLiquidated",
        logs: receipt.logs,
      });
      const timestamp = nowSec();
      const cached = findCachedPosition(qc, positionId);
      const closed = liquidatedLog
        ? markPositionClosed(qc, positionId, {
            closed_at_block: Number(receipt.blockNumber),
            closed_at_ts: timestamp,
            close_tx_hash: tx,
            close_kind: "liquidate",
            exit_price: liquidatedLog.args.markPrice.toString(),
            liquidator: liquidatedLog.args.liquidator.toLowerCase(),
            liquidation_bonus: liquidatedLog.args.bonus.toString(),
            realized_pnl: null,
          })
        : null;

      if (liquidatedLog && (closed ?? cached)) {
        const position = closed ?? cached!;
        prependActivity(qc, {
          id: positionId,
          kind: "liquidate",
          trader: liquidatedLog.args.trader.toLowerCase(),
          is_long: position.is_long,
          collateral: position.collateral,
          leverage: position.leverage,
          notional: position.notional,
          timestamp,
          tx_hash: tx,
          exit_price: liquidatedLog.args.markPrice.toString(),
          bonus: liquidatedLog.args.bonus.toString(),
        });
        prependLiquidation(qc, {
          tx_hash: tx,
          log_index: liquidatedLog.logIndex,
          position_id: positionId,
          trader: liquidatedLog.args.trader.toLowerCase(),
          liquidator: liquidatedLog.args.liquidator.toLowerCase(),
          mark_price: liquidatedLog.args.markPrice.toString(),
          bonus: liquidatedLog.args.bonus.toString(),
          remaining: liquidatedLog.args.remaining.toString(),
          block_number: Number(receipt.blockNumber),
          timestamp,
          is_long: position.is_long,
          collateral: position.collateral,
          leverage: position.leverage,
          notional: position.notional,
        });
      }

      invalidateReadContracts(qc, ["balanceOf"]);
      reconcileAfterIndexing(qc, ["positions", "liquidations", "activity"]);

      update(id, {
        kind: "success",
        title: `Position #${positionId} liquidated`,
        body: "Bonus sent to your wallet",
        txHash: tx,
      });

      return tx;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      update(id, { kind: "error", title: "Liquidation failed", body: msg.slice(0, 120) });
      throw err;
    }
  }

  return { liquidate, isPending };
}

export function useInsuranceFund() {
  return useReadContract({
    address: PERP_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: "insuranceFund",
    query: { refetchInterval: 30_000, refetchOnWindowFocus: false },
  });
}

export function useSetPrice() {
  const { writeContractAsync, isPending } = useWriteContract();
  const qc = useQueryClient();
  const publicClient = usePublicClient();
  const { push, update } = useToast();

  async function setPrice(priceStr: string) {
    const price = parseUnits(priceStr, 18);
    const id = push({ kind: "pending", title: `Setting price to $${priceStr}…` });
    try {
      const tx = await writeContractAsync({
        address:      PRICE_FEED_ADDRESS,
        abi:          PRICE_FEED_ABI,
        functionName: "setPrice",
        args:         [price],
        // Demo stability: some wallet/RPC combinations overestimate gas here
        // and reject tx with "gas limit too high".
        gas:          120_000n,
      });

      update(id, { kind: "pending", title: "Waiting for confirmation…", txHash: tx });

      const client = requirePublicClient(publicClient);
      const receipt = await client.waitForTransactionReceipt({ hash: tx });
      assertSuccessfulReceipt(receipt);

      let blockTs = nowSec();
      try {
        const block = await client.getBlock({ blockNumber: receipt.blockNumber });
        blockTs = Number(block.timestamp);
      } catch {
        // Fallback to wall clock if block fetch hiccups — chart will still self-heal on reconcile.
      }

      const blockNumber = Number(receipt.blockNumber);
      setCurrentPrice(qc, price, blockNumber, blockTs);
      appendPriceHistoryPoint(qc, price, blockNumber, blockTs);
      await waitForIndexedPriceBlock(blockNumber);
      reconcileAfterIndexing(qc, ["price", "positions", "liquidations"]);

      update(id, {
        kind: "success",
        title: `Price updated to $${priceStr}`,
        txHash: tx,
      });

      return tx;
    } catch (err: unknown) {
      if (isUserRejectedError(err)) {
        update(id, {
          kind: "info",
          title: "Transaction cancelled",
          body: "Request was rejected in wallet",
        });
        return null;
      }
      const msg = err instanceof Error ? err.message : String(err);
      update(id, { kind: "error", title: "Price update failed", body: msg.slice(0, 120) });
      throw err;
    }
  }

  return { setPrice, isPending };
}

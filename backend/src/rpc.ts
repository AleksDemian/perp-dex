import { createPublicClient, fallback, http } from "viem";
import { sepolia } from "viem/chains";

export type PublicClient = ReturnType<typeof createClient>;

export function createClient() {
  const primaryRpc = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;

  return createPublicClient({
    chain: sepolia,
    transport: fallback(
      [
        http(primaryRpc ?? undefined, {
          retryCount: 2,
          retryDelay: 250,
          timeout: 15_000,
        }),
        http("https://ethereum-sepolia-rpc.publicnode.com", {
          retryCount: 1,
          retryDelay: 300,
        }),
        http("https://sepolia.gateway.tenderly.co", {
          retryCount: 1,
          retryDelay: 300,
        }),
        http("https://rpc.sepolia.org", {
          retryCount: 0,
        }),
      ],
      { rank: false }
    ),
  });
}

export async function fetchBlockTimestamps(
  client: PublicClient,
  blockNumbers: bigint[]
): Promise<Map<bigint, number>> {
  const unique = [
    ...new Set(blockNumbers.map((n) => n.toString())),
  ].map((s) => BigInt(s));

  const map = new Map<bigint, number>();

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const blocks = await Promise.all(
      chunk.map((n) => client.getBlock({ blockNumber: n }))
    );
    blocks.forEach((b, idx) => map.set(chunk[idx], Number(b.timestamp)));
  }

  return map;
}

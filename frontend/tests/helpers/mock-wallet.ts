/** Injected into the browser via addInitScript before wagmi initialises. */
export function injectMockWallet({
  address,
  chainId,
}: {
  address: string;
  chainId: number;
}) {
  const hexChainId = "0x" + chainId.toString(16);
  const accounts = [address];

  const _handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  const ethereum = {
    isMetaMask: true,
    selectedAddress: address,
    chainId: hexChainId,
    networkVersion: String(chainId),

    on(event: string, handler: (...args: unknown[]) => void) {
      (_handlers[event] = _handlers[event] ?? []).push(handler);
      return ethereum;
    },

    removeListener(event: string, handler: (...args: unknown[]) => void) {
      if (_handlers[event]) {
        _handlers[event] = _handlers[event].filter((h) => h !== handler);
      }
      return ethereum;
    },

    off(event: string, handler: (...args: unknown[]) => void) {
      return ethereum.removeListener(event, handler);
    },

    async request({ method, params }: { method: string; params?: unknown[] }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return accounts;

        case "eth_chainId":
          return hexChainId;

        case "net_version":
          return String(chainId);

        case "eth_getBalance":
          return "0x56BC75E2D63100000"; // 100 ETH

        case "wallet_getPermissions":
        case "wallet_requestPermissions":
          return [{ eth_accounts: {} }];

        case "wallet_switchEthereumChain":
          return null;

        case "personal_sign":
        case "eth_sign":
        case "eth_signTypedData_v4":
          return "0x" + "0".repeat(130);

        case "eth_sendTransaction":
        case "eth_sendRawTransaction":
          return "0x" + "a".repeat(64);

        case "eth_getTransactionReceipt":
          return {
            transactionHash: (params as string[])?.[0] ?? "0x" + "a".repeat(64),
            status: "0x1",
            blockNumber: "0x1",
            gasUsed: "0x5208",
          };

        case "eth_getTransactionByHash":
          return {
            hash: (params as string[])?.[0] ?? "0x" + "a".repeat(64),
            blockNumber: "0x1",
          };

        case "eth_blockNumber":
          return "0x1";

        case "eth_call":
          return "0x";

        default:
          console.warn("[MockWallet] unhandled:", method);
          return null;
      }
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ethereum = ethereum;
  window.dispatchEvent(new Event("ethereum#initialized"));
}

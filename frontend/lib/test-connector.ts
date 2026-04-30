import { createConnector } from "wagmi";
import { custom } from "viem";
import type { Address } from "viem";

const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address;
const SEPOLIA_CHAIN_ID = 11155111;
const HEX_CHAIN_ID = "0xaa36a7";

/** Wagmi connector for Playwright E2E tests — no browser extension needed. */
export function testConnector() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Provider = any;
  let provider: Provider | undefined;

  return createConnector<Provider>((config) => ({
    id: "test",
    name: "Test Wallet",
    type: "test" as const,

    async connect() {
      // Return accounts and chainId; wagmi handles store updates itself
      return {
        accounts: [TEST_ADDRESS] as readonly [Address, ...Address[]],
        chainId: SEPOLIA_CHAIN_ID,
      } as never;
    },

    async disconnect() {
      config.emitter.emit("disconnect");
    },

    async getAccounts() {
      return [TEST_ADDRESS] as readonly [Address, ...Address[]];
    },

    async getChainId() {
      return SEPOLIA_CHAIN_ID;
    },

    async isAuthorized() {
      return false;
    },

    async getProvider() {
      if (!provider) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestFn = async ({ method }: { method: string }): Promise<any> => {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [TEST_ADDRESS];
            case "eth_chainId":
              return HEX_CHAIN_ID;
            case "net_version":
              return String(SEPOLIA_CHAIN_ID);
            case "eth_getBalance":
              return "0x56BC75E2D63100000";
            case "eth_sendTransaction":
            case "eth_sendRawTransaction":
              return "0x" + "a".repeat(64);
            case "eth_getTransactionReceipt":
              return { status: "0x1", blockNumber: "0x1", gasUsed: "0x5208" };
            case "personal_sign":
            case "eth_signTypedData_v4":
              return "0x" + "0".repeat(130);
            default:
              return null;
          }
        };
        provider = custom({ request: requestFn })({
          chain: config.chains[0],
          pollingInterval: 4_000,
        });
      }
      return provider;
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
  }));
}

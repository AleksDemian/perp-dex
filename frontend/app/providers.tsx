"use client";

import {
  QueryClient,
  defaultShouldDehydrateQuery,
  type Query,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  RainbowKitProvider,
  getDefaultConfig,
  connectorsForWallets,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http, useConnect } from "wagmi";
import { sepolia } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, useEffect, useRef } from "react";
import { testWallet } from "@/lib/test-wallet";
import { ToastProvider } from "@/contexts/toast";
import { Toaster } from "@/components/ui/Toaster";
import { APP_DATA_GC_TIME, PERSIST_MAX_AGE } from "@/lib/query-constants";

const isE2E = process.env.NEXT_PUBLIC_E2E === "true";
const PERSISTED_QUERY_KEYS = new Set([
  "positions",
  "price",
  "activity",
  "liquidations",
]);

function shouldPersistQuery(query: Query) {
  return (
    defaultShouldDehydrateQuery(query) &&
    PERSISTED_QUERY_KEYS.has(String(query.queryKey[0]))
  );
}

const wagmiConfig = isE2E
  ? createConfig({
      chains: [sepolia],
      connectors: connectorsForWallets(
        [{ groupName: "Test", wallets: [testWallet] }],
        { appName: "Perp DEX Demo", projectId: "demo" }
      ),
      transports: { [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL) },
    })
  : getDefaultConfig({
      appName: "Perp DEX Demo",
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
      chains: [sepolia],
      ssr: true,
    });

/**
 * Auto-connects the first available connector when window.__E2E_AUTO_CONNECT__
 * is set to true (injected by Playwright via addInitScript).
 */
function AutoConnect() {
  const { connectAsync, connectors } = useConnect();
  const attempted = useRef(false);

  useEffect(() => {
    const flag =
      typeof window !== "undefined" &&
      !!(window as { __E2E_AUTO_CONNECT__?: boolean }).__E2E_AUTO_CONNECT__;
    if (attempted.current || !flag || connectors.length === 0) return;
    attempted.current = true;
    connectAsync({ connector: connectors[0] }).catch(() => {});
  }, [connectAsync, connectors]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, retry: 1, gcTime: APP_DATA_GC_TIME },
        },
      })
  );
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "PERP_DEX_QUERY_CACHE",
      throttleTime: 1_000,
    })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: PERSIST_MAX_AGE,
          dehydrateOptions: {
            shouldDehydrateQuery: shouldPersistQuery,
          },
        }}
      >
        <RainbowKitProvider
          locale="en-US"
          theme={darkTheme({
            accentColor: "#CFD4DB",
            accentColorForeground: "#0D1B2A",
            borderRadius: "small",
          })}
        >
          {isE2E && <AutoConnect />}
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </RainbowKitProvider>
      </PersistQueryClientProvider>
    </WagmiProvider>
  );
}

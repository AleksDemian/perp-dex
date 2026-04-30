import type { WalletList, connectorsForWallets } from "@rainbow-me/rainbowkit";
import { testConnector } from "./test-connector";

type WalletFn = WalletList[number]["wallets"][number];

const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23333'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-size='18'%3ET%3C/text%3E%3C/svg%3E";

/** Wallet entry for RainbowKit's modal — used only in NEXT_PUBLIC_E2E=true mode. */
export const testWallet: WalletFn = () => ({
  id: "test",
  name: "Test Wallet",
  iconUrl: ICON,
  iconBackground: "#1a1a1a",
  installed: true,
  createConnector: () => testConnector(),
});

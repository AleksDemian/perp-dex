import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "Perp DEX Demo",
  description: "Perpetual DEX demo — long/short BTC-USD with up to 10x leverage",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main className="min-h-[calc(100vh-56px)]">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}

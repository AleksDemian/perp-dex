import { MarketBar } from "./_components/MarketBar";
import { PriceChart } from "./_components/PriceChart";
import { OrderForm } from "./_components/OrderForm";
import { TradingDashboardPanel } from "./_components/TradingDashboardPanel";

export const dynamic = "force-dynamic";

export default function TradePage() {
  return (
    <div className="flex flex-col">
      <MarketBar />

      <div className="mx-auto w-full max-w-screen-xl px-4 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="flex flex-col gap-4">
            <PriceChart />
            <TradingDashboardPanel />
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            <OrderForm />
          </div>
        </div>
      </div>
    </div>
  );
}

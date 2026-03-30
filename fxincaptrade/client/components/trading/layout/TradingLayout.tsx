import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BalanceCard from "./BalanceCard";
import ChartContainer from "./ChartContainer";
import OrderBook from "./OrderBook";
import RecentTrades from "./RecentTrades";
import TradingHeaderStrip from "./TradingHeaderStrip";
import TradePanel from "./TradePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  MarketSymbolSummary,
  OrderBookRow,
  RecentTradeRow,
  TradingAccountBalance,
} from "./types";

interface TradingLayoutProps {
  currentSymbol: MarketSymbolSummary;
  accountBalance: TradingAccountBalance | null;
  symbolOptions: string[];
  onSymbolChange: (symbol: string) => void;
  orderBook: {
    asks: OrderBookRow[];
    bids: OrderBookRow[];
  };
  recentTrades: RecentTradeRow[];
  marketPanel: ReactNode;
  chartInterval: string;
  onChartIntervalChange: (interval: string) => void;
  chartDensity: "normal" | "expanded";
  onChartDensityChange: (density: "normal" | "expanded") => void;
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  showRightSidebar: boolean;
  onToggleRightSidebar: () => void;
  showTabletLeft: boolean;
  setShowTabletLeft: (value: boolean) => void;
  showTabletRight: boolean;
  setShowTabletRight: (value: boolean) => void;
  showTabletBottom: boolean;
  setShowTabletBottom: (value: boolean) => void;
  showMobileTradingPanel: boolean;
  setShowMobileTradingPanel: (value: boolean) => void;
  showMobileMarketList: boolean;
  setShowMobileMarketList: (value: boolean) => void;
  chart: ReactNode;
  bottomTabs: ReactNode;
  orderType: "Market" | "Limit" | "Stop HFT";
  setOrderType: (value: "Market" | "Limit" | "Stop HFT") => void;
  pendingPrice: string;
  setPendingPrice: (value: string) => void;
  lot: number;
  setLot: (value: number) => void;
  leverage: number;
  setLeverage: (value: number) => void;
  allocationPercent: number;
  setAllocationPercent: (value: number) => void;
  freeMargin: number;
  sl: string;
  setSl: (value: string) => void;
  tp: string;
  setTp: (value: string) => void;
  onBuy: () => void;
  onSell: () => void;
  submitting: boolean;
}

export default function TradingLayout({
  currentSymbol,
  accountBalance,
  symbolOptions,
  onSymbolChange,
  orderBook,
  recentTrades,
  marketPanel,
  chartInterval,
  onChartIntervalChange,
  chartDensity,
  onChartDensityChange,
  showLeftSidebar,
  onToggleLeftSidebar,
  showRightSidebar,
  onToggleRightSidebar,
  showTabletLeft,
  setShowTabletLeft,
  showTabletRight,
  setShowTabletRight,
  showTabletBottom,
  setShowTabletBottom,
  showMobileTradingPanel,
  setShowMobileTradingPanel,
  showMobileMarketList,
  setShowMobileMarketList,
  chart,
  bottomTabs,
  orderType,
  setOrderType,
  pendingPrice,
  setPendingPrice,
  lot,
  setLot,
  leverage,
  setLeverage,
  allocationPercent,
  setAllocationPercent,
  freeMargin,
  sl,
  setSl,
  tp,
  setTp,
  onBuy,
  onSell,
  submitting,
}: TradingLayoutProps) {
  const [showDesktopBottomPanel, setShowDesktopBottomPanel] = useState(true);

  const tradingTabs = (
    <Tabs defaultValue="ticket" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ticket">Order Ticket</TabsTrigger>
          <TabsTrigger value="book">Order Book</TabsTrigger>
          <TabsTrigger value="trades">Recent Trades</TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="ticket" className="mt-0 space-y-4 p-4">
          <TradePanel
            currentSymbol={currentSymbol}
            orderType={orderType}
            setOrderType={setOrderType}
            pendingPrice={pendingPrice}
            setPendingPrice={setPendingPrice}
            lot={lot}
            setLot={setLot}
            leverage={leverage}
            setLeverage={setLeverage}
            allocationPercent={allocationPercent}
            setAllocationPercent={setAllocationPercent}
            freeMargin={freeMargin}
            sl={sl}
            setSl={setSl}
            tp={tp}
            setTp={setTp}
            onBuy={onBuy}
            onSell={onSell}
            submitting={submitting}
            embedded
          />
          <BalanceCard accountBalance={accountBalance} embedded />
        </TabsContent>

        <TabsContent value="book" className="mt-0">
          <OrderBook asks={orderBook.asks} bids={orderBook.bids} embedded />
        </TabsContent>

        <TabsContent value="trades" className="mt-0">
          <RecentTrades trades={recentTrades} embedded />
        </TabsContent>
      </div>
    </Tabs>
  );

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col overflow-hidden px-3 pb-3 pt-2 lg:px-4 lg:pb-4">
      <TradingHeaderStrip
        currentSymbol={currentSymbol}
        accountBalance={accountBalance}
        symbolOptions={symbolOptions}
        onSymbolChange={onSymbolChange}
      />

      <div className="mt-3 hidden min-h-0 flex-1 overflow-visible lg:flex">
        <div className={`relative shrink-0 overflow-visible transition-all duration-700 ease-in-out ${showLeftSidebar ? "w-80 xl:w-[360px]" : "w-0"}`}>
          <button
            onClick={onToggleLeftSidebar}
            className="absolute right-[-18px] top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0f111b] text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all duration-500 hover:bg-[#171c2b]"
          >
            {showLeftSidebar ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
          <div className={`flex h-full flex-col overflow-hidden rounded-l-xl border border-white/10 bg-[#0f111b] transition-all duration-700 ease-in-out ${showLeftSidebar ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-lg font-bold text-white">Trading Panel</h2>
            </div>
            {tradingTabs}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden border-y border-white/10 bg-[#05070b] px-3 py-3">
          <div className="flex min-h-0 flex-1 max-h-[580px] overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <ChartContainer symbol={currentSymbol.code} density={chartDensity}>{chart}</ChartContainer>
          </div>

          <div
            className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,22,37,.96),rgba(12,14,26,.94))] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-500 ease-in-out"
            style={{
              height: showDesktopBottomPanel ? (chartDensity === "expanded" ? 220 : 280) : 48,
            }}
          >
            <button
              onClick={() => setShowDesktopBottomPanel((value) => !value)}
              className="flex h-12 w-full items-center justify-between border-b border-white/10 px-5 text-white transition hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <span className="block h-1 w-8 rounded-full bg-white/30" />
                <span className="text-xs font-semibold tracking-wide text-gray-300">Order History</span>
              </div>
              <div className="text-gray-400">
                {showDesktopBottomPanel ? <ChevronLeft className="h-4 w-4 rotate-90" /> : <ChevronRight className="h-4 w-4 rotate-90" />}
              </div>
            </button>
            <div className={`min-h-0 overflow-hidden transition-opacity duration-300 ${showDesktopBottomPanel ? "opacity-100" : "pointer-events-none opacity-0"}`} style={{ height: showDesktopBottomPanel ? (chartDensity === "expanded" ? 172 : 232) : 0 }}>
              {bottomTabs}
            </div>
          </div>
        </div>

        <div className={`relative shrink-0 overflow-visible transition-all duration-700 ease-in-out ${showRightSidebar ? "w-80 xl:w-[320px]" : "w-0"}`}>
          <button
            onClick={onToggleRightSidebar}
            className="absolute left-[-18px] top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0f111b] text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all duration-500 hover:bg-[#171c2b]"
          >
            {showRightSidebar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <div className={`flex h-full flex-col overflow-hidden rounded-r-xl border border-white/10 bg-[#0f111b] transition-all duration-700 ease-in-out ${showRightSidebar ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-lg font-bold text-white">Markets</h2>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{marketPanel}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 hidden min-h-0 flex-1 overflow-hidden md:flex lg:hidden" style={{ height: "calc(100vh - 120px)" }}>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <ChartContainer symbol={currentSymbol.code} density={chartDensity}>{chart}</ChartContainer>
        </div>

        <button
          onClick={() => {
            setShowTabletLeft(true);
            setShowTabletRight(false);
          }}
          className="fixed left-0 top-1/2 z-20 flex h-20 w-8 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 border-white/15 text-white"
          style={{
            opacity: showTabletLeft ? 0 : 1,
            pointerEvents: showTabletLeft ? "none" : "auto",
            transition: "opacity 0.25s",
            background: "linear-gradient(180deg,rgba(28,28,48,.93) 0%,rgba(10,10,26,.90) 100%)",
            backdropFilter: "blur(18px) saturate(170%)",
            WebkitBackdropFilter: "blur(18px) saturate(170%)",
          }}
          title="Open Trading Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => {
            setShowTabletRight(true);
            setShowTabletLeft(false);
          }}
          className="fixed right-0 top-1/2 z-20 flex h-20 w-8 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 border-white/15 text-white"
          style={{
            opacity: showTabletRight ? 0 : 1,
            pointerEvents: showTabletRight ? "none" : "auto",
            transition: "opacity 0.25s",
            background: "linear-gradient(180deg,rgba(28,28,48,.93) 0%,rgba(10,10,26,.90) 100%)",
            backdropFilter: "blur(18px) saturate(170%)",
            WebkitBackdropFilter: "blur(18px) saturate(170%)",
          }}
          title="Open Markets"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          onClick={() => setShowTabletLeft(false)}
          className="fixed inset-0 z-[30]"
          style={{
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            opacity: showTabletLeft ? 1 : 0,
            pointerEvents: showTabletLeft ? "auto" : "none",
            transition: "opacity 0.28s",
          }}
        />

        <div
          onClick={() => setShowTabletRight(false)}
          className="fixed inset-0 z-[30]"
          style={{
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
            opacity: showTabletRight ? 1 : 0,
            pointerEvents: showTabletRight ? "auto" : "none",
            transition: "opacity 0.28s",
          }}
        />

        <div
          className="fixed left-0 top-0 z-[40] flex h-screen max-w-[82vw] flex-col"
          style={{
            width: 316,
            transform: showTabletLeft ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.32s cubic-bezier(0.32,0,0.15,1)",
            background: "linear-gradient(160deg,rgba(22,22,42,.97) 0%,rgba(8,8,22,.95) 100%)",
            backdropFilter: "blur(30px) saturate(200%)",
            WebkitBackdropFilter: "blur(30px) saturate(200%)",
            borderRight: "1px solid rgba(255,255,255,.10)",
            boxShadow: "14px 0 52px rgba(0,0,0,.65),inset 1px 0 0 rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.16)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
            <h2 className="text-sm font-bold tracking-wide text-white">Trading Panel</h2>
            <button onClick={() => setShowTabletLeft(false)} className="rounded-lg p-1.5 text-gray-300 transition hover:bg-white/10">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto text-white">{tradingTabs}</div>
        </div>

        <div
          className="fixed right-0 top-0 z-[40] flex h-screen max-w-[82vw] flex-col"
          style={{
            width: 316,
            transform: showTabletRight ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.32s cubic-bezier(0.32,0,0.15,1)",
            background: "linear-gradient(160deg,rgba(22,22,42,.97) 0%,rgba(8,8,22,.95) 100%)",
            backdropFilter: "blur(30px) saturate(200%)",
            WebkitBackdropFilter: "blur(30px) saturate(200%)",
            borderLeft: "1px solid rgba(255,255,255,.10)",
            boxShadow: "-14px 0 52px rgba(0,0,0,.65),inset -1px 0 0 rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.16)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" }}>
            <h2 className="text-sm font-bold tracking-wide text-white">Markets</h2>
            <button onClick={() => setShowTabletRight(false)} className="rounded-lg p-1.5 text-gray-300 transition hover:bg-white/10">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{marketPanel}</div>
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 z-[35] flex flex-col overflow-hidden"
          style={{
            height: showTabletBottom ? "55vh" : "44px",
            transition: "height 0.36s cubic-bezier(0.32,0,0.15,1)",
            background: "linear-gradient(0deg,rgba(14,14,30,.98) 0%,rgba(20,20,40,.94) 100%)",
            backdropFilter: "blur(30px) saturate(200%)",
            WebkitBackdropFilter: "blur(30px) saturate(200%)",
            borderTop: "1px solid rgba(255,255,255,.13)",
            boxShadow: "0 -12px 52px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.18),inset 0 -1px 0 rgba(0,0,0,.4)",
            borderRadius: "18px 18px 0 0",
          }}
        >
          <button onClick={() => setShowTabletBottom(!showTabletBottom)} className="flex h-[44px] shrink-0 items-center justify-between px-5 text-white">
            <div className="flex items-center gap-3">
              <span className="block h-1 w-8 rounded-full bg-white/30" />
              <span className="text-xs font-semibold tracking-wide text-gray-300">Order History</span>
            </div>
            <div className="text-gray-400">{showTabletBottom ? <ChevronLeft className="h-4 w-4 rotate-90" /> : <ChevronRight className="h-4 w-4 rotate-90" />}</div>
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto">{bottomTabs}</div>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col md:hidden">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <ChartContainer symbol={currentSymbol.code} density={chartDensity}>{chart}</ChartContainer>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#0f111b]">
          <button
            onClick={() => setShowMobileTradingPanel(!showMobileTradingPanel)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
          >
            <span className="text-sm font-semibold text-white">Trading Panel</span>
            <span className="text-gray-400">{showMobileTradingPanel ? <ChevronLeft className="h-4 w-4 rotate-90" /> : <ChevronRight className="h-4 w-4 rotate-90" />}</span>
          </button>
          {showMobileTradingPanel && <div className="border-t border-white/10 bg-[#0a0c14]">{tradingTabs}</div>}
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#0f111b]">
          <button
            onClick={() => setShowMobileMarketList(!showMobileMarketList)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
          >
            <span className="text-sm font-semibold text-white">Markets</span>
            <span className="text-gray-400">{showMobileMarketList ? <ChevronLeft className="h-4 w-4 rotate-90" /> : <ChevronRight className="h-4 w-4 rotate-90" />}</span>
          </button>
          {showMobileMarketList && <div className="max-h-72 overflow-y-auto border-t border-white/10 bg-[#0a0c14]">{marketPanel}</div>}
        </div>

        <div className="mt-3 min-h-[260px] overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {bottomTabs}
        </div>
      </div>
    </div>
  );
}
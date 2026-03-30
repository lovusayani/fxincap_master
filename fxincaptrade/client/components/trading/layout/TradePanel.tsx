import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketSymbolSummary } from "./types";
import { cn } from "@/lib/utils";
import { calculateRequiredMargin } from "@/lib/trading";

interface TradePanelProps {
  currentSymbol: MarketSymbolSummary;
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
  embedded?: boolean;
}

const tabOptions = [
  { label: "Limit", value: "Limit" as const },
  { label: "Market", value: "Market" as const },
  { label: "Stop", value: "Stop HFT" as const },
];

export default function TradePanel({
  currentSymbol,
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
  embedded = false,
}: TradePanelProps) {
  const marketPrice = currentSymbol.ask || currentSymbol.bid || 0;
  const effectivePrice = orderType === "Market" ? marketPrice : parseFloat(pendingPrice) || 0;
  const requiredMargin = calculateRequiredMargin(currentSymbol.code, lot, effectivePrice, leverage);
  const estimatedMargin = requiredMargin;
  const remainingFreeMargin = Math.max(0, freeMargin - requiredMargin);
  const hasValidPrice = effectivePrice > 0;
  const insufficientMargin = hasValidPrice && requiredMargin > freeMargin;
  const isNegative = currentSymbol.change.startsWith("-");
  const livePrice = marketPrice > 0 ? marketPrice.toFixed(marketPrice > 100 ? 2 : 5) : "--";
  const content = (
    <>
      <Tabs value={orderType} onValueChange={(value) => setOrderType(value as "Market" | "Limit" | "Stop HFT")}>
        <TabsList className="grid w-full grid-cols-3">
          {tabOptions.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {orderType === "Market" ? (
        <div className={`rounded-2xl border p-4 ${isNegative ? "border-red-400/20 bg-red-500/[0.08]" : "border-cyan-400/20 bg-cyan-500/[0.08]"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">{currentSymbol.code}</div>
          <div className="mt-2 text-4xl font-bold tracking-tight text-white">{livePrice}</div>
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className={isNegative ? "text-red-300" : "text-emerald-300"}>{currentSymbol.change}</span>
            <span className="text-gray-400">Bid {currentSymbol.bid > 0 ? currentSymbol.bid.toFixed(currentSymbol.bid > 100 ? 2 : 5) : "--"}</span>
            <span className="text-gray-400">Ask {currentSymbol.ask > 0 ? currentSymbol.ask.toFixed(currentSymbol.ask > 100 ? 2 : 5) : "--"}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Price</label>
          <Input
            type="number"
            value={pendingPrice}
            onChange={(event) => setPendingPrice(event.target.value)}
            placeholder="Enter price"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Lot Size</label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => setLot(Math.max(0.01, Number((lot - 0.01).toFixed(2))))} className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 px-0 text-lg text-white hover:bg-white/10">
            -
          </Button>
          <Input
            type="number"
            value={lot.toFixed(2)}
            onChange={(event) => setLot(Math.max(0.01, parseFloat(event.target.value) || 0.01))}
            step="0.01"
            className="text-center text-base font-semibold"
          />
          <Button type="button" variant="ghost" onClick={() => setLot(Number((lot + 0.01).toFixed(2)))} className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 px-0 text-lg text-white hover:bg-white/10">
            +
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-gray-400">
          <span>Allocation</span>
          <span>{allocationPercent}%</span>
        </div>
        <Slider
          value={[allocationPercent]}
          max={100}
          min={0}
          step={1}
          onValueChange={(value) => setAllocationPercent(value[0] ?? 0)}
        />
        <div className="grid grid-cols-4 gap-2">
          {[25, 50, 75, 100].map((value) => (
            <Button
              key={value}
              variant="ghost"
              className="h-8 rounded-lg border border-white/10 bg-white/5 text-xs text-gray-300 hover:bg-white/10"
              onClick={() => setAllocationPercent(value)}
            >
              {value}%
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Using Free Margin</span>
          <span>${((freeMargin * allocationPercent) / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Stop Loss</label>
          <Input type="number" value={sl} onChange={(event) => setSl(event.target.value)} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Take Profit</label>
          <Input type="number" value={tp} onChange={(event) => setTp(event.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-gray-400">
          <span>Leverage</span>
          <span>{leverage}x</span>
        </div>
        <Slider
          value={[leverage]}
          min={10}
          max={100}
          step={1}
          onValueChange={(value) => setLeverage(value[0] ?? leverage)}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-400">Required Margin</span>
          <span className={`font-semibold ${insufficientMargin ? "text-red-300" : "text-cyan-200"}`}>${requiredMargin.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <span className="text-gray-400">Estimated Margin</span>
          <span className="font-semibold text-white">${estimatedMargin.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <span className="text-gray-400">Free Margin After</span>
          <span className={`font-semibold ${insufficientMargin ? "text-red-300" : "text-emerald-300"}`}>${remainingFreeMargin.toFixed(2)}</span>
        </div>
        {insufficientMargin && (
          <div className="mt-2 border-t border-red-400/20 pt-2 text-xs text-red-300">
            Required margin exceeds available free margin.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onBuy} disabled={submitting || !hasValidPrice || insufficientMargin} variant="default" className="h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
          {submitting ? "Placing..." : "Buy"}
        </Button>
        <Button onClick={onSell} disabled={submitting || !hasValidPrice || insufficientMargin} variant="destructive" className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700">
          {submitting ? "Placing..." : "Sell"}
        </Button>
      </div>
    </>
  );

  if (embedded) {
    return <div className={cn("space-y-4", embedded && "p-4")}>{content}</div>;
  }

  return (
    <Card className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-300">
      <CardHeader className="pb-2">
        <CardTitle>Trade Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{content}</CardContent>
    </Card>
  );
}
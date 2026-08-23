import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketSymbolSummary } from "./types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { calculateRequiredMargin, validateStopLossForSide } from "@/lib/trading";

/** Selectable account leverage ratios, shown as 1:N. */
export const LEVERAGE_OPTIONS = [100, 200, 500, 1000, 1500, 2000] as const;

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
  /** Lets users type "1.25" without `toFixed(2)` snapping each keystroke. */
  const [lotEditing, setLotEditing] = useState(false);
  const [lotText, setLotText] = useState("");

  const sym = currentSymbol.code;
  const ask = currentSymbol.ask || 0;
  const bid = currentSymbol.bid || 0;
  const marketMid = ask && bid ? (ask + bid) / 2 : ask || bid || 0;

  const pendingNum = parseFloat(pendingPrice) || 0;
  const isMarket = orderType === "Market";
  const priceForPending = pendingNum > 0 ? pendingNum : 0;

  const entryBuy = isMarket ? ask : priceForPending;
  const entrySell = isMarket ? bid : priceForPending;

  const marginBuy = calculateRequiredMargin(sym, lot, entryBuy || marketMid, leverage);
  const marginSell = calculateRequiredMargin(sym, lot, entrySell || marketMid, leverage);

  const noFreeMargin = freeMargin <= 0;
  const insufficientBuy = entryBuy > 0 && marginBuy > freeMargin;
  const insufficientSell = entrySell > 0 && marginSell > freeMargin;

  const effectiveForDisplay = isMarket ? marketMid : priceForPending;
  const hasValidPrice = effectiveForDisplay > 0;

  const slNum = parseFloat(sl);
  const slParsed = Number.isFinite(slNum) && slNum > 0 ? slNum : null;

  const slBuyCheck = validateStopLossForSide("BUY", entryBuy || 0, slParsed);
  const slSellCheck = validateStopLossForSide("SELL", entrySell || 0, slParsed);

  // Only surfaced when the order cannot be placed — an explanation for the
  // disabled buttons, not the full margin breakdown that used to live here.
  const blockingMessage = noFreeMargin
    ? "No free margin — close positions before opening new trades."
    : isMarket && insufficientBuy && insufficientSell
      ? "Required margin exceeds free margin."
      : isMarket && insufficientBuy
        ? "Required margin exceeds free margin for Buy."
        : isMarket && insufficientSell
          ? "Required margin exceeds free margin for Sell."
          : orderType === "Market" && slParsed != null && !slBuyCheck.ok
            ? slBuyCheck.message
            : orderType === "Market" && slParsed != null && !slSellCheck.ok
              ? slSellCheck.message
              : null;

  const isNegative = currentSymbol.change.startsWith("-");
  const livePrice = marketMid > 0 ? marketMid.toFixed(marketMid > 100 ? 2 : 5) : "--";

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

      {/* Price and the two order buttons share one card: the quote a trader acts
          on and the button that acts on it belong together, and merging them
          reclaims the vertical space the separate blocks used to take. */}
      <div className="space-y-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          {orderType === "Market" ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className={cn("text-sm font-semibold", isNegative ? "text-red-400" : "text-emerald-400")}>
                  {currentSymbol.change}
                </span>
                <span className="text-sm font-semibold text-gray-300">{sym}</span>
              </div>
              <div className="py-1 text-center text-4xl font-bold tracking-tight text-white tabular-nums">
                {livePrice}
              </div>
            </>
          ) : (
            <div className="space-y-2 pb-1">
              <div className="flex items-baseline justify-between">
                <label htmlFor="pending-price" className="text-xs uppercase tracking-[0.18em] text-gray-400">
                  Price
                </label>
                <span className="text-sm font-semibold text-gray-300">{sym}</span>
              </div>
              <Input
                id="pending-price"
                type="number"
                value={pendingPrice}
                onChange={(event) => setPendingPrice(event.target.value)}
                placeholder="Enter price"
              />
            </div>
          )}

          {/* Labelled Sell/Buy for clarity; the price underneath is the one the
              order actually fills at — the bid for a sell, the ask for a buy. */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onSell}
              disabled={submitting || !hasValidPrice || noFreeMargin || insufficientSell || (orderType === "Market" && slParsed != null && !slSellCheck.ok)}
              className="flex flex-col items-center rounded-full border border-white/25 bg-red-500/80 py-0.5 leading-tight text-white shadow-lg shadow-red-900/40 ring-1 ring-inset ring-white/20 backdrop-blur-md transition hover:bg-red-500 hover:shadow-red-800/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <span className="text-sm font-semibold drop-shadow-sm">{submitting ? "Placing..." : "Sell"}</span>
              {!submitting && isMarket && bid > 0 && (
                <span className="text-[10px] tabular-nums opacity-95">{bid.toFixed(bid > 100 ? 2 : 5)}</span>
              )}
            </button>
            <button
              type="button"
              onClick={onBuy}
              disabled={submitting || !hasValidPrice || noFreeMargin || insufficientBuy || (orderType === "Market" && slParsed != null && !slBuyCheck.ok)}
              className="flex flex-col items-center rounded-full border border-white/25 bg-emerald-500/80 py-0.5 leading-tight text-white shadow-lg shadow-emerald-900/40 ring-1 ring-inset ring-white/20 backdrop-blur-md transition hover:bg-emerald-500 hover:shadow-emerald-800/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              <span className="text-sm font-semibold drop-shadow-sm">{submitting ? "Placing..." : "Buy"}</span>
              {!submitting && isMarket && ask > 0 && (
                <span className="text-[10px] tabular-nums opacity-95">{ask.toFixed(ask > 100 ? 2 : 5)}</span>
              )}
            </button>
          </div>
        </div>
        {blockingMessage && (
          <p className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {blockingMessage}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Lot Size</label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setLotEditing(false);
              setLot(Math.max(0.01, Number((lot - 0.01).toFixed(2))));
            }}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 px-0 text-lg text-white hover:bg-white/10"
          >
            -
          </Button>
          <Input
            type="text"
            inputMode="decimal"
            value={lotEditing ? lotText : lot.toFixed(2)}
            onFocus={() => {
              setLotEditing(true);
              setLotText(lot.toFixed(2));
            }}
            onChange={(event) => setLotText(event.target.value)}
            onBlur={() => {
              setLotEditing(false);
              const parsed = parseFloat(lotText.replace(",", "."));
              if (Number.isFinite(parsed) && parsed > 0) {
                setLot(Math.max(0.01, Number(parsed.toFixed(2))));
              }
            }}
            className="text-center text-base font-semibold"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setLotEditing(false);
              setLot(Number((lot + 0.01).toFixed(2)));
            }}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 px-0 text-lg text-white hover:bg-white/10"
          >
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

      <div className="space-y-2">
        <label htmlFor="leverage-select" className="text-xs uppercase tracking-[0.18em] text-gray-400">
          Leverage
        </label>
        <div className="relative">
          <select
            id="leverage-select"
            value={leverage}
            onChange={(event) => setLeverage(Number(event.target.value))}
            className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 pr-9 text-sm font-semibold text-white outline-none transition hover:bg-white/10 focus:border-cyan-400/40"
          >
            {/* Keeps an account-set ratio selectable even if it is not one of the presets. */}
            {!LEVERAGE_OPTIONS.includes(leverage as (typeof LEVERAGE_OPTIONS)[number]) && (
              <option value={leverage} className="bg-slate-900 text-white">
                1:{leverage}
              </option>
            )}
            {LEVERAGE_OPTIONS.map((value) => (
              <option key={value} value={value} className="bg-slate-900 text-white">
                1:{value}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Stop Loss</label>
          <Input
            type="number"
            value={sl}
            onChange={(event) => setSl(event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Take Profit</label>
          <Input
            type="number"
            value={tp}
            onChange={(event) => setTp(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
    </>
  );

  if (embedded) {
    // No padding here — the embedding TabsContent already supplies it, and the
    // two together were doubling the inset.
    return <div className="space-y-4">{content}</div>;
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

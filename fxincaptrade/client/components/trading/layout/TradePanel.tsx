import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketSymbolSummary } from "./types";
import { cn } from "@/lib/utils";
import {
  calculateRequiredMargin,
  getNotional,
  getPipSize,
  slDistancePips,
  validateStopLossForSide,
} from "@/lib/trading";

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

  const notionalBuy = getNotional(sym, lot, entryBuy || marketMid);
  const notionalSell = getNotional(sym, lot, entrySell || marketMid);

  const freeAfterBuy = Math.max(0, freeMargin - marginBuy);
  const freeAfterSell = Math.max(0, freeMargin - marginSell);

  const noFreeMargin = freeMargin <= 0;
  const insufficientBuy = entryBuy > 0 && marginBuy > freeMargin;
  const insufficientSell = entrySell > 0 && marginSell > freeMargin;

  const effectiveForDisplay = isMarket ? marketMid : priceForPending;
  const hasValidPrice = effectiveForDisplay > 0;
  const pip = getPipSize(sym);

  const slNum = parseFloat(sl);
  const slParsed = Number.isFinite(slNum) && slNum > 0 ? slNum : null;

  const slBuyCheck = validateStopLossForSide("BUY", entryBuy || 0, slParsed);
  const slSellCheck = validateStopLossForSide("SELL", entrySell || 0, slParsed);

  const slPipsBuy =
    slParsed && entryBuy ? slDistancePips(sym, entryBuy, slParsed) : null;
  const slPipsSell =
    slParsed && entrySell ? slDistancePips(sym, entrySell, slParsed) : null;

  const setSlPipsFromEntry = (side: "BUY" | "SELL", pips: number) => {
    const entry = side === "BUY" ? entryBuy : entrySell;
    if (!entry || entry <= 0 || !Number.isFinite(pips)) return;
    const delta = pips * pip;
    const next = side === "BUY" ? entry - delta : entry + delta;
    const decimals = entry > 100 ? 2 : entry > 10 ? 4 : 5;
    setSl(String(Number(next.toFixed(decimals))));
  };

  const isNegative = currentSymbol.change.startsWith("-");
  const livePrice = marketMid > 0 ? marketMid.toFixed(marketMid > 100 ? 2 : 5) : "--";

  const marginRows =
    isMarket && ask > 0 && bid > 0 ? (
      <>
        <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] leading-relaxed text-gray-300">
          <div className="font-semibold text-cyan-200/90">Buy @ Ask {ask.toFixed(ask > 100 ? 2 : 5)}</div>
          <div className="mt-1 flex justify-between gap-2">
            <span className="text-gray-500">Notional</span>
            <span>${notionalBuy.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Required margin</span>
            <span className={insufficientBuy ? "text-red-300" : "text-cyan-200"}>${marginBuy.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-white/5 pt-1">
            <span className="text-gray-500">Free margin after</span>
            <span className={insufficientBuy ? "text-red-300" : "text-emerald-300"}>${freeAfterBuy.toFixed(2)}</span>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] leading-relaxed text-gray-300">
          <div className="font-semibold text-rose-200/90">Sell @ Bid {bid.toFixed(bid > 100 ? 2 : 5)}</div>
          <div className="mt-1 flex justify-between gap-2">
            <span className="text-gray-500">Notional</span>
            <span>${notionalSell.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-500">Required margin</span>
            <span className={insufficientSell ? "text-red-300" : "text-cyan-200"}>${marginSell.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-white/5 pt-1">
            <span className="text-gray-500">Free margin after</span>
            <span className={insufficientSell ? "text-red-300" : "text-emerald-300"}>${freeAfterSell.toFixed(2)}</span>
          </div>
        </div>
      </>
    ) : (
      <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] leading-relaxed text-gray-300">
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Notional</span>
          <span>${getNotional(sym, lot, effectiveForDisplay || 0).toFixed(2)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span className="text-gray-500">Required margin</span>
          <span className={marginBuy > freeMargin ? "text-red-300" : "text-cyan-200"}>
            ${calculateRequiredMargin(sym, lot, effectiveForDisplay || 0, leverage).toFixed(2)}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2 border-t border-white/5 pt-1">
          <span className="text-gray-500">Free margin after</span>
          <span className={marginBuy > freeMargin ? "text-red-300" : "text-emerald-300"}>
            ${Math.max(0, freeMargin - calculateRequiredMargin(sym, lot, effectiveForDisplay || 0, leverage)).toFixed(2)}
          </span>
        </div>
      </div>
    );

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
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">{sym}</div>
          <div className="mt-2 text-4xl font-bold tracking-tight text-white">{livePrice}</div>
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className={isNegative ? "text-red-300" : "text-emerald-300"}>{currentSymbol.change}</span>
            <span className="text-gray-400">Bid {bid > 0 ? bid.toFixed(bid > 100 ? 2 : 5) : "--"}</span>
            <span className="text-gray-400">Ask {ask > 0 ? ask.toFixed(ask > 100 ? 2 : 5) : "--"}</span>
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
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Stop Loss (Market orders)</label>
          <span className="text-[10px] text-gray-500">Pip size ≈ {pip}</span>
        </div>
        <Input type="number" value={sl} onChange={(event) => setSl(event.target.value)} placeholder="Optional — validated vs Bid/Ask" />
        {((orderType === "Market" && ask > 0 && bid > 0) || (orderType !== "Market" && priceForPending > 0)) && (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-white/15 bg-white/5 text-[10px] text-gray-200"
                onClick={() => setSlPipsFromEntry("BUY", 10)}
              >
                Buy: SL −10 pips
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-white/15 bg-white/5 text-[10px] text-gray-200"
                onClick={() => setSlPipsFromEntry("BUY", 20)}
              >
                Buy: SL −20 pips
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-white/15 bg-white/5 text-[10px] text-gray-200"
                onClick={() => setSlPipsFromEntry("SELL", 10)}
              >
                Sell: SL +10 pips
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-white/15 bg-white/5 text-[10px] text-gray-200"
                onClick={() => setSlPipsFromEntry("SELL", 20)}
              >
                Sell: SL +20 pips
              </Button>
            </div>
            <div className="space-y-1 rounded-md border border-white/10 bg-white/[0.02] p-2 text-[10px] text-gray-400">
              <div>
                <span className="text-cyan-300/90">Buy</span>{" "}
                {isMarket ? (
                  <>
                    uses Ask <span className="text-white">{ask.toFixed(ask > 100 ? 2 : 5)}</span>
                  </>
                ) : (
                  <>
                    ref. <span className="text-white">{priceForPending.toFixed(priceForPending > 100 ? 2 : 5)}</span> (limit)
                  </>
                )}
                {slParsed ? (
                  <>
                    {" "}
                    — SL distance{" "}
                    {slPipsBuy != null ? (
                      <span className="text-gray-200">{slPipsBuy.toFixed(1)} pips</span>
                    ) : (
                      "—"
                    )}{" "}
                    {slBuyCheck.ok ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">{slBuyCheck.message}</span>}
                  </>
                ) : null}
              </div>
              <div>
                <span className="text-rose-300/90">Sell</span>{" "}
                {isMarket ? (
                  <>
                    uses Bid <span className="text-white">{bid.toFixed(bid > 100 ? 2 : 5)}</span>
                  </>
                ) : (
                  <>
                    ref. <span className="text-white">{priceForPending.toFixed(priceForPending > 100 ? 2 : 5)}</span> (limit)
                  </>
                )}
                {slParsed ? (
                  <>
                    {" "}
                    — SL distance{" "}
                    {slPipsSell != null ? (
                      <span className="text-gray-200">{slPipsSell.toFixed(1)} pips</span>
                    ) : (
                      "—"
                    )}{" "}
                    {slSellCheck.ok ? <span className="text-emerald-400">✓</span> : <span className="text-rose-400">{slSellCheck.message}</span>}
                  </>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.18em] text-gray-400">Take Profit</label>
        <Input type="number" value={tp} onChange={(event) => setTp(event.target.value)} placeholder="Optional" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-gray-400">
          <span>Leverage (1–100)</span>
          <span>{leverage}x</span>
        </div>
        <Slider
          value={[leverage]}
          min={1}
          max={100}
          step={1}
          onValueChange={(value) => setLeverage(value[0] ?? leverage)}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Margin & exposure</div>
        {marginRows}
        {noFreeMargin && (
          <div className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 p-2 text-xs text-red-200">
            No free margin — close positions or cancel pending orders before opening new trades.
          </div>
        )}
        {isMarket && (insufficientBuy || insufficientSell) && (
          <div className="mt-2 border-t border-red-400/20 pt-2 text-xs text-red-300">
            Required margin exceeds free margin for {insufficientBuy && insufficientSell ? "Buy and Sell" : insufficientBuy ? "Buy @ Ask" : "Sell @ Bid"}.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onBuy}
          disabled={submitting || !hasValidPrice || noFreeMargin || insufficientBuy || (orderType === "Market" && slParsed != null && !slBuyCheck.ok)}
          variant="default"
          className="h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {submitting ? "Placing..." : "Buy"}
        </Button>
        <Button
          onClick={onSell}
          disabled={submitting || !hasValidPrice || noFreeMargin || insufficientSell || (orderType === "Market" && slParsed != null && !slSellCheck.ok)}
          variant="destructive"
          className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700"
        >
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

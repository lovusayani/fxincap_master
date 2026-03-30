import { Badge } from "@/components/ui/badge";
import type { MarketSymbolSummary, TradingAccountBalance } from "./types";

interface TradingHeaderStripProps {
  currentSymbol: MarketSymbolSummary;
  accountBalance: TradingAccountBalance | null;
  symbolOptions: string[];
  onSymbolChange: (symbol: string) => void;
}

function formatPrice(price: number) {
  if (!price) return "--";
  return price.toFixed(price > 100 ? 2 : 5);
}

function formatMoney(value: number, currency = "USD") {
  return `${currency} ${value.toFixed(2)}`;
}

export default function TradingHeaderStrip({ currentSymbol, accountBalance, symbolOptions, onSymbolChange }: TradingHeaderStripProps) {
  const spread = currentSymbol.ask > 0 && currentSymbol.bid > 0 ? currentSymbol.ask - currentSymbol.bid : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-gray-300">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={currentSymbol.code}
          onChange={(event) => onSymbolChange(event.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-[#111522] px-3 text-sm font-semibold text-white outline-none transition hover:border-white/20 focus:border-white/30"
        >
          {symbolOptions.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>
        <Badge className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
          {currentSymbol.code}
        </Badge>
        <span className="whitespace-nowrap text-gray-400">Bid {formatPrice(currentSymbol.bid)}</span>
        <span className="whitespace-nowrap text-gray-400">Ask {formatPrice(currentSymbol.ask)}</span>
        <span className="whitespace-nowrap text-gray-500">Spread {spread > 0 ? formatPrice(spread) : "--"}</span>
        <span className={`whitespace-nowrap font-medium ${currentSymbol.change.startsWith("-") ? "text-red-300" : "text-emerald-300"}`}>
          {currentSymbol.change}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge variant="neutral" className="gap-1 px-2 py-1 text-[10px]">
          <span className="text-slate-400">Balance</span>
          <span className="text-white">{accountBalance ? formatMoney(accountBalance.balance, accountBalance.currency) : "--"}</span>
        </Badge>
        <Badge variant="default" className="gap-1 px-2 py-1 text-[10px]">
          <span className="text-white/70">Equity</span>
          <span>{accountBalance ? formatMoney(accountBalance.equity, accountBalance.currency) : "--"}</span>
        </Badge>
        <Badge variant="warning" className="gap-1 px-2 py-1 text-[10px]">
          <span className="text-amber-200/80">Margin</span>
          <span>{accountBalance ? formatMoney(accountBalance.margin, accountBalance.currency) : "--"}</span>
        </Badge>
        <Badge variant="success" className="gap-1 px-2 py-1 text-[10px]">
          <span className="text-emerald-200/80">Free Margin</span>
          <span>{accountBalance ? formatMoney(accountBalance.freeMargin, accountBalance.currency) : "--"}</span>
        </Badge>
      </div>
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TicketBalancePreview, TradingAccountBalance } from "./types";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  accountBalance: TradingAccountBalance | null;
  /** Live estimate: margin/free margin (and highlights) react to lot, leverage, allocation-driven lot, and price */
  ticketPreview?: TicketBalancePreview | null;
  embedded?: boolean;
}

export default function BalanceCard({ accountBalance, ticketPreview, embedded = false }: BalanceCardProps) {
  const display: TradingAccountBalance | null = accountBalance
    ? ticketPreview
      ? {
          ...accountBalance,
          balance: ticketPreview.balance,
          equity: ticketPreview.equity,
          margin: ticketPreview.margin,
          freeMargin: ticketPreview.freeMargin,
          currency: ticketPreview.currency || accountBalance.currency,
        }
      : accountBalance
    : null;

  const rows = display
    ? [
        ["Balance", `${display.currency} ${display.balance.toFixed(2)}`],
        ["Equity", `${display.currency} ${display.equity.toFixed(2)}`],
        ["Margin", `${display.currency} ${display.margin.toFixed(2)}`],
        ["Free Margin", `${display.currency} ${display.freeMargin.toFixed(2)}`],
      ]
    : [];

  const freeNegative = display && display.freeMargin < 0;

  const content = display ? (
    <div className="space-y-3">
      {ticketPreview ? (
        <p className="text-[11px] leading-snug text-cyan-300/90">
          Live preview if you open <span className="font-semibold">this order</span> (lot, leverage, price). Balance & equity stay the same until the trade fills; margin moves from free to used.
        </p>
      ) : null}
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
        >
          <span className="text-sm text-gray-400">{label}</span>
          <span
            className={cn(
              "text-sm font-medium",
              label === "Free Margin" && freeNegative ? "text-red-300" : "text-white"
            )}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  ) : (
    <div className="py-8 text-sm text-gray-400">Balance unavailable</div>
  );

  if (embedded) {
    return <div className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-4")}>{content}</div>;
  }

  return (
    <Card className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2">
      <CardHeader className="pb-2">
        <CardTitle>Balance</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

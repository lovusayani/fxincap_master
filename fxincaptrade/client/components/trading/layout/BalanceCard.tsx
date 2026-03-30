import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TradingAccountBalance } from "./types";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  accountBalance: TradingAccountBalance | null;
  embedded?: boolean;
}

export default function BalanceCard({ accountBalance, embedded = false }: BalanceCardProps) {
  const rows = accountBalance
    ? [
        ["Balance", `${accountBalance.currency} ${accountBalance.balance.toFixed(2)}`],
        ["Equity", `${accountBalance.currency} ${accountBalance.equity.toFixed(2)}`],
        ["Margin", `${accountBalance.currency} ${accountBalance.margin.toFixed(2)}`],
        ["Free Margin", `${accountBalance.currency} ${accountBalance.freeMargin.toFixed(2)}`],
      ]
    : [];

  const content = accountBalance ? (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
          <span className="text-sm text-gray-400">{label}</span>
          <span className="text-sm font-medium text-white">{value}</span>
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
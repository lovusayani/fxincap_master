import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecentTradeRow } from "./types";
import { cn } from "@/lib/utils";

interface RecentTradesProps {
  trades: RecentTradeRow[];
  embedded?: boolean;
}

function formatPrice(price: number) {
  return price.toFixed(price > 100 ? 2 : 5);
}

export default function RecentTrades({ trades, embedded = false }: RecentTradesProps) {
  const content = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((trade) => (
          <TableRow key={trade.id}>
            <TableCell className="text-gray-400">{trade.timeLabel}</TableCell>
            <TableCell className={`font-mono ${trade.side === "buy" ? "text-emerald-300" : "text-red-300"}`}>
              {formatPrice(trade.price)}
            </TableCell>
            <TableCell className="font-mono">{trade.amount.toFixed(3)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (embedded) {
    return <div className={cn("px-4 pb-4")}>{content}</div>;
  }

  return (
    <Card className="overflow-hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-300">
      <CardHeader className="pb-2">
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
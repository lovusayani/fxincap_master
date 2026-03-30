import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderBookRow } from "./types";
import { cn } from "@/lib/utils";

interface OrderBookProps {
  asks: OrderBookRow[];
  bids: OrderBookRow[];
  embedded?: boolean;
}

function formatPrice(price: number) {
  return price.toFixed(price > 100 ? 2 : 5);
}

export default function OrderBook({ asks, bids, embedded = false }: OrderBookProps) {
  const content = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Price</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {asks.map((row, index) => (
          <TableRow key={`ask-${index}`}>
            <TableCell className="font-mono text-red-300">{formatPrice(row.price)}</TableCell>
            <TableCell className="font-mono">{row.amount.toFixed(3)}</TableCell>
            <TableCell className="font-mono text-gray-400">{row.total.toFixed(3)}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={3} className="py-4 text-center text-base font-semibold text-white">
            Mid Market
          </TableCell>
        </TableRow>
        {bids.map((row, index) => (
          <TableRow key={`bid-${index}`}>
            <TableCell className="font-mono text-emerald-300">{formatPrice(row.price)}</TableCell>
            <TableCell className="font-mono">{row.amount.toFixed(3)}</TableCell>
            <TableCell className="font-mono text-gray-400">{row.total.toFixed(3)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (embedded) {
    return <div className={cn("px-4 pb-4")}>{content}</div>;
  }

  return (
    <Card className="overflow-hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2">
      <CardHeader className="pb-2">
        <CardTitle>Order Book</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{content}</CardContent>
    </Card>
  );
}
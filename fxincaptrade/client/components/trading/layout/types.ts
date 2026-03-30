export interface TradingAccountBalance {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
}

export interface MarketSymbolSummary {
  code: string;
  bid: number;
  ask: number;
  change: string;
}

export interface OrderBookRow {
  price: number;
  amount: number;
  total: number;
  side: "bid" | "ask";
}

export interface RecentTradeRow {
  id: string;
  price: number;
  amount: number;
  timeLabel: string;
  side: "buy" | "sell";
}
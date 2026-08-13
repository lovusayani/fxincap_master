export interface TradingAccountBalance {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  /** Account max leverage (1–100); aligns with API open trade validation */
  leverage?: number;
}

/** Estimated account lines if the current ticket order opens (same formulas as Trade Panel). */
export interface TicketBalancePreview {
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
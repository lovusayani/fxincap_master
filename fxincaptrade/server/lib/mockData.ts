// Simple in-memory mock data to make the demo usable without a database.
export const mockPositions = [
  {
    id: "pos-1",
    userId: "demo-user",
    symbol: "EURUSD",
    side: "BUY",
    volume: 1.2,
    entryPrice: 1.095,
    takeProfit: 1.105,
    stopLoss: 1.085,
    pnl: 120.5,
    status: "OPEN",
  },
  {
    id: "pos-2",
    userId: "demo-user",
    symbol: "GBPUSD",
    side: "SELL",
    volume: 0.8,
    entryPrice: 1.275,
    takeProfit: 1.260,
    stopLoss: 1.285,
    pnl: -45.2,
    status: "OPEN",
  },
];

export const mockOrders = [
  {
    id: "ord-1",
    userId: "demo-user",
    symbol: "USDJPY",
    type: "LIMIT BUY",
    volume: 1,
    price: 148.9,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  },
  {
    id: "ord-2",
    userId: "demo-user",
    symbol: "EURUSD",
    type: "STOP SELL",
    volume: 0.5,
    price: 1.0925,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  },
];

export const mockPrices = {
  EURUSD: { bid: 1.095, ask: 1.0952, spread: 0.0002, time: new Date() },
  GBPUSD: { bid: 1.2751, ask: 1.2753, spread: 0.0002, time: new Date() },
  USDJPY: { bid: 149.02, ask: 149.03, spread: 0.01, time: new Date() },
  AUDUSD: { bid: 0.6551, ask: 0.6553, spread: 0.0002, time: new Date() },
  USDCAD: { bid: 1.3788, ask: 1.379, spread: 0.0002, time: new Date() },
  USDCHF: { bid: 0.8821, ask: 0.8823, spread: 0.0002, time: new Date() },
};

export function refreshMockPrices() {
  Object.keys(mockPrices).forEach((k) => {
    const key = k as keyof typeof mockPrices;
    const base = mockPrices[key];
    const drift = (Math.random() - 0.5) * base.spread * 2;
    const mid = (base.bid + base.ask) / 2 + drift;
    mockPrices[key] = {
      bid: Number((mid - base.spread / 2).toFixed(5)),
      ask: Number((mid + base.spread / 2).toFixed(5)),
      spread: base.spread,
      time: new Date(),
    };
  });
}

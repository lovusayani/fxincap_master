// Simple price service stub - returns mock prices
// In production, this should connect to TwelveData, Binance, etc.

export async function getCurrentPrice(symbol: string): Promise<number> {
  // Mock prices for development
  const mockPrices: Record<string, number> = {
    EURUSD: 1.0850,
    GBPUSD: 1.2700,
    USDJPY: 151.50,
    BTCUSDT: 97500.00,
    ETHUSDT: 3250.00,
    XAUUSD: 4535.00,
  };

  return mockPrices[symbol] || 1.0000;
}

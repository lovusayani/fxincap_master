// Placeholder for future Binance provider
export class BinanceProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  connect() {}
  async getQuote(symbol) { return null; }
  subscribe(symbol, onUpdate) {}
  unsubscribe(symbol) {}
}

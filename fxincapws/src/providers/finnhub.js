import WebSocket from 'ws';

const FINNHUB_WS = 'wss://ws.finnhub.io';

/**
 * Start a simple Finnhub trade stream for US stocks, forex, and crypto symbols.
 * @param {Object} params
 * @param {string} params.apiKey Finnhub API token
 * @param {string[]} params.symbols Array of symbols as Finnhub expects (e.g., AAPL, BINANCE:BTCUSDT, OANDA:EUR_USD)
 * @param {(trade: { symbol: string, price: number, ts: number }) => void} params.onTrade Callback for each trade tick
 * @returns control functions to manage the stream
 */
export function startFinnhubStream({ apiKey, symbols = [], onTrade, onError, onClose }) {
  if (!apiKey) throw new Error('apiKey is required');
  const ws = new WebSocket(`${FINNHUB_WS}?token=${apiKey}`);
  const live = new Set(symbols);
  let manualClose = false;

  const sendSubscribe = (sym) => {
    if (!sym || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'subscribe', symbol: sym }));
  };

  const sendUnsubscribe = (sym) => {
    if (!sym || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'unsubscribe', symbol: sym }));
  };

  ws.on('open', () => {
    for (const sym of live) sendSubscribe(sym);
  });

  ws.on('message', (msg) => {
    try {
      const payload = JSON.parse(msg.toString());
      if (payload.type === 'trade' && Array.isArray(payload.data)) {
        for (const t of payload.data) {
          onTrade?.({ symbol: t.s, price: t.p, ts: t.t });
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  ws.on('error', (err) => {
    onError?.(err);
  });

  ws.on('close', () => {
    if (!manualClose) onClose?.(new Error('finnhub stream closed'));
  });

  return {
    addSymbol: (sym) => {
      if (!sym) return;
      live.add(sym);
      sendSubscribe(sym);
    },
    removeSymbol: (sym) => {
      if (!sym) return;
      live.delete(sym);
      sendUnsubscribe(sym);
    },
    close: () => {
      manualClose = true;
      ws.close();
    },
    socket: ws,
  };
}

// Lightweight wrapper to keep existing server integration working
export class FinnhubProvider {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.handlers = new Map();
    this.stream = null;
    this.onFailure = options.onFailure;
  }

  connect() {
    if (this.stream) this.stream.close();
    this.stream = startFinnhubStream({
      apiKey: this.apiKey,
      symbols: [],
      onTrade: ({ symbol, price, ts }) => {
        const handler = this.handlers.get(symbol);
        if (handler) handler({ symbol, last: price, ts });
      },
      onError: (error) => {
        this.onFailure?.(error);
      },
      onClose: (error) => {
        this.onFailure?.(error);
      },
    });
  }

  // Quotes via REST were removed; return null so callers can handle missing quote gracefully.
  async getQuote() {
    return null;
  }

  subscribe(symbol, onUpdate) {
    if (!symbol) return;
    this.handlers.set(symbol, onUpdate);
    this.stream?.addSymbol(symbol);
  }

  unsubscribe(symbol) {
    if (!symbol) return;
    this.handlers.delete(symbol);
    this.stream?.removeSymbol(symbol);
  }

  disconnect() {
    this.stream?.close();
    this.stream = null;
    this.handlers.clear();
  }
}

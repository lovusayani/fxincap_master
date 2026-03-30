import WebSocket from 'ws';

const TWELVEDATA_WS = 'wss://ws.twelvedata.com/v1/quotes/price';

/**
 * Start TwelveData WebSocket stream using official Twelve Data WS endpoint.
 * Connects using API key and subscribes to symbols for real-time price updates.
 * @param {Object} params
 * @param {string} params.apiKey TwelveData API key
 * @param {string[]} params.symbols Array of symbols (e.g., XAUUSD, AAPL, EUR/USD)
 * @param {(update: { symbol: string, price: number, bid?: number, ask?: number, ts: number }) => void} params.onUpdate Callback for price updates
 * @returns control functions
 */
export function startTwelvedataWS({ apiKey, symbols = [], onUpdate, onClose, onError }) {
  if (!apiKey) throw new Error('apiKey is required');
  const ws = new WebSocket(`${TWELVEDATA_WS}?apikey=${apiKey}`);
  const live = new Set(symbols);
  let connected = false;
  let manualClose = false;

  ws.on('open', () => {
    connected = true;
    console.log('[twelvedata-ws] connected');
    // Subscribe to all symbols on connect
    if (live.size > 0) {
      const symbols = Array.from(live).join(',');
      ws.send(JSON.stringify({ action: 'subscribe', params: { symbols } }));
      console.log('[twelvedata-ws] subscribed to:', symbols);
    }
  });

  ws.on('message', (msg) => {
    try {
      const payload = JSON.parse(msg.toString());
      // Handle subscribe-status events
      if (payload.event === 'subscribe-status') {
        if (payload.status === 'ok') {
          console.log('[twelvedata-ws] subscription ok');
        } else if (payload.status === 'error') {
          console.error('[twelvedata-ws] subscription error:', payload.fails);
        }
        return;
      }
      // Handle price events: { event: 'price', symbol, price, bid, ask, timestamp }
      if (payload.event === 'price' && payload.symbol && payload.price !== undefined) {
        onUpdate?.({
          symbol: payload.symbol,
          price: payload.price,
          bid: payload.bid || payload.price,
          ask: payload.ask || payload.price,
          ts: (payload.timestamp || Math.floor(Date.now() / 1000)) * 1000,
        });
      }
    } catch (e) {
      console.error('[twelvedata-ws] parse error:', e.message);
    }
  });

  ws.on('error', (err) => {
    console.error('[twelvedata-ws] error:', err.message);
    connected = false;
    onError?.(err);
  });

  ws.on('close', () => {
    console.log('[twelvedata-ws] closed');
    connected = false;
    if (!manualClose) onClose?.();
  });

  return {
    addSymbol: (sym) => {
      if (!sym || live.has(sym)) return;
      live.add(sym);
      if (connected) {
        ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: sym } }));
      }
    },
    removeSymbol: (sym) => {
      if (!sym) return;
      live.delete(sym);
      if (connected) {
        ws.send(JSON.stringify({ action: 'unsubscribe', params: { symbols: sym } }));
      }
    },
    isConnected: () => connected,
    close: () => {
      manualClose = true;
      ws.close();
    },
    socket: ws,
  };
}

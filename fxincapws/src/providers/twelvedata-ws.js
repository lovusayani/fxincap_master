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
export function startTwelvedataWS({ apiKey, symbols = [], onUpdate, onClose, onError, onSubscribeStatus }) {
  if (!apiKey) throw new Error('apiKey is required');
  const ws = new WebSocket(`${TWELVEDATA_WS}?apikey=${encodeURIComponent(apiKey)}`);
  const live = new Set(symbols);
  let connected = false;
  let manualClose = false;
  /** Twelve Data recommends heartbeat every ~10s to keep the connection stable */
  let heartbeatTimer = null;

  const sendHeartbeat = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ action: 'heartbeat' }));
    } catch (e) {
      console.warn('[twelvedata-ws] heartbeat send failed:', e.message);
    }
  };

  ws.on('open', () => {
    connected = true;
    console.log('[twelvedata-ws] connected');
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendHeartbeat, 10000);
    // Subscribe to all symbols on connect
    if (live.size > 0) {
      const symList = Array.from(live).join(',');
      ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: symList } }));
      console.log('[twelvedata-ws] subscribed to:', symList);
    }
  });

  ws.on('message', (msg) => {
    try {
      const payload = JSON.parse(msg.toString());
      // Handle subscribe-status events
      if (payload.event === 'subscribe-status') {
        if (payload.status === 'ok') {
          console.log('[twelvedata-ws] subscription ok', payload.success?.length || 0, 'symbols');
          if (Array.isArray(payload.fails) && payload.fails.length) {
            console.warn('[twelvedata-ws] subscription partial fails:', payload.fails);
          }
        } else if (payload.status === 'error') {
          console.error('[twelvedata-ws] subscription error:', payload.fails);
        }
        onSubscribeStatus?.(payload);
        return;
      }
      // Price events — https://twelvedata.com/docs/websocket/ws-real-time-price
      if (payload.event === 'price' && payload.symbol && payload.price !== undefined) {
        const tsSec = payload.timestamp != null ? Number(payload.timestamp) : Math.floor(Date.now() / 1000);
        const tsMs = tsSec > 1e12 ? tsSec : tsSec * 1000;
        onUpdate?.({
          symbol: payload.symbol,
          price: Number(payload.price),
          bid: payload.bid != null ? Number(payload.bid) : Number(payload.price),
          ask: payload.ask != null ? Number(payload.ask) : Number(payload.price),
          ts: tsMs,
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
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (!manualClose) onClose?.();
  });

  return {
    addSymbol: (sym) => {
      if (!sym || live.has(sym)) return;
      live.add(sym);
      if (connected) {
        ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: String(sym) } }));
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
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      ws.close();
    },
    socket: ws,
  };
}

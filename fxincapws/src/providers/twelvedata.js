import axios from 'axios';
import { startTwelvedataWS } from './twelvedata-ws.js';

const TWELVEDATA_REST = 'https://api.twelvedata.com/quote';

function toTwelvedataSymbol(rawSymbol) {
  if (!rawSymbol) return rawSymbol;
  const symbol = String(rawSymbol).toUpperCase().trim();

  if (symbol.includes('/') || symbol.includes(':')) return symbol;

  const spotMetals = {
    XAUUSD: 'XAU/USD',
    XAGUSD: 'XAG/USD',
    XPTUSD: 'XPT/USD',
    XPDUSD: 'XPD/USD',
  };
  if (spotMetals[symbol]) return spotMetals[symbol];

  // Convert common FX pairs like EURUSD -> EUR/USD
  const majors = new Set(['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD']);
  if (symbol.length === 6) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    if (majors.has(base) && majors.has(quote)) return `${base}/${quote}`;
    if (base.startsWith('X') || quote === 'USD') return `${base}/${quote}`;
  }

  // Convert common crypto pairs like BTCUSDT -> BTC/USD
  if (symbol.endsWith('USDT') && symbol.length > 4) {
    return `${symbol.slice(0, -4)}/USD`;
  }

  // Minimal aliases for index-like symbols
  const aliases = {
    US30: 'DJI',
    US100: 'IXIC',
    SPX500: 'SPX',
  };

  return aliases[symbol] || symbol;
}

/**
 * Fetch a single quote from TwelveData REST API.
 * Supports XAUUSD, stocks, forex, etc.
 */
export async function getTwelvedataQuote(symbol, apiKey) {
  if (!apiKey || !symbol) return null;
  try {
    const { data } = await axios.get(TWELVEDATA_REST, {
      params: { symbol, apikey: apiKey },
      timeout: 8000,
    });

    if (!data || data.status === 'error' || (typeof data.code === 'number' && data.code >= 400)) {
      console.error(`[twelvedata] API error for ${symbol}:`, data?.message || data?.status || data?.code || 'no data');
      return null;
    }

    const closeRaw = data.close;
    if (closeRaw === undefined || closeRaw === null || closeRaw === '') {
      console.error(`[twelvedata] no close field for ${symbol}`);
      return null;
    }

    const mid = parseFloat(closeRaw);
    if (!Number.isFinite(mid)) {
      console.error(`[twelvedata] invalid close for ${symbol}:`, closeRaw);
      return null;
    }
    const spread = mid * 0.0005; // 5 bps spread
    
    return {
      symbol,
      bid: +(mid - spread).toFixed(5),
      ask: +(mid + spread).toFixed(5),
      mid,
      last: mid,
      time: Math.floor(Date.now() / 1000),
    };
  } catch (e) {
    console.error(`[twelvedata] quote fetch error for ${symbol}:`, e.message);
    return null;
  }
}

/**
 * TwelveData Provider - Primary WebSocket, fallback to REST polling
 * 
 * Free plan:
 *  - REST quotes: ✅ Available (works for all symbols)
 *  - WebSocket: ⚠️ Limited to trial symbols only
 * 
 * Pro/Grow plans:
 *  - Full WebSocket access for all symbols
 */
export class TwelvedataProvider {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.ws = null;
    this.wsConnected = false;
    this.callbacks = new Map(); // clientSymbol -> callback
    this.quotes = new Map(); // clientSymbol -> cached quote
    this.clientToProvider = new Map(); // clientSymbol -> providerSymbol
    this.providerToClients = new Map(); // providerSymbol -> Set(clientSymbol)
    this.pollInterval = null;
    this.wsReconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.onFailure = options.onFailure;
    this.manualDisconnect = false;
  }

  connect() {
    if (!this.apiKey) {
      throw new Error('apiKey is required');
    }
    // Lazy: WebSocket connects when the first subscriber arrives
    this.enabled = true;
    this.manualDisconnect = false;
    console.log('[twelvedata] Provider ready (WebSocket will connect on first subscriber)');
  }

  connectWebSocket() {
    if (this.ws) return; // Already connecting or connected
    try {
      console.log('[twelvedata] Attempting WebSocket connection...');
      const wsSymbols = Array.from(new Set(this.clientToProvider.values()));
      this.ws = startTwelvedataWS({
        apiKey: this.apiKey,
        symbols: wsSymbols,
        onUpdate: (update) => {
          this.wsConnected = true;
          this.wsReconnectAttempts = 0;

          const clients = this.providerToClients.get(update.symbol) || new Set([update.symbol]);
          for (const clientSymbol of clients) {
            const quote = {
              symbol: clientSymbol,
              bid: update.bid,
              ask: update.ask,
              mid: (update.bid + update.ask) / 2,
              last: update.price,
              time: Math.floor(update.ts / 1000),
            };

            this.quotes.set(clientSymbol, quote);
            const cb = this.callbacks.get(clientSymbol);
            if (cb) cb(quote);
          }
        },
        onClose: () => {
          this.ws = null;
          this.wsConnected = false;
          if (this.manualDisconnect) return;
          // Reconnect if we still have subscribers
          if (this.callbacks.size > 0) {
            if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
              this.wsReconnectAttempts++;
              console.log(`[twelvedata] WS closed, reconnecting (attempt ${this.wsReconnectAttempts})...`);
              setTimeout(() => this.connectWebSocket(), 5000);
            } else {
              console.log('[twelvedata] Max reconnect attempts reached, triggering provider failover');
              this.onFailure?.(new Error('twelvedata websocket unavailable'));
            }
          }
        },
        onError: (error) => {
          if (this.manualDisconnect) return;
          if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
            this.onFailure?.(error);
          }
        },
      });
    } catch (e) {
      console.warn('[twelvedata] WebSocket init failed:', e.message);
      this.ws = null;
      this.wsConnected = false;
      if (this.wsReconnectAttempts < this.maxReconnectAttempts) {
        this.wsReconnectAttempts++;
        setTimeout(() => this.connectWebSocket(), 5000);
      } else {
        console.log('[twelvedata] Max reconnect attempts reached, triggering provider failover');
        this.onFailure?.(e);
      }
    }
  }

  startPolling() {
    if (this.pollInterval) return; // Already polling
    
    const poll = async () => {
      for (const [clientSymbol, cb] of this.callbacks) {
        try {
          const providerSymbol = this.clientToProvider.get(clientSymbol) || toTwelvedataSymbol(clientSymbol);
          const quote = await getTwelvedataQuote(providerSymbol, this.apiKey);
          if (quote) {
            const normalizedQuote = {
              ...quote,
              symbol: clientSymbol,
            };
            this.quotes.set(clientSymbol, normalizedQuote);
            cb(normalizedQuote);
          }
        } catch (e) {
          console.error(`[twelvedata] polling failed for ${clientSymbol}:`, e.message);
        }
      }
    };
    
    // First poll immediately, then at intervals
    poll();
    this.pollInterval = setInterval(poll, 2000);
    console.log('[twelvedata] REST polling started (2s interval)');
  }

  subscribe(symbol, callback) {
    if (!symbol || !callback) return;

    const clientSymbol = String(symbol).toUpperCase();
    const providerSymbol = toTwelvedataSymbol(clientSymbol);

    this.callbacks.set(clientSymbol, callback);
    this.clientToProvider.set(clientSymbol, providerSymbol);

    const clients = this.providerToClients.get(providerSymbol) || new Set();
    clients.add(clientSymbol);
    this.providerToClients.set(providerSymbol, clients);

    // REST quotes work on all plan tiers; WebSocket may be limited (trial symbols only on free tier).
    if (!this.pollInterval) {
      this.startPolling();
    }

    if (this.wsConnected && this.ws?.addSymbol) {
      this.ws.addSymbol(providerSymbol);
    } else if (!this.ws && this.enabled) {
      this.connectWebSocket();
    }
    
    // Send cached quote if available
    if (this.quotes.has(clientSymbol)) {
      callback(this.quotes.get(clientSymbol));
    }
  }

  unsubscribe(symbol) {
    if (!symbol) return;

    const clientSymbol = String(symbol).toUpperCase();
    const providerSymbol = this.clientToProvider.get(clientSymbol) || toTwelvedataSymbol(clientSymbol);

    this.callbacks.delete(clientSymbol);
    this.quotes.delete(clientSymbol);
    this.clientToProvider.delete(clientSymbol);

    const clients = this.providerToClients.get(providerSymbol);
    if (clients) {
      clients.delete(clientSymbol);
      if (clients.size === 0) {
        this.providerToClients.delete(providerSymbol);
      }
    }
    
    if (this.wsConnected && this.ws?.removeSymbol) {
      const hasAnyClientForProvider = this.providerToClients.has(providerSymbol);
      if (!hasAnyClientForProvider) this.ws.removeSymbol(providerSymbol);
    }
    
    // Stop polling if no more subscribers
    if (this.callbacks.size === 0 && this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[twelvedata] Polling stopped (no subscribers)');
    }
  }

  async getQuote(symbol) {
    const clientSymbol = String(symbol).toUpperCase();
    const providerSymbol = this.clientToProvider.get(clientSymbol) || toTwelvedataSymbol(clientSymbol);

    // Return cached quote if fresh
    if (this.quotes.has(clientSymbol)) {
      const quote = this.quotes.get(clientSymbol);
      const age = Date.now() / 1000 - quote.time;
      if (age < 10) return quote; // Cache valid for 10 seconds
    }
    
    // Fetch fresh quote
    const quote = await getTwelvedataQuote(providerSymbol, this.apiKey);
    if (quote) {
      const normalizedQuote = {
        ...quote,
        symbol: clientSymbol,
      };
      this.quotes.set(clientSymbol, normalizedQuote);
      return normalizedQuote;
    }
    return null;
  }

  disconnect() {
    this.manualDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.wsConnected = false;
    this.callbacks.clear();
    this.quotes.clear();
    this.clientToProvider.clear();
    this.providerToClients.clear();
  }
}

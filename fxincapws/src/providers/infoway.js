import axios from 'axios';
import { startInfowayWS, parseDepthPush, parseTradePush } from './infoway-ws.js';

/**
 * Infoway market-data provider.
 *
 * Docs: https://docs.infoway.io
 *   REST   GET {REST}/{business}/batch_depth/{codes}   -> bid/ask (order book)
 *          GET {REST}/{business}/batch_trade/{codes}   -> last traded price
 *          auth: `apiKey` request header
 *   WS     wss://data.infoway.io/ws?business=<b>&apikey=<key>
 *          see infoway-ws.js for the protocol codes
 *
 * Depth is the primary source because this platform settles against bid/ask;
 * a last-price-only feed is unusable for it (the Finnhub adapter demonstrates
 * that failure mode — see docs/MARKET_DATA_ARCHITECTURE.md §3).
 *
 * Nothing Infoway-shaped leaves this file: every callback and getQuote() result
 * is the normalized contract
 *   { symbol, bid, ask, mid, last, time }   // client symbol, time in SECONDS
 */

const DEFAULT_REST_URL = 'https://data.infoway.io';
const DEFAULT_WS_URL = 'wss://data.infoway.io/ws';
const REST_TIMEOUT_MS = 8000;

/**
 * Asset class -> Infoway "business" path/query segment.
 * Documented values: stock, crypto, common (forex/metals/futures), japan, india, korea.
 */
export function resolveBusiness(rawSymbol) {
  const symbol = String(rawSymbol || '').toUpperCase().trim();
  if (!symbol) return 'common';

  // Explicit override: "crypto:BTCUSDT" forces a business.
  const explicit = symbol.match(/^(STOCK|CRYPTO|COMMON|JAPAN|INDIA|KOREA):/);
  if (explicit) return explicit[1].toLowerCase();

  // Exchange-suffixed equities/indices, e.g. TSLA.US, 000001.SZ, .DJI.US
  if (symbol.includes('.')) return 'stock';

  // Crypto quote assets seen in Infoway's own examples (BTCUSDT).
  if (/(USDT|USDC|BUSD)$/.test(symbol)) return 'crypto';

  // Forex, metals, energy and futures all sit under `common`.
  return 'common';
}

/**
 * Client symbol -> Infoway product code.
 *
 * Infoway's documented codes are concatenated with no separator (`BTCUSDT` in
 * the WebSocket examples; forex listed as `EURUSD`/`USDGBP`), which already
 * matches this platform's internal symbols, so the default is pass-through.
 *
 * ⚠ The docs do not show a worked forex/metal request, and one page mixes
 * `EURUSD` with `GBP/USD` prose. Confirm against
 * `GET /common/basic/symbols?type=FOREX` with a live key. If Infoway turns out
 * to use a different casing or a suffix, set INFOWAY_SYMBOL_MAP rather than
 * editing code:
 *     INFOWAY_SYMBOL_MAP=XAUUSD=XAU/USD,EURUSD=EUR/USD
 */
export function buildSymbolMap(rawEnvValue) {
  const map = new Map();
  const raw = String(rawEnvValue || '').trim();
  if (!raw) return map;

  for (const pair of raw.split(',')) {
    const [from, to] = pair.split('=').map((s) => (s || '').trim());
    if (from && to) map.set(from.toUpperCase(), to);
  }
  return map;
}

export function toInfowaySymbol(rawSymbol, overrides) {
  const symbol = String(rawSymbol || '').toUpperCase().trim();
  if (!symbol) return symbol;

  const stripped = symbol.replace(/^(STOCK|CRYPTO|COMMON|JAPAN|INDIA|KOREA):/, '');
  if (overrides?.has(stripped)) return overrides.get(stripped);
  return stripped;
}

/**
 * Infoway REST envelope -> normalized quote.
 *
 * Depth response: { ret, msg, traceId, data: [ { s, t, a: [[px],[qty]], b: [[px],[qty]] } ] }
 * Trade response: { ret, msg, traceId, data: [ { s, t, p, v, vw, td } ] }
 *
 * `clientSymbol` is what the caller asked for; the quote is always relabelled
 * to it so no provider-side code escapes this module.
 * Exported for tests.
 */
export function normalizeRestQuote(clientSymbol, payload, { last = null } = {}) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.ret != null && Number(payload.ret) !== 200) return null;

  const row = Array.isArray(payload.data) ? payload.data[0] : null;
  if (!row) return null;

  // Depth row
  const depth = parseDepthPush(row);
  if (depth) {
    const mid = (depth.bid + depth.ask) / 2;
    const lastPx = Number.isFinite(Number(last)) && Number(last) > 0 ? Number(last) : mid;
    return {
      symbol: String(clientSymbol).toUpperCase(),
      bid: depth.bid,
      ask: depth.ask,
      mid,
      last: lastPx,
      time: Math.floor(depth.ts / 1000),
    };
  }

  // Trade row — single price, no book. Both sides collapse to the traded price
  // rather than fabricating a spread.
  const trade = parseTradePush(row);
  if (trade) {
    return {
      symbol: String(clientSymbol).toUpperCase(),
      bid: trade.price,
      ask: trade.price,
      mid: trade.price,
      last: trade.price,
      time: Math.floor(trade.ts / 1000),
    };
  }

  return null;
}

export class InfowayProvider {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey || process.env.INFOWAY_API_KEY || '';
    this.restUrl = (process.env.INFOWAY_REST_URL || DEFAULT_REST_URL).replace(/\/$/, '');
    this.wsUrl = (process.env.INFOWAY_WS_URL || DEFAULT_WS_URL).replace(/\/$/, '');
    this.symbolOverrides = buildSymbolMap(process.env.INFOWAY_SYMBOL_MAP);

    this.onFailure = options.onFailure;
    this.enabled = false;
    this.manualDisconnect = false;

    /** clientSymbol -> callback */
    this.callbacks = new Map();
    /** clientSymbol -> latest normalized quote */
    this.quotes = new Map();
    /** clientSymbol -> { providerSymbol, business } */
    this.routes = new Map();
    /** business -> ws client */
    this.sockets = new Map();
    /** business -> reconnect attempt count */
    this.reconnectAttempts = new Map();

    this.maxReconnectAttempts = Number(process.env.INFOWAY_MAX_RECONNECT_ATTEMPTS || 5);
    this.reconnectBaseMs = Number(process.env.INFOWAY_RECONNECT_BASE_MS || 3000);
  }

  connect() {
    if (!this.apiKey) {
      throw new Error('apiKey is required');
    }
    // Lazy, mirroring TwelvedataProvider: sockets open on first subscriber.
    this.enabled = true;
    this.manualDisconnect = false;
    console.log('[infoway] Provider ready (WebSocket connects on first subscriber)');
  }

  // ---------------------------------------------------------------- internals

  routeFor(clientSymbol) {
    const key = String(clientSymbol).toUpperCase();
    let route = this.routes.get(key);
    if (!route) {
      route = {
        providerSymbol: toInfowaySymbol(key, this.symbolOverrides),
        business: resolveBusiness(key),
      };
      this.routes.set(key, route);
    }
    return route;
  }

  /** provider symbol + business -> the client symbols currently interested. */
  clientsFor(providerSymbol, business) {
    const out = [];
    for (const [clientSymbol, route] of this.routes) {
      if (route.providerSymbol === providerSymbol && route.business === business) {
        if (this.callbacks.has(clientSymbol)) out.push(clientSymbol);
      }
    }
    return out;
  }

  emit(clientSymbol, patch) {
    const previous = this.quotes.get(clientSymbol) || {};
    const bid = patch.bid ?? previous.bid;
    const ask = patch.ask ?? previous.ask;
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
      // A trade tick before the first depth tick cannot form a two-sided quote.
      // Hold it until depth arrives rather than emitting a half quote.
      this.quotes.set(clientSymbol, { ...previous, ...patch });
      return;
    }

    const mid = (bid + ask) / 2;
    const quote = {
      symbol: clientSymbol,
      bid,
      ask,
      mid,
      last: patch.last ?? previous.last ?? mid,
      time: patch.time ?? previous.time ?? Math.floor(Date.now() / 1000),
    };

    this.quotes.set(clientSymbol, quote);
    this.callbacks.get(clientSymbol)?.(quote);
  }

  ensureSocket(business) {
    let socket = this.sockets.get(business);
    if (socket) return socket;
    if (!this.enabled || this.manualDisconnect) return null;

    socket = startInfowayWS({
      apiKey: this.apiKey,
      business,
      baseUrl: this.wsUrl,
      onDepth: ({ symbol, bid, ask, ts }) => {
        this.reconnectAttempts.set(business, 0);
        for (const clientSymbol of this.clientsFor(symbol, business)) {
          this.emit(clientSymbol, { bid, ask, time: Math.floor(ts / 1000) });
        }
      },
      onTrade: ({ symbol, price, ts }) => {
        for (const clientSymbol of this.clientsFor(symbol, business)) {
          this.emit(clientSymbol, { last: price, time: Math.floor(ts / 1000) });
        }
      },
      onError: (error) => {
        if (this.manualDisconnect) return;
        const attempts = this.reconnectAttempts.get(business) || 0;
        if (attempts >= this.maxReconnectAttempts) this.onFailure?.(error);
      },
      onClose: () => {
        this.sockets.delete(business);
        if (this.manualDisconnect) return;
        this.scheduleReconnect(business);
      },
    });

    this.sockets.set(business, socket);
    return socket;
  }

  scheduleReconnect(business) {
    // Only reconnect while symbols on this business still have subscribers.
    const stillWanted = Array.from(this.routes.entries()).some(
      ([clientSymbol, route]) => route.business === business && this.callbacks.has(clientSymbol)
    );
    if (!stillWanted) return;

    const attempts = (this.reconnectAttempts.get(business) || 0) + 1;
    this.reconnectAttempts.set(business, attempts);

    if (attempts > this.maxReconnectAttempts) {
      console.log(`[infoway] ${business}: max reconnect attempts reached, triggering provider failover`);
      this.onFailure?.(new Error(`infoway websocket unavailable (${business})`));
      return;
    }

    // Exponential backoff, capped.
    const delay = Math.min(this.reconnectBaseMs * 2 ** (attempts - 1), 60000);
    console.log(`[infoway] ${business}: reconnecting in ${delay}ms (attempt ${attempts})`);
    setTimeout(() => {
      if (this.manualDisconnect) return;
      const socket = this.ensureSocket(business);
      if (!socket) return;
      for (const [clientSymbol, route] of this.routes) {
        if (route.business === business && this.callbacks.has(clientSymbol)) {
          socket.addSymbol(route.providerSymbol);
        }
      }
    }, delay);
  }

  // ------------------------------------------------------------------ contract

  subscribe(symbol, callback) {
    if (!symbol || !callback) return;

    const clientSymbol = String(symbol).toUpperCase();
    const { providerSymbol, business } = this.routeFor(clientSymbol);

    this.callbacks.set(clientSymbol, callback);

    const socket = this.ensureSocket(business);
    socket?.addSymbol(providerSymbol);

    // Replay the cached quote so a late subscriber is not blind until the next tick.
    const cached = this.quotes.get(clientSymbol);
    if (cached && Number.isFinite(cached.bid) && Number.isFinite(cached.ask)) {
      callback(cached);
    }
  }

  /**
   * ⚠ Infoway documents no unsubscribe message.
   *
   * The `subscribe-and-unsubscribe` section, both channel pages and every code
   * example cover subscription only, and no unsubscribe protocol code is
   * published. Sending a guessed code could desynchronise the connection, so
   * this removes the subscription locally: the callback is dropped and ticks
   * for the symbol are no longer delivered. The upstream feed continues until
   * the socket closes.
   *
   * When Infoway confirms the message, send it from infoway-ws.js
   * `removeSymbol()` — that is the only place that needs to change.
   */
  unsubscribe(symbol) {
    if (!symbol) return;

    const clientSymbol = String(symbol).toUpperCase();
    const route = this.routes.get(clientSymbol);

    this.callbacks.delete(clientSymbol);
    this.quotes.delete(clientSymbol);
    this.routes.delete(clientSymbol);

    if (!route) return;

    // Drop the upstream symbol only when no other client symbol maps to it.
    const stillUsed = this.clientsFor(route.providerSymbol, route.business).length > 0;
    if (stillUsed) return;

    const socket = this.sockets.get(route.business);
    socket?.removeSymbol(route.providerSymbol);

    // Close a socket that no longer serves anything.
    if (socket && socket.symbolCount() === 0) {
      socket.close();
      this.sockets.delete(route.business);
      this.reconnectAttempts.delete(route.business);
    }
  }

  /**
   * REST snapshot: order book first (bid/ask), falling back to last trade.
   * Used by fxincapws `/quote/:symbol`, which fxincapapi treats as the
   * authoritative settlement price.
   */
  async getQuote(symbol) {
    const clientSymbol = String(symbol || '').toUpperCase();
    if (!clientSymbol) return null;

    // Serve a fresh streamed quote instead of spending a REST call.
    const cached = this.quotes.get(clientSymbol);
    if (cached && Number.isFinite(cached.bid) && Number.isFinite(cached.ask)) {
      const ageSeconds = Date.now() / 1000 - cached.time;
      if (ageSeconds < 10) return cached;
    }

    if (!this.apiKey) return null;

    const { providerSymbol, business } = this.routeFor(clientSymbol);

    const depth = await this.fetchRest(business, 'batch_depth', providerSymbol);
    if (depth) {
      const trade = await this.fetchRest(business, 'batch_trade', providerSymbol);
      const lastPx = trade?.data?.[0]?.p;
      const quote = normalizeRestQuote(clientSymbol, depth, { last: lastPx });
      if (quote) {
        this.quotes.set(clientSymbol, quote);
        return quote;
      }
    }

    // Fallback: trade only. Yields a zero-spread quote rather than nothing.
    const trade = await this.fetchRest(business, 'batch_trade', providerSymbol);
    if (trade) {
      const quote = normalizeRestQuote(clientSymbol, trade);
      if (quote) {
        this.quotes.set(clientSymbol, quote);
        return quote;
      }
    }

    return null;
  }

  async fetchRest(business, endpoint, providerSymbol) {
    const url = `${this.restUrl}/${business}/${endpoint}/${encodeURIComponent(providerSymbol)}`;
    try {
      const { data } = await axios.get(url, {
        headers: { apiKey: this.apiKey },
        timeout: REST_TIMEOUT_MS,
      });

      if (data && data.ret != null && Number(data.ret) !== 200) {
        console.error(`[infoway] ${endpoint} error for ${providerSymbol}:`, data.msg || data.ret);
        return null;
      }
      return data;
    } catch (e) {
      // Auth failures come back as { code, message, timestamp } — a different
      // envelope from the success shape — so surface the reason rather than a
      // bare "status code 401", which is the first thing a new key hits.
      const status = e.response?.status;
      const reason = e.response?.data?.message || e.response?.data?.msg;
      if (status === 401 || status === 403) {
        console.error(
          `[infoway] ${endpoint} unauthorized for ${providerSymbol}: ${reason || 'check the Infoway API key'}`
        );
      } else {
        console.error(`[infoway] ${endpoint} fetch failed for ${providerSymbol}:`, reason || e.message);
      }
      return null;
    }
  }

  disconnect() {
    this.manualDisconnect = true;
    this.enabled = false;
    for (const socket of this.sockets.values()) {
      try {
        socket.close();
      } catch {}
    }
    this.sockets.clear();
    this.reconnectAttempts.clear();
    this.callbacks.clear();
    this.quotes.clear();
    this.routes.clear();
  }
}

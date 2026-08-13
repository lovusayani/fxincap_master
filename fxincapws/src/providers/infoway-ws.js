import WebSocket from 'ws';
import crypto from 'crypto';

/**
 * Raw Infoway WebSocket client for a single `business` channel.
 *
 * Protocol reference: https://docs.infoway.io/websocket-api/endpoints
 *   URL          wss://data.infoway.io/ws?business=<business>&apikey=<key>
 *   10000  ->    subscribe trade    { code, trace, data: { codes, includeTy } }
 *   10001  <-    subscribe ack      { code, trace, msg }
 *   10002  <-    trade push         { code, data: { s, p, t, td, v, vw } }
 *   10003  ->    subscribe depth    { code, trace, data: { codes } }
 *   10005  <-    depth push         { code, data: { s, t, a: [[px],[qty]], b: [[px],[qty]] } }
 *   10010  ->    heartbeat          { code, trace }
 *
 * Infoway exposes one endpoint per asset class ("business"), so a caller that
 * needs both forex and crypto holds two of these clients. Symbol -> business
 * routing lives in infoway.js.
 *
 * Documented limits (https://docs.infoway.io/websocket-api/heartbeat):
 *   - the server drops a connection that has not sent a heartbeat for 1 minute
 *   - all requests on one connection are capped at 60 per minute, heartbeats
 *     included, so subscribes are rate limited here.
 *
 * ⚠ Unsubscribe is NOT specified in the Infoway documentation. The
 * subscribe-and-unsubscribe section, both channel pages and every code example
 * document subscription only. No unsubscribe code is sent from here — doing so
 * would mean inventing a wire format. See infoway.js `unsubscribe()`.
 */

const HEARTBEAT_INTERVAL_MS = 30000; // docs' own examples use 30s against a 60s server timeout
const MAX_REQUESTS_PER_MINUTE = 60;

export const INFOWAY_CODES = {
  SUBSCRIBE_TRADE: 10000,
  SUBSCRIBE_TRADE_ACK: 10001,
  TRADE_PUSH: 10002,
  SUBSCRIBE_DEPTH: 10003,
  SUBSCRIBE_DEPTH_ACK: 10004,
  DEPTH_PUSH: 10005,
  HEARTBEAT: 10010,
};

function newTrace() {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * @param {Object}   params
 * @param {string}   params.apiKey
 * @param {string}   params.business      'common' | 'crypto' | 'stock' | ...
 * @param {string}   params.baseUrl       e.g. wss://data.infoway.io/ws
 * @param {(u:{symbol:string,bid:number,ask:number,ts:number})=>void} params.onDepth
 * @param {(u:{symbol:string,price:number,ts:number})=>void}          params.onTrade
 * @param {(e:Error)=>void} params.onError
 * @param {()=>void}        params.onClose
 */
export function startInfowayWS({
  apiKey,
  business,
  baseUrl,
  onDepth,
  onTrade,
  onError,
  onClose,
  onSubscribeStatus,
}) {
  if (!apiKey) throw new Error('apiKey is required');
  if (!business) throw new Error('business is required');

  const url = `${baseUrl}?business=${encodeURIComponent(business)}&apikey=${encodeURIComponent(apiKey)}`;
  const ws = new WebSocket(url);

  /** Symbols this connection should be subscribed to (provider-side codes). */
  const live = new Set();
  let connected = false;
  let manualClose = false;
  let heartbeatTimer = null;

  // Sliding-window limiter for the documented 60 requests/minute cap.
  let windowStart = Date.now();
  let windowCount = 0;

  function canSend() {
    const now = Date.now();
    if (now - windowStart >= 60000) {
      windowStart = now;
      windowCount = 0;
    }
    return windowCount < MAX_REQUESTS_PER_MINUTE;
  }

  function send(payload) {
    if (ws.readyState !== WebSocket.OPEN) return false;
    if (!canSend()) {
      console.warn(`[infoway-ws:${business}] request rate limit reached, dropping`, payload.code);
      return false;
    }
    try {
      ws.send(JSON.stringify(payload));
      windowCount += 1;
      return true;
    } catch (e) {
      console.warn(`[infoway-ws:${business}] send failed:`, e.message);
      return false;
    }
  }

  function subscribeCodes(codes) {
    if (!codes) return;
    // Depth carries bid/ask, which this platform requires for settlement.
    send({ code: INFOWAY_CODES.SUBSCRIBE_DEPTH, trace: newTrace(), data: { codes } });
    // Trade carries the executed price, used for `last`.
    send({ code: INFOWAY_CODES.SUBSCRIBE_TRADE, trace: newTrace(), data: { codes, includeTy: false } });
  }

  function sendHeartbeat() {
    send({ code: INFOWAY_CODES.HEARTBEAT, trace: newTrace() });
  }

  ws.on('open', () => {
    connected = true;
    console.log(`[infoway-ws:${business}] connected`);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    // `codes` accepts a comma-separated list, so a reconnect resubscribes
    // everything in one request pair rather than one pair per symbol.
    if (live.size > 0) subscribeCodes(Array.from(live).join(','));
  });

  ws.on('message', (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch (e) {
      console.warn(`[infoway-ws:${business}] parse error:`, e.message);
      return;
    }

    const { code, data } = payload || {};

    if (code === INFOWAY_CODES.SUBSCRIBE_TRADE_ACK || code === INFOWAY_CODES.SUBSCRIBE_DEPTH_ACK) {
      onSubscribeStatus?.(payload);
      return;
    }

    if (code === INFOWAY_CODES.DEPTH_PUSH && data) {
      const parsed = parseDepthPush(data);
      if (parsed) onDepth?.(parsed);
      return;
    }

    if (code === INFOWAY_CODES.TRADE_PUSH && data) {
      const parsed = parseTradePush(data);
      if (parsed) onTrade?.(parsed);
    }
  });

  ws.on('error', (err) => {
    connected = false;
    console.error(`[infoway-ws:${business}] error:`, err.message);
    onError?.(err);
  });

  ws.on('close', () => {
    connected = false;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    console.log(`[infoway-ws:${business}] closed`);
    if (!manualClose) onClose?.();
  });

  return {
    business,
    addSymbol: (code) => {
      if (!code || live.has(code)) return;
      live.add(code);
      if (connected) subscribeCodes(code);
    },
    /**
     * Local removal only — Infoway documents no unsubscribe message.
     * The upstream feed keeps streaming; infoway.js stops delivering it.
     */
    removeSymbol: (code) => {
      if (!code) return;
      live.delete(code);
    },
    hasSymbol: (code) => live.has(code),
    symbolCount: () => live.size,
    isConnected: () => connected,
    close: () => {
      manualClose = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      try {
        ws.close();
      } catch {}
    },
    socket: ws,
  };
}

/**
 * Depth push (10005) -> best bid/ask.
 * `a` and `b` are [[prices...],[volumes...]]; index 0 of the price array is the
 * top of book. Exported for tests.
 */
export function parseDepthPush(data) {
  const symbol = data?.s;
  if (!symbol) return null;

  const ask = Number(data?.a?.[0]?.[0]);
  const bid = Number(data?.b?.[0]?.[0]);
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) return null;

  const ts = Number(data?.t);
  return {
    symbol: String(symbol),
    bid,
    ask,
    ts: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
  };
}

/** Trade push (10002) -> executed price. Exported for tests. */
export function parseTradePush(data) {
  const symbol = data?.s;
  if (!symbol) return null;

  const price = Number(data?.p);
  if (!Number.isFinite(price) || price <= 0) return null;

  const ts = Number(data?.t);
  return {
    symbol: String(symbol),
    price,
    ts: Number.isFinite(ts) && ts > 0 ? ts : Date.now(),
  };
}

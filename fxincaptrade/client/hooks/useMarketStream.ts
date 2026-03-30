import { useCallback, useEffect, useRef, useState } from "react";

export interface PriceTick {
  bid: number;
  ask: number;
  spread: number;
  change: string; // e.g. "+0.23%"
  timestamp: number;
}

function defaultWsBase(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:4040`;
  }
  return "ws://localhost:4040";
}

// Staging/production: same host as trade app, port 4040 (fxincap-ws). Override with VITE_WS_STREAM_URL (no trailing slash).
const WS_BASE: string =
  ((import.meta as any).env?.VITE_WS_STREAM_URL as string | undefined)?.trim() || defaultWsBase();

// HTTP base derived from WebSocket base (used for REST quote fallback)
const HTTP_BASE = WS_BASE.replace(/^ws/, "http");

/**
 * Subscribes to the fxincapws price stream and returns a live prices map.
 * Reconnects automatically on disconnect.
 */
export function useMarketStream(symbols: string[]): Record<string, PriceTick> {
  const [prices, setPrices] = useState<Record<string, PriceTick>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const subscribedRef = useRef<Set<string>>(new Set());
  const sessionOpenBid = useRef<Record<string, number>>({}); // first-seen bid per symbol this session

  // Keep a stable ref to the current symbols list so callbacks don't stale-close
  const symbolsRef = useRef<string[]>(symbols);
  useEffect(() => {
    symbolsRef.current = symbols;
  });

  // Fetch a quote via HTTP and update state (fallback when WS quote is slow/missing)
  const fetchHttpQuote = useCallback((sym: string) => {
    fetch(`${HTTP_BASE}/quote/${sym}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!mountedRef.current || !data || data.bid == null) return;
        const bid = Number(data.bid);
        const ask = Number(data.ask ?? data.bid);
        const spread = +(ask - bid).toFixed(5);
        if (!sessionOpenBid.current[sym]) sessionOpenBid.current[sym] = bid;
        const openBid = sessionOpenBid.current[sym];
        const pct = openBid ? ((bid - openBid) / openBid) * 100 : 0;
        const change = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
        setPrices((prev) => {
          // Only update if we still have no price for this symbol
          if (prev[sym]) return prev;
          return { ...prev, [sym]: { bid, ask, spread, change, timestamp: Number(data.time ?? 0) || Date.now() } };
        });
      })
      .catch(() => {/* ignore */});
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(`${WS_BASE}/stream`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      subscribedRef.current.clear();
      for (const s of symbolsRef.current) {
        ws.send(JSON.stringify({ action: "subscribe", symbol: s }));
        subscribedRef.current.add(s);
      }
      // HTTP fallback: after 2s, fetch quotes for any symbols still missing prices
      setTimeout(() => {
        if (!mountedRef.current) return;
        setPrices((prev) => {
          for (const s of symbolsRef.current) {
            if (!prev[s]) fetchHttpQuote(s);
          }
          return prev; // no state change here, fetchHttpQuote updates async
        });
      }, 2000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data as string);
        // Accept both 'last' (stream tick) and 'quote' (snapshot sent on subscribe)
        if ((msg.type !== "last" && msg.type !== "quote") || !msg.symbol || msg.bid == null) return;

        const sym = String(msg.symbol);
        const bid = Number(msg.bid);
        const ask = Number(msg.ask ?? msg.bid);
        const spread = +(ask - bid).toFixed(5);

        // Session-relative change %
        if (!sessionOpenBid.current[sym]) sessionOpenBid.current[sym] = bid;
        const openBid = sessionOpenBid.current[sym];
        const pct = openBid ? ((bid - openBid) / openBid) * 100 : 0;
        const change = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";

        setPrices((prev) => ({
          ...prev,
          [sym]: {
            bid,
            ask,
            spread,
            change,
            timestamp: Number(msg.time ?? 0) || Date.now(),
          },
        }));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      subscribedRef.current.clear();
      if (mountedRef.current) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [fetchHttpQuote]);

  // Sync subscriptions when the symbols list changes while connected
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const next = new Set(symbols);

    for (const s of subscribedRef.current) {
      if (!next.has(s)) {
        ws.send(JSON.stringify({ action: "unsubscribe", symbol: s }));
        subscribedRef.current.delete(s);
      }
    }
    for (const s of next) {
      if (!subscribedRef.current.has(s)) {
        ws.send(JSON.stringify({ action: "subscribe", symbol: s }));
        subscribedRef.current.add(s);
      }
    }
  }, [symbols]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return prices;
}

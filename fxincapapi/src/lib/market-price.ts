/**
 * Server-side authoritative market prices.
 *
 * Before this module existed, the browser was the effective source of truth for
 * every price that moved money: `entryPrice` on open, `closePrice` on close, and
 * `current_price` (written by an unauthenticated endpoint) which the auto-close
 * worker settled against.
 *
 *   Provider → fxincapws → fxincapapi → server-side price → P&L / SL / TP
 *
 * Everything that values a position must obtain its price here. A client-supplied
 * price is, at most, a hint to validate against — never the settlement price.
 *
 * See docs/PNL_ENGINE.md and docs/MARKET_DATA_ARCHITECTURE.md.
 */

import { WS_QUOTE_BASE_URL, PRICE_MAX_AGE_MS } from "./env.js";

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  /** Epoch milliseconds at which this quote was received by the API. */
  receivedAt: number;
}

/** Short-lived cache so a sweep over many trades issues one fetch per symbol. */
const cache = new Map<string, Quote>();

/** In-flight requests, so concurrent callers for one symbol share a single fetch. */
const inflight = new Map<string, Promise<Quote | null>>();

const CACHE_TTL_MS = 1500;
const FETCH_TIMEOUT_MS = 4000;

function toPositiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse the fxincapws quote envelope.
 *
 * fxincapws responds `{ success, quote: { bid, ask, ... }, provider }`. The bid
 * lives one level below the envelope; reading `data.bid` yields undefined, which
 * is exactly the defect that stopped server-side SL/TP from ever executing.
 * See docs/TRADING_ENGINE.md §9.
 */
export function parseQuoteEnvelope(symbol: string, payload: unknown): Quote | null {
  if (!payload || typeof payload !== "object") return null;

  const envelope = payload as Record<string, any>;
  // Tolerate a bare quote object as well as the documented envelope.
  const body = envelope.quote && typeof envelope.quote === "object" ? envelope.quote : envelope;

  const bid = toPositiveNumber(body.bid);
  // A provider may publish only one side; fall back through ask → last → mid.
  const ask = toPositiveNumber(body.ask) ?? bid;
  const single = toPositiveNumber(body.last) ?? toPositiveNumber(body.mid);

  const resolvedBid = bid ?? single;
  const resolvedAsk = ask ?? single;

  if (resolvedBid == null || resolvedAsk == null) return null;

  return {
    symbol,
    bid: resolvedBid,
    ask: resolvedAsk,
    mid: (resolvedBid + resolvedAsk) / 2,
    receivedAt: Date.now(),
  };
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const url = `${WS_QUOTE_BASE_URL}/quote/${encodeURIComponent(symbol)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return parseQuoteEnvelope(symbol, data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Current server-side quote for a symbol, or null when the market-data service
 * cannot supply one. Callers that move money MUST treat null as "refuse the
 * operation" rather than substituting a client value or a stale price.
 */
export async function getServerQuote(symbol: string): Promise<Quote | null> {
  const key = String(symbol || "").trim().toUpperCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.receivedAt < CACHE_TTL_MS) {
    return cached;
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const request = fetchQuote(key)
    .then((quote) => {
      if (quote) cache.set(key, quote);
      return quote;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

/**
 * Executable price for a side.
 *   opening  BUY  → ask,  opening  SELL → bid
 *   closing  BUY  → bid,  closing  SELL → ask
 * This mirrors the existing SL/TP convention in trading-engine.ts, which already
 * closed BUY at bid and SELL at ask.
 */
export function executablePrice(quote: Quote, side: string, action: "OPEN" | "CLOSE"): number {
  const isBuy = String(side || "").toUpperCase() === "BUY";
  if (action === "OPEN") return isBuy ? quote.ask : quote.bid;
  return isBuy ? quote.bid : quote.ask;
}

/** True when a quote is fresh enough to settle against. */
export function isFresh(quote: Quote): boolean {
  return Date.now() - quote.receivedAt <= PRICE_MAX_AGE_MS;
}

/**
 * Settlement price for a symbol/side, or null when no fresh server price exists.
 * The single entry point used by trade open, trade close and the workers.
 */
export async function getSettlementPrice(
  symbol: string,
  side: string,
  action: "OPEN" | "CLOSE"
): Promise<number | null> {
  const quote = await getServerQuote(symbol);
  if (!quote || !isFresh(quote)) return null;
  return executablePrice(quote, side, action);
}

/** Test/diagnostic helper — clears the in-memory cache. */
export function resetPriceCache(): void {
  cache.clear();
  inflight.clear();
}

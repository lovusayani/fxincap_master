/**
 * Broker spread markup.
 *
 * The provider gives the raw market bid/ask. Admins configure an additional
 * markup per symbol (or one 'ALL' fallback) from the Forex Charges page; this
 * widens the quote symmetrically — half the configured pips off the bid, half
 * onto the ask — so the mid price is unchanged and only the spread grows.
 *
 * Applied here, at the quote boundary, rather than in the browser: every
 * consumer (REST /quote, the WebSocket stream, and fxincapapi's settlement
 * pricing) reads through this module, so a client cannot bypass the markup and
 * the displayed price cannot drift from the settled one.
 *
 * Config is written by fxincapapi (see lib/symbol-spreads.ts) into the shared
 * symbol_spreads table and cached here briefly, since it is read per tick.
 */

import { getPool } from './db.js';

/** Reserved symbol used as the fallback for anything without its own row. */
export const ALL_SYMBOLS_KEY = 'ALL';

/** Config is admin-edited and rarely changes; a short TTL keeps ticks cheap. */
const CACHE_TTL_MS = 30_000;

let cache = { at: 0, bySymbol: new Map() };
let warnedMissingTable = false;

/**
 * Pip size per symbol. Mirrors fxincaptrade/client/lib/trading.ts getPipSize so
 * "1 pip" means the same thing in the admin panel and the order ticket.
 */
export function getPipSize(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (s.includes('JPY')) return 0.01;
  if (s.startsWith('XAU')) return 0.01;
  if (s.startsWith('XAG')) return 0.001;
  if (s.includes('BTC') || s.includes('ETH')) return 0.01;
  return 0.0001;
}

/** Reads the table, tolerating its absence before the migration is applied. */
async function loadConfig() {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT symbol, spread_pips, enabled FROM symbol_spreads WHERE enabled = TRUE`,
    );
    const bySymbol = new Map();
    for (const row of rows) {
      const pips = Number(row.spread_pips);
      if (Number.isFinite(pips) && pips > 0) {
        bySymbol.set(String(row.symbol).toUpperCase(), pips);
      }
    }
    return bySymbol;
  } catch (error) {
    // The table may not exist yet. Quote as-is rather than failing the request,
    // but say so once so it is not silently ignored forever.
    if (!warnedMissingTable) {
      warnedMissingTable = true;
      console.warn('[spread] symbol_spreads unavailable, quoting provider prices unmarked:', error.message);
    }
    return new Map();
  }
}

async function getConfig() {
  const now = Date.now();
  if (now - cache.at < CACHE_TTL_MS) return cache.bySymbol;
  const bySymbol = await loadConfig();
  cache = { at: now, bySymbol };
  return bySymbol;
}

/** Drops the cache so an admin edit takes effect immediately. */
export function invalidateSpreadCache() {
  cache = { at: 0, bySymbol: new Map() };
}

/** Resolved markup in pips for a symbol: its own row, else the ALL fallback. */
export async function getSpreadPips(symbol) {
  const key = String(symbol || '').toUpperCase();
  const config = await getConfig();
  if (config.has(key)) return config.get(key);
  return config.get(ALL_SYMBOLS_KEY) ?? 0;
}

/**
 * Widens a quote's bid/ask by the configured markup, leaving the mid unchanged.
 * Returns the quote untouched when no markup applies, when either side is
 * missing, or when the markup would invert the quote.
 */
export async function applySpread(quote, symbolOverride) {
  if (!quote) return quote;

  const symbol = String(symbolOverride ?? quote.symbol ?? '').toUpperCase();
  const pips = await getSpreadPips(symbol);
  if (!pips || pips <= 0) return quote;

  const bid = Number(quote.bid);
  const ask = Number(quote.ask);
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
    // Trade-only ticks collapse both sides to one price; widening them would
    // invent a book that the provider never reported.
    return quote;
  }

  const half = (pips * getPipSize(symbol)) / 2;
  const nextBid = bid - half;
  const nextAsk = ask + half;

  // A markup wide enough to push the bid to or below zero is a misconfiguration;
  // quoting it would be worse than ignoring it.
  if (nextBid <= 0 || nextAsk <= nextBid) return quote;

  const decimals = symbol.includes('JPY') || nextAsk > 100 ? 3 : 6;
  const round = (value) => Number(value.toFixed(decimals));

  return {
    ...quote,
    bid: round(nextBid),
    ask: round(nextAsk),
    mid: round((nextBid + nextAsk) / 2),
    // Marks the quote as broker-adjusted so downstream consumers and support
    // can tell it apart from the raw provider price.
    spreadPips: pips,
  };
}

/**
 * Server-side price synchronisation and valuation worker.
 *
 * Replaces the client-driven `POST /api/trades/price-update` path as the way
 * open positions are valued:
 *
 *   fxincapws → getServerQuote() → trades.current_price / pnl / pnl_percentage
 *                               → user_accounts.equity
 *
 * Two defects this closes (see docs/PNL_ENGINE.md §3 and §5):
 *
 *  - `trades.pnl` was never written for open trades. The only writer of
 *    `current_price` also wrote `pnl_percentage` but not `pnl`, and
 *    `updateTradeRealtime()` — which wrote both — was never called. Any consumer
 *    reading `trades.pnl` for an open position read a stale default.
 *
 *  - `user_accounts.equity` was only ever set at registration and by admin edits.
 *    It never incorporated floating P&L, so it drifted permanently out of step
 *    with `balance` after the first closed trade.
 *
 * Both are now recomputed from server-side prices on a fixed interval.
 */

import { query, getConnection } from "./database.js";
import { calculatePnL } from "./trading-engine.js";
import { getServerQuote, isFresh, executablePrice } from "./market-price.js";

export interface PriceSyncResult {
  symbols: number;
  tradesValued: number;
  accountsRevalued: number;
  symbolsUnavailable: number;
}

interface OpenTradeRow {
  id: number;
  account_id: string | null;
  user_id: string;
  symbol: string;
  side: string;
  volume: number;
  entry_price: number;
}

/**
 * Value every open trade at the current server price, persist `current_price`,
 * `pnl` and `pnl_percentage`, then recompute `equity` for each affected account.
 *
 * Equity uses the conventional definition already implied by the schema and the
 * account model: `equity = balance + Σ unrealized P&L of that account's open
 * trades`. No new trading rule is introduced — realized settlement, margin and
 * balance handling are untouched.
 */
export async function syncOpenTradePrices(): Promise<PriceSyncResult> {
  const rows = (await query(
    `SELECT id, account_id, user_id, symbol, side, volume, entry_price
       FROM trades
      WHERE status = 'OPEN'`
  )) as unknown as OpenTradeRow[];

  const openTrades = Array.isArray(rows) ? rows : [];
  if (openTrades.length === 0) {
    return { symbols: 0, tradesValued: 0, accountsRevalued: 0, symbolsUnavailable: 0 };
  }

  // One quote per distinct symbol, not one per trade.
  const symbols = Array.from(
    new Set(openTrades.map((t) => String(t.symbol || "").trim().toUpperCase()).filter(Boolean))
  );

  const quotes = new Map<string, { bid: number; ask: number }>();
  let symbolsUnavailable = 0;

  for (const symbol of symbols) {
    const quote = await getServerQuote(symbol);
    if (quote && isFresh(quote)) {
      quotes.set(symbol, { bid: quote.bid, ask: quote.ask });
    } else {
      symbolsUnavailable += 1;
    }
  }

  if (quotes.size === 0) {
    return {
      symbols: symbols.length,
      tradesValued: 0,
      accountsRevalued: 0,
      symbolsUnavailable,
    };
  }

  // accountId → running sum of unrealized P&L
  const floatingByAccount = new Map<string, number>();
  let tradesValued = 0;

  const conn = await getConnection();
  try {
    for (const trade of openTrades) {
      const symbol = String(trade.symbol || "").trim().toUpperCase();
      const quote = quotes.get(symbol);
      if (!quote) continue;

      // Value at the price the position would actually close at.
      const markPrice = executablePrice(
        { symbol, bid: quote.bid, ask: quote.ask, mid: (quote.bid + quote.ask) / 2, receivedAt: Date.now() },
        String(trade.side || ""),
        "CLOSE"
      );

      const entryPrice = Number(trade.entry_price);
      const volume = Number(trade.volume);
      if (!Number.isFinite(entryPrice) || !Number.isFinite(volume)) continue;

      const { pnl, pnlPercentage } = await calculatePnL(
        String(trade.side || ""),
        symbol,
        volume,
        entryPrice,
        markPrice
      );

      await conn.query(
        `UPDATE trades
            SET current_price = $1,
                pnl = $2,
                pnl_percentage = $3
          WHERE id = $4 AND status = 'OPEN'`,
        [markPrice, pnl, pnlPercentage, trade.id]
      );

      tradesValued += 1;

      if (trade.account_id) {
        const key = String(trade.account_id);
        floatingByAccount.set(key, (floatingByAccount.get(key) || 0) + pnl);
      }
    }

    // equity = balance + floating P&L, per account that has open trades.
    let accountsRevalued = 0;
    for (const [accountId, floating] of floatingByAccount) {
      const result = await conn.query(
        `UPDATE user_accounts
            SET equity = ROUND((balance + $1)::numeric, 2)
          WHERE id = $2`,
        [floating, accountId]
      );
      accountsRevalued += result.rowCount ?? 0;
    }

    return {
      symbols: symbols.length,
      tradesValued,
      accountsRevalued,
      symbolsUnavailable,
    };
  } finally {
    conn.release();
  }
}

/**
 * Bring `equity` back in line with `balance` for accounts that no longer hold
 * open trades. Without this, an account keeps the last floating figure forever
 * once its final position closes.
 */
export async function reconcileFlatAccountEquity(): Promise<number> {
  const result = await query(
    `UPDATE user_accounts ua
        SET equity = ua.balance
      WHERE ua.equity IS DISTINCT FROM ua.balance
        AND NOT EXISTS (
          SELECT 1 FROM trades t
           WHERE t.account_id = ua.id AND t.status = 'OPEN'
        )`
  );
  return Array.isArray(result) ? result.length : 0;
}

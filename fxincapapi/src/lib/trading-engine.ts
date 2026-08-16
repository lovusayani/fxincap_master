import { query } from "./database.js";
import { WS_QUOTE_BASE_URL } from "./env.js";
import { getServerQuote, isFresh, executablePrice } from "./market-price.js";

export interface Trade {
  id: number;
  user_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  entry_price: number;
  current_price: number | null;
  take_profit: number | null;
  stop_loss: number | null;
  leverage: number;
  locked_balance: number;
  pnl: number;
  pnl_percentage: number;
  status: "OPEN" | "CLOSED" | "CANCELLED";
  close_price: number | null;
  final_pnl: number | null;
  opened_at: Date;
  closed_at: Date | null;
  closing_reason: string | null;
}

function getContractSize(symbol: string): number {
  const upper = String(symbol || "").toUpperCase();

  if (upper.includes("BTC")) {
    return 1;
  }

  if (upper.includes("ETH")) {
    return 1;
  }

  if (upper.startsWith("XAU")) {
    return 100;
  }

  if (upper.startsWith("XAG")) {
    return 5000;
  }

  return 100000;
}

function getTradeNotional(symbol: string, volume: number, price: number): number {
  return getContractSize(symbol) * volume * price;
}

/**
 * Required margin, or `null` when the inputs are not a valid trade.
 *
 * This previously returned `0` for malformed input, which silently produced a
 * zero-margin (free) trade instead of a rejection. Callers must treat `null` as
 * "reject the operation".
 */
export function getRequiredMargin(
  symbol: string,
  volume: number,
  entryPrice: number,
  leverage: number
): number | null {
  if (
    !Number.isFinite(volume) ||
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(leverage) ||
    volume <= 0 ||
    entryPrice <= 0 ||
    leverage <= 0
  ) {
    return null;
  }

  return Number((getTradeNotional(symbol, volume, entryPrice) / leverage).toFixed(2));
}

/**
 * Resolves the account a trade/balance operation should apply to: the user's
 * currently active account within their currently selected trading mode.
 * Centralizing this avoids the previous bug where balance updates matched
 * every account row for a user_id (demo and real together) since neither
 * mode nor "which account" was filtered.
 */
export async function resolveActiveAccountId(userId: string, conn?: any): Promise<string | null> {
  const runQuery = async (sql: string, params: any[]): Promise<any[]> => {
    if (conn) {
      const r = await conn.query(sql, params);
      return r.rows;
    }
    return (await query(sql, params)) as any[];
  };

  const profileRows = await runQuery(
    `SELECT selected_trading_mode FROM user_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const mode =
    Array.isArray(profileRows) && profileRows.length > 0
      ? profileRows[0].selected_trading_mode || "demo"
      : "demo";

  const acctRows = await runQuery(
    `SELECT id FROM user_accounts WHERE user_id = $1 AND trading_mode = $2 AND is_active = true AND account_status = 'active' LIMIT 1`,
    [userId, mode]
  );
  return Array.isArray(acctRows) && acctRows.length > 0 ? String(acctRows[0].id) : null;
}

export async function validateTradeOpen(
  userId: string,
  symbol: string,
  side: string,
  volume: number,
  entryPrice: number,
  leverage: number,
  stopLoss: number | null,
  takeProfit: number | null
): Promise<{ valid: boolean; error?: string; availableBalance?: number }> {
  try {
    if (!symbol || !side || !volume || !entryPrice) {
      return { valid: false, error: "Missing required fields" };
    }

    if (!["BUY", "SELL"].includes(side)) {
      return { valid: false, error: "Invalid side. Must be BUY or SELL" };
    }

    if (volume <= 0 || entryPrice <= 0) {
      return { valid: false, error: "Volume and entry price must be positive" };
    }

    // Upper bound raised from 100 to 2000: the order ticket offers ratios up to
    // 1:2000, and the old cap rejected every trade above 1:100 server-side.
    if (leverage < 1 || leverage > 2000) {
      return { valid: false, error: "Leverage must be between 1 and 2000" };
    }

    if (side === "BUY") {
      if (stopLoss && stopLoss >= entryPrice) {
        return { valid: false, error: "Stop loss must be below entry price for BUY" };
      }
      if (takeProfit && takeProfit <= entryPrice) {
        return { valid: false, error: "Take profit must be above entry price for BUY" };
      }
    } else {
      if (stopLoss && stopLoss <= entryPrice) {
        return { valid: false, error: "Stop loss must be above entry price for SELL" };
      }
      if (takeProfit && takeProfit >= entryPrice) {
        return { valid: false, error: "Take profit must be below entry price for SELL" };
      }
    }

    const balanceResult = await getAvailableBalance(userId);
    if (!balanceResult.success) {
      return { valid: false, error: balanceResult.error || "No active trading account found. Please select an account in Settings." };
    }
    const availableBalance = balanceResult.availableBalance || 0;
    const requiredBalance = getRequiredMargin(symbol, volume, entryPrice, leverage);

    if (requiredBalance == null) {
      return { valid: false, error: "Invalid volume, price or leverage for margin calculation" };
    }

    if (availableBalance < requiredBalance) {
      return {
        valid: false,
        error: `Insufficient balance. Required: ${requiredBalance.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`,
        availableBalance,
      };
    }

    return { valid: true, availableBalance };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation error",
    };
  }
}

export async function createTrade(
  userId: string,
  symbol: string,
  side: "BUY" | "SELL",
  volume: number,
  entryPrice: number,
  takeProfit: number | null,
  stopLoss: number | null,
  leverage: number
): Promise<{ success: boolean; tradeId?: number; error?: string }> {
  const conn = await (await import("./database.js")).getConnection();

  try {
    await conn.query("BEGIN");

    const lockedBalance = getRequiredMargin(symbol, volume, entryPrice, leverage);
    if (lockedBalance == null) {
      await conn.query("ROLLBACK");
      return { success: false, error: "Invalid volume, price or leverage for margin calculation" };
    }

    const accountId = await resolveActiveAccountId(userId, conn);
    if (!accountId) {
      await conn.query("ROLLBACK");
      return { success: false, error: "No active trading account found. Please select an account in Settings." };
    }

    const tradeResult = await conn.query(
      `INSERT INTO trades (user_id, account_id, symbol, side, volume, entry_price, take_profit, stop_loss, leverage, locked_balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN') RETURNING id`,
      [userId, accountId, symbol, side, volume, entryPrice, takeProfit, stopLoss, leverage, lockedBalance]
    );

    const tradeId = tradeResult.rows[0]?.id;
    if (!tradeId) {
      await conn.query("ROLLBACK");
      return { success: false, error: "Failed to create trade record" };
    }

    const lockResult = await lockBalance(accountId, lockedBalance, conn);
    if (!lockResult.success) {
      await conn.query("ROLLBACK");
      return { success: false, error: lockResult.error };
    }

    await conn.query("COMMIT");
    await logTradeAction(tradeId, userId, "TRADE_OPENED", null, { volume, entryPrice, leverage });
    return { success: true, tradeId };
  } catch (error) {
    await conn.query("ROLLBACK").catch(() => {});
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create trade",
    };
  } finally {
    conn.release();
  }
}

export async function calculatePnL(
  side: string,
  symbol: string,
  volume: number,
  entryPrice: number,
  currentPrice: number
): Promise<{ pnl: number; pnlPercentage: number }> {
  const contractSize = getContractSize(symbol);
  const signedMove = side === "BUY"
    ? currentPrice - entryPrice
    : entryPrice - currentPrice;
  const pnl = Number((signedMove * contractSize * volume).toFixed(2));
  const notional = getTradeNotional(symbol, volume, entryPrice);
  const pnlPercentage = notional > 0
    ? Number(((pnl / notional) * 100).toFixed(4))
    : 0;

  return { pnl, pnlPercentage };
}

export async function lockBalance(
  accountId: string,
  amount: number,
  conn?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = conn || (await (await import("./database.js")).getConnection());

    const results = await connection.query(
      `UPDATE user_accounts
         SET locked_balance = locked_balance + $1,
             available_balance = GREATEST(0, GREATEST(available_balance, balance - locked_balance) - $2)
       WHERE id = $3
         AND GREATEST(available_balance, balance - locked_balance) >= $4`,
      [amount, amount, accountId, amount]
    );

    const updated = results.rowCount ?? 0;

    if (updated === 0) {
      return { success: false, error: "Insufficient balance to lock" };
    }

    if (!conn) connection.release();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to lock balance",
    };
  }
}

export async function unlockBalance(
  accountId: string,
  amount: number,
  conn?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = conn || (await (await import("./database.js")).getConnection());

    await connection.query(
      `UPDATE user_accounts
       SET locked_balance = GREATEST(0, locked_balance - $1),
           available_balance = GREATEST(0, available_balance + $2)
       WHERE id = $3`,
      [amount, amount, accountId]
    );

    if (!conn) connection.release();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unlock balance",
    };
  }
}

export async function closeTrade(
  tradeId: number,
  closePrice: number,
  reason: string = "MANUAL_CLOSE"
): Promise<{ success: boolean; finalPnL?: number; error?: string }> {
  const conn = await (await import("./database.js")).getConnection();

  try {
    await conn.query("BEGIN");

    const tradesResult = await conn.query(
      `SELECT user_id, account_id, symbol, side, volume, entry_price, locked_balance, leverage, opened_at
         FROM trades
        WHERE id = $1 AND status = 'OPEN'`,
      [tradeId]
    );
    const trades = tradesResult.rows;

    if (!Array.isArray(trades) || trades.length === 0) {
      await conn.query("ROLLBACK");
      return { success: false, error: "Trade not found or already closed" };
    }

    const trade = trades[0] as any;

    const { pnl: finalPnL } = await calculatePnL(
      trade.side,
      trade.symbol,
      trade.volume,
      trade.entry_price,
      closePrice
    );

    await conn.query(
      `UPDATE trades SET status = 'CLOSED', close_price = $1, final_pnl = $2, closed_at = NOW(), closing_reason = $3
       WHERE id = $4`,
      [closePrice, finalPnL, reason, tradeId]
    );

    const entryPrice = Number(trade.entry_price) || 0;
    const volume = Number(trade.volume) || 0;
    const notional = getTradeNotional(trade.symbol, volume, entryPrice);
    const profitPct = notional > 0 ? (finalPnL / notional) * 100 : 0;

    await conn.query(
      `INSERT INTO trade_history (
         user_id, symbol, side, volume, open_price, close_price, profit,
         profit_percentage, leverage, open_time, close_time, duration_seconds, closed_reason
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, NOW(), EXTRACT(EPOCH FROM (NOW() - $10::timestamp))::int, $11
       )`,
      [
        trade.user_id,
        trade.symbol,
        trade.side,
        trade.volume,
        trade.entry_price,
        closePrice,
        finalPnL,
        profitPct,
        trade.leverage,
        trade.opened_at,
        reason,
      ]
    );

    // Legacy trades opened before account tagging existed have no account_id;
    // fall back to the user's current active account rather than no-op.
    const settlementAccountId: string | null =
      trade.account_id || (await resolveActiveAccountId(trade.user_id, conn));

    if (!settlementAccountId) {
      await conn.query("ROLLBACK");
      return { success: false, error: "No active trading account found to settle this trade against" };
    }

    const unlockResult = await unlockBalance(settlementAccountId, trade.locked_balance, conn);
    if (!unlockResult.success) {
      await conn.query("ROLLBACK");
      return { success: false, error: unlockResult.error };
    }

    await conn.query(
      `UPDATE user_accounts SET balance = balance + $1, available_balance = available_balance + $2 WHERE id = $3`,
      [finalPnL, finalPnL, settlementAccountId]
    );

    await conn.query("COMMIT");
    await logTradeAction(tradeId, trade.user_id, "TRADE_CLOSED", null, { closePrice, finalPnL });
    return { success: true, finalPnL };
  } catch (error) {
    await conn.query("ROLLBACK").catch(() => {});
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to close trade",
    };
  } finally {
    conn.release();
  }
}

export async function updateTradeRealtime(
  tradeId: number,
  currentPrice: number
): Promise<{ success: boolean; pnl?: number; pnlPercentage?: number; error?: string }> {
  try {
    const trades = await query(`SELECT symbol, side, volume, entry_price FROM trades WHERE id = $1`, [tradeId]);

    if (!Array.isArray(trades) || trades.length === 0) {
      return { success: false, error: "Trade not found" };
    }

    const trade = trades[0] as any;
    const { pnl, pnlPercentage } = await calculatePnL(
      trade.side,
      trade.symbol,
      trade.volume,
      trade.entry_price,
      currentPrice
    );

    await query(`UPDATE trades SET current_price = $1, pnl = $2, pnl_percentage = $3 WHERE id = $4`, [
      currentPrice,
      pnl,
      pnlPercentage,
      tradeId,
    ]);

    return { success: true, pnl, pnlPercentage };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update trade",
    };
  }
}

function tradePriceLevel(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Evaluate SL/TP using executable prices: close BUY at bid, close SELL at ask.
 * (A single "mid" price misses real fill prices and can skip valid triggers.)
 */
export async function checkAndExecuteStopLossTakeProfit(
  tradeId: number,
  bid: number,
  ask: number
): Promise<{ executed: boolean; reason?: string }> {
  try {
    const trades = await query(
      `SELECT side, stop_loss, take_profit FROM trades WHERE id = $1 AND status = 'OPEN'`,
      [tradeId]
    );

    if (!Array.isArray(trades) || trades.length === 0) {
      return { executed: false };
    }

    const trade = trades[0] as any;
    const side = String(trade.side || "").toUpperCase();
    const sl = tradePriceLevel(trade.stop_loss);
    const tp = tradePriceLevel(trade.take_profit);

    const bidPx = Number(bid);
    const askPx = Number(ask);
    const exitBuy = Number.isFinite(bidPx) && bidPx > 0 ? bidPx : 0;
    const exitSell = Number.isFinite(askPx) && askPx > 0 ? askPx : exitBuy;

    if (side === "BUY") {
      const p = exitBuy;
      if (!p) return { executed: false };
      if (sl != null && p <= sl) {
        const closeResult = await closeTrade(tradeId, p, "STOP_LOSS_HIT");
        return { executed: closeResult.success, reason: "STOP_LOSS_HIT" };
      }
      if (tp != null && p >= tp) {
        const closeResult = await closeTrade(tradeId, p, "TAKE_PROFIT_HIT");
        return { executed: closeResult.success, reason: "TAKE_PROFIT_HIT" };
      }
    } else if (side === "SELL") {
      const p = exitSell;
      if (!p) return { executed: false };
      if (sl != null && p >= sl) {
        const closeResult = await closeTrade(tradeId, p, "STOP_LOSS_HIT");
        return { executed: closeResult.success, reason: "STOP_LOSS_HIT" };
      }
      if (tp != null && p <= tp) {
        const closeResult = await closeTrade(tradeId, p, "TAKE_PROFIT_HIT");
        return { executed: closeResult.success, reason: "TAKE_PROFIT_HIT" };
      }
    }

    return { executed: false };
  } catch (error) {
    return { executed: false, reason: error instanceof Error ? error.message : "Error" };
  }
}

/** Base URL for fxincapws HTTP quotes (`GET /quote/:symbol`), default port 4040. */
export function getWsQuoteBaseUrl(): string {
  return WS_QUOTE_BASE_URL;
}

/**
 * Poll live quotes and close any open trades whose SL/TP is touched.
 * Run on an interval from the API process (requires fxincapws reachable at WS_QUOTE_BASE_URL).
 *
 * Prices come from getServerQuote(), which reads the fxincapws envelope
 * correctly. The previous implementation read `data.bid` from a payload shaped
 * `{ success, quote: { bid, ask }, provider }`, so every symbol produced NaN and
 * was skipped — server-side SL/TP never executed.
 */
export async function processAllStopLossTakeProfit(): Promise<{ checked: number; closed: number }> {
  const rows = await query(
    `SELECT id, symbol FROM trades
     WHERE status = 'OPEN' AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL)`
  );
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    return { checked: 0, closed: 0 };
  }

  const bySymbol = new Map<string, number[]>();
  for (const t of list) {
    const row = t as any;
    const sym = String(row.symbol || "").trim();
    const id = Number(row.id);
    if (!sym || !Number.isFinite(id)) continue;
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(id);
  }

  let checked = 0;
  let closed = 0;

  for (const [symbol, tradeIds] of bySymbol) {
    const quote = await getServerQuote(symbol);
    // No fresh server price: skip. Never fabricate a level that closes a trade.
    if (!quote || !isFresh(quote)) continue;

    for (const tradeId of tradeIds) {
      checked += 1;
      const r = await checkAndExecuteStopLossTakeProfit(tradeId, quote.bid, quote.ask);
      if (r.executed) closed += 1;
    }
  }

  return { checked, closed };
}

export async function autoCloseExpiredTrades(timeoutMinutes: number): Promise<number> {
  try {
    const safeTimeout = Number.isFinite(timeoutMinutes) && timeoutMinutes > 0 ? timeoutMinutes : 2;
    const timeoutSeconds = Math.floor(safeTimeout * 60);

    const rows = await query(
      `SELECT id, symbol, side, current_price, entry_price
       FROM trades
       WHERE status = 'OPEN'
         AND EXTRACT(EPOCH FROM (NOW() - opened_at)) >= $1`,
      [timeoutSeconds]
    );

    const expiredTrades = Array.isArray(rows) ? rows : [];
    if (expiredTrades.length === 0) {
      return 0;
    }

    let closedCount = 0;

    for (const trade of expiredTrades as any[]) {
      // Settle at the live server price. Previously this fell back to
      // `entry_price` when `current_price` was NULL, closing the position for
      // exactly zero P&L — a fabricated settlement, not a market one.
      const quote = await getServerQuote(String(trade.symbol || ""));
      let closePrice: number | null = null;

      if (quote && isFresh(quote)) {
        closePrice = executablePrice(quote, String(trade.side || ""), "CLOSE");
      } else {
        // Fall back only to a server-maintained current_price, never to entry_price.
        const stored = Number(trade.current_price);
        if (Number.isFinite(stored) && stored > 0) closePrice = stored;
      }

      if (closePrice == null || !Number.isFinite(closePrice) || closePrice <= 0) {
        console.warn(
          `[TRADE] Auto-close skipped for trade ${trade.id} (${trade.symbol}): no server price available`
        );
        continue;
      }

      const closeResult = await closeTrade(trade.id, closePrice, "FORCED_TIMEOUT");
      if (closeResult.success) {
        closedCount += 1;
      }
    }

    return closedCount;
  } catch (error) {
    console.error("Failed to auto-close expired trades:", error);
    return 0;
  }
}

export async function logTradeAction(
  tradeId: number,
  userId: string,
  action: string,
  oldValue: any,
  newValue: any,
  conn?: any
): Promise<void> {
  try {
    const connection = conn || (await (await import("./database.js")).getConnection());

    await connection.query(
      `CREATE TABLE IF NOT EXISTS trade_logs (
         id BIGSERIAL PRIMARY KEY,
         trade_id BIGINT NOT NULL,
         user_id UUID NOT NULL,
         action VARCHAR(100) NOT NULL,
         old_value JSONB,
         new_value JSONB,
         created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
       )`
    );

    await connection.query(
      `INSERT INTO trade_logs (trade_id, user_id, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [tradeId, userId, action, JSON.stringify(oldValue), JSON.stringify(newValue)]
    );

    if (!conn) connection.release();
  } catch (error) {
    console.error("Failed to log trade action:", error);
  }
}

export async function getAvailableBalance(
  userId: string
): Promise<{ success: boolean; availableBalance?: number; error?: string }> {
  try {
    const accountId = await resolveActiveAccountId(userId);
    if (!accountId) {
      return { success: false, error: "Account not found" };
    }

    const results = await query(
      `SELECT balance, locked_balance, available_balance FROM user_accounts WHERE id = $1`,
      [accountId]
    );

    if (!Array.isArray(results) || results.length === 0) {
      return { success: false, error: "Account not found" };
    }

    const account = results[0] as any;
    const balance = Number(account.balance) || 0;
    const locked = Number(account.locked_balance) || 0;
    const storedAvailable = Number(account.available_balance) || 0;
    const effectiveAvailable = Math.max(0, Math.max(storedAvailable, balance - locked));

    return { success: true, availableBalance: effectiveAvailable };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get balance",
    };
  }
}

export async function getAccountInfo(
  userId: string
): Promise<{
  success: boolean;
  balance?: number;
  lockedBalance?: number;
  availableBalance?: number;
  totalPnL?: number;
  error?: string;
}> {
  try {
    const accountId = await resolveActiveAccountId(userId);
    if (!accountId) {
      return { success: false, error: "Account not found" };
    }

    const [accountResults, tradeResults] = await Promise.all([
      query(
        `SELECT balance, available_balance, locked_balance FROM user_accounts WHERE id = $1`,
        [accountId]
      ),
      query(
        `SELECT COALESCE(SUM(final_pnl), 0) as total_pnl FROM trades WHERE user_id = $1 AND status = 'CLOSED'`,
        [userId]
      ),
    ]);

    if (!Array.isArray(accountResults) || accountResults.length === 0) {
      return { success: false, error: "Account not found" };
    }

    const account = accountResults[0] as any;
    const totalPnL = Number((tradeResults as any)[0]?.total_pnl) || 0;
    const balance = Number(account.balance) || 0;
    const lockedBalance = Number(account.locked_balance) || 0;
    const storedAvailable = Number(account.available_balance) || 0;
    const availableBalance = Math.max(0, Math.max(storedAvailable, balance - lockedBalance));

    return { success: true, balance, lockedBalance, availableBalance, totalPnL };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get account info",
    };
  }
}

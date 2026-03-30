import { query } from "./database.js";

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

export function getRequiredMargin(
  symbol: string,
  volume: number,
  entryPrice: number,
  leverage: number
): number {
  if (!Number.isFinite(volume) || !Number.isFinite(entryPrice) || !Number.isFinite(leverage) || volume <= 0 || entryPrice <= 0 || leverage <= 0) {
    return 0;
  }

  return Number((getTradeNotional(symbol, volume, entryPrice) / leverage).toFixed(2));
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

    if (leverage < 1 || leverage > 100) {
      return { valid: false, error: "Leverage must be between 1 and 100" };
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
    const availableBalance = balanceResult.availableBalance || 0;
    const requiredBalance = getRequiredMargin(symbol, volume, entryPrice, leverage);

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

    const tradeResult = await conn.query(
      `INSERT INTO trades (user_id, symbol, side, volume, entry_price, take_profit, stop_loss, leverage, locked_balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN') RETURNING id`,
      [userId, symbol, side, volume, entryPrice, takeProfit, stopLoss, leverage, lockedBalance]
    );

    const tradeId = tradeResult.rows[0]?.id;
    if (!tradeId) {
      await conn.query("ROLLBACK");
      return { success: false, error: "Failed to create trade record" };
    }

    const lockResult = await lockBalance(userId, lockedBalance, conn);
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
  userId: string,
  amount: number,
  conn?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = conn || (await (await import("./database.js")).getConnection());

    const results = await connection.query(
      `UPDATE user_accounts
         SET locked_balance = locked_balance + $1,
             available_balance = GREATEST(0, GREATEST(available_balance, balance - locked_balance) - $2)
       WHERE user_id = $3
         AND GREATEST(available_balance, balance - locked_balance) >= $4`,
      [amount, amount, userId, amount]
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
  userId: string,
  amount: number,
  conn?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const connection = conn || (await (await import("./database.js")).getConnection());

    await connection.query(
      `UPDATE user_accounts
       SET locked_balance = GREATEST(0, locked_balance - $1),
           available_balance = GREATEST(0, available_balance + $2)
       WHERE user_id = $3`,
      [amount, amount, userId]
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
      `SELECT user_id, symbol, side, volume, entry_price, locked_balance, leverage, opened_at
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

    const unlockResult = await unlockBalance(trade.user_id, trade.locked_balance, conn);
    if (!unlockResult.success) {
      await conn.query("ROLLBACK");
      return { success: false, error: unlockResult.error };
    }

    await conn.query(
      `UPDATE user_accounts SET balance = balance + $1, available_balance = available_balance + $2 WHERE user_id = $3`,
      [finalPnL, finalPnL, trade.user_id]
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

export async function checkAndExecuteStopLossTakeProfit(
  tradeId: number,
  currentPrice: number
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

    if (trade.stop_loss) {
      if (trade.side === "BUY" && currentPrice <= trade.stop_loss) {
        const closeResult = await closeTrade(tradeId, currentPrice, "STOP_LOSS_HIT");
        return { executed: closeResult.success, reason: "STOP_LOSS_HIT" };
      }
      if (trade.side === "SELL" && currentPrice >= trade.stop_loss) {
        const closeResult = await closeTrade(tradeId, currentPrice, "STOP_LOSS_HIT");
        return { executed: closeResult.success, reason: "STOP_LOSS_HIT" };
      }
    }

    if (trade.take_profit) {
      if (trade.side === "BUY" && currentPrice >= trade.take_profit) {
        const closeResult = await closeTrade(tradeId, currentPrice, "TAKE_PROFIT_HIT");
        return { executed: closeResult.success, reason: "TAKE_PROFIT_HIT" };
      }
      if (trade.side === "SELL" && currentPrice <= trade.take_profit) {
        const closeResult = await closeTrade(tradeId, currentPrice, "TAKE_PROFIT_HIT");
        return { executed: closeResult.success, reason: "TAKE_PROFIT_HIT" };
      }
    }

    return { executed: false };
  } catch (error) {
    return { executed: false, reason: error instanceof Error ? error.message : "Error" };
  }
}

export async function autoCloseExpiredTrades(timeoutMinutes: number): Promise<number> {
  try {
    const safeTimeout = Number.isFinite(timeoutMinutes) && timeoutMinutes > 0 ? timeoutMinutes : 2;
    const timeoutSeconds = Math.floor(safeTimeout * 60);

    const rows = await query(
      `SELECT id, current_price, entry_price
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
      const closePrice = Number(trade.current_price ?? trade.entry_price);
      if (!Number.isFinite(closePrice) || closePrice <= 0) {
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
    const results = await query(
      `SELECT balance, locked_balance, available_balance FROM user_accounts WHERE user_id = $1`,
      [userId]
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
    const accountResults = await query(
      `SELECT balance, available_balance, locked_balance FROM user_accounts WHERE user_id = $1`,
      [userId]
    );

    if (!Array.isArray(accountResults) || accountResults.length === 0) {
      return { success: false, error: "Account not found" };
    }

    const account = accountResults[0] as any;

    const tradeResults = await query(
      `SELECT COALESCE(SUM(final_pnl), 0) as total_pnl FROM trades WHERE user_id = $1 AND status = 'CLOSED'`,
      [userId]
    );

    const totalPnL = Number((tradeResults as any)[0]?.total_pnl) || 0;
    const balance = Number(account.balance) || 0;
    const lockedBalance = Number(account.locked_balance) || 0;
    const storedAvailable = Number(account.available_balance) || 0;
    const availableBalance = Math.max(0, Math.max(storedAvailable, balance - lockedBalance));

    return {
      success: true,
      balance,
      lockedBalance,
      availableBalance,
      totalPnL,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get account info",
    };
  }
}

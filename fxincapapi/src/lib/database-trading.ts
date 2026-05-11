import { query, getConnection } from "./database.js";

export async function getOpenTradesByUser(userId: string): Promise<any[]> {
  try {
    const trades = await query(
      `SELECT id, symbol, side, volume, entry_price, current_price, take_profit, stop_loss,
              leverage, pnl, pnl_percentage, locked_balance, opened_at, status
       FROM trades WHERE user_id = $1 AND status = 'OPEN' ORDER BY opened_at DESC`,
      [userId]
    );
    return Array.isArray(trades) ? trades : [];
  } catch (error) {
    console.error("Failed to get open trades:", error);
    return [];
  }
}

export async function getTradeById(tradeId: number): Promise<any | null> {
  try {
    const trades = await query(
      `SELECT id, user_id, symbol, side, volume, entry_price, current_price, take_profit,
              stop_loss, leverage, locked_balance, pnl, pnl_percentage, status,
              close_price, final_pnl, opened_at, closed_at, closing_reason
       FROM trades WHERE id = $1`,
      [tradeId]
    );
    return Array.isArray(trades) && trades.length > 0 ? trades[0] : null;
  } catch (error) {
    console.error("Failed to get trade:", error);
    return null;
  }
}

export async function getTradeHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  try {
    const safeLimit = Math.max(1, Math.min(500, Number.isFinite(limit) ? Math.floor(limit) : 50));
    const safeOffset = Math.max(0, Number.isFinite(offset) ? Math.floor(offset) : 0);

    const trades = await query(
      `SELECT id, symbol, side, volume, entry_price, close_price, final_pnl, pnl_percentage,
              leverage, opened_at, closed_at, closing_reason, status
       FROM trades
       WHERE user_id = $1 AND status IN ('CLOSED', 'CANCELLED')
       ORDER BY closed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, safeOffset]
    );
    return Array.isArray(trades) ? trades : [];
  } catch (error) {
    console.error("Failed to get trade history:", error);
    return [];
  }
}

export async function getTradeStatistics(userId: string): Promise<{
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
}> {
  try {
    const stats = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_count,
        SUM(CASE WHEN status = 'CLOSED' AND final_pnl > 0 THEN 1 ELSE 0 END) as win_count,
        SUM(CASE WHEN status = 'CLOSED' THEN final_pnl ELSE 0 END) as total_pnl,
        AVG(CASE WHEN status = 'CLOSED' AND final_pnl > 0 THEN final_pnl END) as avg_win,
        AVG(CASE WHEN status = 'CLOSED' AND final_pnl < 0 THEN final_pnl END) as avg_loss
       FROM trades WHERE user_id = $1`,
      [userId]
    );

    const result = (stats as any)[0];
    const closedCount = Number(result.closed_count) || 0;

    return {
      totalTrades: Number(result.total) || 0,
      openTrades: Number(result.open_count) || 0,
      closedTrades: closedCount,
      winRate: closedCount > 0 ? ((Number(result.win_count) || 0) / closedCount) * 100 : 0,
      totalPnL: Number(result.total_pnl) || 0,
      avgWin: Number(result.avg_win) || 0,
      avgLoss: Number(result.avg_loss) || 0,
    };
  } catch (error) {
    console.error("Failed to get trade statistics:", error);
    return { totalTrades: 0, openTrades: 0, closedTrades: 0, winRate: 0, totalPnL: 0, avgWin: 0, avgLoss: 0 };
  }
}

// Uses getConnection() so callers get the real rowCount, not result.rows.
export async function updateTradeCurrentPrice(
  tradeId: number,
  currentPrice: number
): Promise<boolean> {
  const client = await getConnection();
  try {
    const result = await client.query(
      `UPDATE trades
       SET current_price = $1,
           pnl_percentage = CASE
             WHEN side = 'BUY' THEN (($1 - entry_price) / entry_price) * 100
             ELSE ((entry_price - $1) / entry_price) * 100
           END
       WHERE id = $2`,
      [currentPrice, tradeId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Failed to update trade current price:", error);
    return false;
  } finally {
    client.release();
  }
}

export async function updateTradeStatus(
  tradeId: number,
  status: string,
  closingReason?: string
): Promise<boolean> {
  const client = await getConnection();
  try {
    let sql: string;
    let params: any[];
    if (closingReason) {
      sql = `UPDATE trades SET status = $1, closing_reason = $2, closed_at = NOW() WHERE id = $3`;
      params = [status, closingReason, tradeId];
    } else {
      sql = `UPDATE trades SET status = $1 WHERE id = $2`;
      params = [status, tradeId];
    }
    const result = await client.query(sql, params);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Failed to update trade status:", error);
    return false;
  } finally {
    client.release();
  }
}

export async function insertTradeLog(
  tradeId: number,
  userId: string,
  action: string,
  oldValue: any,
  newValue: any
): Promise<boolean> {
  const client = await getConnection();
  try {
    const result = await client.query(
      `INSERT INTO trade_logs (trade_id, user_id, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [tradeId, userId, action, JSON.stringify(oldValue), JSON.stringify(newValue)]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Failed to insert trade log:", error);
    return false;
  } finally {
    client.release();
  }
}

export async function updateUserBalance(
  userId: string,
  amount: number,
  type: "ADD" | "SUBTRACT" = "ADD"
): Promise<boolean> {
  const client = await getConnection();
  try {
    const operator = type === "ADD" ? "+" : "-";
    const result = await client.query(
      `UPDATE user_accounts SET available_balance = available_balance ${operator} $1 WHERE user_id = $2`,
      [amount, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Failed to update user balance:", error);
    return false;
  } finally {
    client.release();
  }
}

export async function updateLockedBalance(
  userId: string,
  amount: number,
  type: "ADD" | "SUBTRACT" = "ADD"
): Promise<boolean> {
  const client = await getConnection();
  try {
    const operator = type === "ADD" ? "+" : "-";
    const result = await client.query(
      `UPDATE user_accounts SET locked_balance = locked_balance ${operator} $1 WHERE user_id = $2`,
      [amount, userId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Failed to update locked balance:", error);
    return false;
  } finally {
    client.release();
  }
}

export async function getUserAccountBalance(userId: string): Promise<{
  available: number;
  locked: number;
  total: number;
}> {
  try {
    const accounts = await query(
      `SELECT available_balance, locked_balance FROM user_accounts WHERE user_id = $1`,
      [userId]
    );

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { available: 0, locked: 0, total: 0 };
    }

    const account = accounts[0] as any;
    const available = Number(account.available_balance) || 0;
    const locked = Number(account.locked_balance) || 0;
    return { available, locked, total: available + locked };
  } catch (error) {
    console.error("Failed to get user account balance:", error);
    return { available: 0, locked: 0, total: 0 };
  }
}

export async function getAccountWithPositions(userId: string): Promise<any> {
  try {
    const [accounts, positions] = await Promise.all([
      query(
        `SELECT balance, available_balance, locked_balance, created_at
         FROM user_accounts WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT id, symbol, side, volume, entry_price, current_price, pnl, pnl_percentage, status
         FROM trades WHERE user_id = $1 AND status = 'OPEN'`,
        [userId]
      ),
    ]);

    if (!Array.isArray(accounts) || accounts.length === 0) return null;

    return {
      ...accounts[0],
      positions: Array.isArray(positions) ? positions : [],
    };
  } catch (error) {
    console.error("Failed to get account with positions:", error);
    return null;
  }
}

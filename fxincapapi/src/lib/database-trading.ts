import { query } from "./database.js";

export async function getOpenTradesByUser(userId: string): Promise<any[]> {
  try {
    const trades = await query(
      `SELECT * FROM trades WHERE user_id = ? AND status = 'OPEN' ORDER BY opened_at DESC`,
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
    const trades = await query(`SELECT * FROM trades WHERE id = ?`, [tradeId]);
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
      `SELECT * FROM trades WHERE user_id = ? AND status IN ('CLOSED', 'CANCELLED') 
       ORDER BY closed_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [userId]
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
       FROM trades WHERE user_id = ?`,
      [userId]
    );

    const result = (stats as any)[0];
    const closedCount = result.closed_count || 0;

    return {
      totalTrades: result.total || 0,
      openTrades: result.open_count || 0,
      closedTrades: closedCount,
      winRate: closedCount > 0 ? ((result.win_count || 0) / closedCount) * 100 : 0,
      totalPnL: result.total_pnl || 0,
      avgWin: result.avg_win || 0,
      avgLoss: result.avg_loss || 0,
    };
  } catch (error) {
    console.error("Failed to get trade statistics:", error);
    return {
      totalTrades: 0,
      openTrades: 0,
      closedTrades: 0,
      winRate: 0,
      totalPnL: 0,
      avgWin: 0,
      avgLoss: 0,
    };
  }
}

export async function updateTradeCurrentPrice(
  tradeId: number,
  currentPrice: number
): Promise<boolean> {
  try {
    const result = await query(
      `UPDATE trades SET current_price = ?, pnl_percentage = 
        CASE 
          WHEN side = 'BUY' THEN ((? - entry_price) / entry_price) * 100
          ELSE ((entry_price - ?) / entry_price) * 100
        END
       WHERE id = ?`,
      [currentPrice, currentPrice, currentPrice, tradeId]
    );
    return (result as any).affectedRows > 0;
  } catch (error) {
    console.error("Failed to update trade current price:", error);
    return false;
  }
}

export async function updateTradeStatus(
  tradeId: number,
  status: string,
  closingReason?: string
): Promise<boolean> {
  try {
    const updates = [status, tradeId];
    let query_str = `UPDATE trades SET status = ?`;

    if (closingReason) {
      query_str += `, closing_reason = ?, closed_at = NOW()`;
      updates.splice(1, 0, closingReason);
    }

    query_str += ` WHERE id = ?`;

    const result = await query(query_str, updates);
    return (result as any).affectedRows > 0;
  } catch (error) {
    console.error("Failed to update trade status:", error);
    return false;
  }
}

export async function insertTradeLog(
  tradeId: number,
  userId: string,
  action: string,
  oldValue: any,
  newValue: any
): Promise<boolean> {
  try {
    const result = await query(
      `INSERT INTO trade_logs (trade_id, user_id, action, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [tradeId, userId, action, JSON.stringify(oldValue), JSON.stringify(newValue)]
    );
    return (result as any).affectedRows > 0;
  } catch (error) {
    console.error("Failed to insert trade log:", error);
    return false;
  }
}

export async function updateUserBalance(
  userId: string,
  amount: number,
  type: "ADD" | "SUBTRACT" = "ADD"
): Promise<boolean> {
  try {
    const operator = type === "ADD" ? "+" : "-";
    const result = await query(
      `UPDATE user_accounts SET available_balance = available_balance ${operator} ? 
       WHERE user_id = ?`,
      [amount, userId]
    );
    return (result as any).affectedRows > 0;
  } catch (error) {
    console.error("Failed to update user balance:", error);
    return false;
  }
}

export async function updateLockedBalance(
  userId: string,
  amount: number,
  type: "ADD" | "SUBTRACT" = "ADD"
): Promise<boolean> {
  try {
    const operator = type === "ADD" ? "+" : "-";
    const result = await query(
      `UPDATE user_accounts SET locked_balance = locked_balance ${operator} ? 
       WHERE user_id = ?`,
      [amount, userId]
    );
    return (result as any).affectedRows > 0;
  } catch (error) {
    console.error("Failed to update locked balance:", error);
    return false;
  }
}

export async function getUserAccountBalance(userId: string): Promise<{
  available: number;
  locked: number;
  total: number;
}> {
  try {
    const accounts = await query(
      `SELECT available_balance, locked_balance FROM user_accounts WHERE user_id = ?`,
      [userId]
    );

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { available: 0, locked: 0, total: 0 };
    }

    const account = accounts[0] as any;
    return {
      available: account.available_balance || 0,
      locked: account.locked_balance || 0,
      total: (account.available_balance || 0) + (account.locked_balance || 0),
    };
  } catch (error) {
    console.error("Failed to get user account balance:", error);
    return { available: 0, locked: 0, total: 0 };
  }
}

export async function getAccountWithPositions(userId: string): Promise<any> {
  try {
    const accounts = await query(
      `SELECT * FROM user_accounts WHERE user_id = ?`,
      [userId]
    );

    const positions = await query(
      `SELECT id, symbol, side, volume, entry_price, current_price, pnl, pnl_percentage, status 
       FROM trades WHERE user_id = ? AND status = 'OPEN'`,
      [userId]
    );

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return null;
    }

    return {
      ...accounts[0],
      positions: Array.isArray(positions) ? positions : [],
    };
  } catch (error) {
    console.error("Failed to get account with positions:", error);
    return null;
  }
}


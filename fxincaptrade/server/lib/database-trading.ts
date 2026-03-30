import { pool } from '../../shared/database';

/**
 * Get all open trades for a user
 */
export async function getOpenTradesByUser(userId: number): Promise<any[]> {
  try {
    const [trades] = await pool.execute(
      `SELECT id, user_id, symbol, side, volume, entry_price, current_price, take_profit, stop_loss, 
              leverage, locked_balance, pnl, pnl_percentage, status, opened_at
       FROM trades WHERE user_id = ? AND status = 'OPEN' ORDER BY opened_at DESC`,
      [userId]
    );

    return (trades as any[]).map((trade) => ({
      trade_id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      volume: trade.volume,
      entry_price: parseFloat(trade.entry_price),
      current_price: parseFloat(trade.current_price),
      pnl: parseFloat(trade.pnl || 0),
      pnl_percentage: parseFloat(trade.pnl_percentage || 0),
      take_profit: parseFloat(trade.take_profit),
      stop_loss: parseFloat(trade.stop_loss),
      leverage: trade.leverage,
      locked_balance: parseFloat(trade.locked_balance),
      status: trade.status,
      opened_at: trade.opened_at,
    }));
  } catch (error) {
    console.error('Failed to get open trades:', error);
    return [];
  }
}

/**
 * Get a specific trade by ID
 */
export async function getTradeById(tradeId: number): Promise<any> {
  try {
    const [trades] = await pool.execute(
      `SELECT * FROM trades WHERE id = ?`,
      [tradeId]
    );

    const trade = (trades as any)[0];
    if (!trade) return null;

    return {
      trade_id: trade.id,
      user_id: trade.user_id,
      symbol: trade.symbol,
      side: trade.side,
      volume: trade.volume,
      entry_price: parseFloat(trade.entry_price),
      current_price: parseFloat(trade.current_price),
      pnl: parseFloat(trade.pnl || 0),
      pnl_percentage: parseFloat(trade.pnl_percentage || 0),
      take_profit: parseFloat(trade.take_profit),
      stop_loss: parseFloat(trade.stop_loss),
      leverage: trade.leverage,
      locked_balance: parseFloat(trade.locked_balance),
      close_price: trade.close_price ? parseFloat(trade.close_price) : null,
      final_pnl: trade.final_pnl ? parseFloat(trade.final_pnl) : null,
      status: trade.status,
      opened_at: trade.opened_at,
      closed_at: trade.closed_at,
      closing_reason: trade.closing_reason,
    };
  } catch (error) {
    console.error('Failed to get trade:', error);
    return null;
  }
}

/**
 * Get trade history for a user (closed/cancelled trades)
 */
export async function getTradeHistory(userId: number, limit: number = 50): Promise<any[]> {
  try {
    const [trades] = await pool.execute(
      `SELECT id, user_id, symbol, side, volume, entry_price, close_price, final_pnl, 
              status, opened_at, closed_at, closing_reason,
              TIMESTAMPDIFF(MINUTE, opened_at, closed_at) as duration_minutes
       FROM trades WHERE user_id = ? AND status IN ('CLOSED', 'CANCELLED') 
       ORDER BY closed_at DESC LIMIT ?`,
      [userId, limit]
    );

    return (trades as any[]).map((trade) => ({
      trade_id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      volume: trade.volume,
      entry_price: parseFloat(trade.entry_price),
      close_price: parseFloat(trade.close_price),
      final_pnl: parseFloat(trade.final_pnl || 0),
      final_pnl_percentage: ((parseFloat(trade.close_price) - parseFloat(trade.entry_price)) / parseFloat(trade.entry_price) * 100).toFixed(2),
      duration_minutes: trade.duration_minutes || 0,
      status: trade.status,
      opened_at: trade.opened_at,
      closed_at: trade.closed_at,
      closing_reason: trade.closing_reason,
    }));
  } catch (error) {
    console.error('Failed to get trade history:', error);
    return [];
  }
}

/**
 * Get trade statistics for a user
 */
export async function getTradeStatistics(userId: number): Promise<any> {
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_trades,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_trades,
        COUNT(CASE WHEN status = 'CLOSED' AND final_pnl > 0 THEN 1 END) as winning_trades,
        COUNT(CASE WHEN status = 'CLOSED' AND final_pnl < 0 THEN 1 END) as losing_trades,
        COALESCE(SUM(CASE WHEN status = 'CLOSED' THEN final_pnl ELSE 0 END), 0) as total_profit,
        COALESCE(SUM(CASE WHEN status = 'OPEN' THEN pnl ELSE 0 END), 0) as unrealized_pnl
       FROM trades WHERE user_id = ?`,
      [userId]
    );

    const data = (stats as any)[0];
    const totalTrades = data.closed_trades || 0;
    const winRate = totalTrades > 0 ? ((data.winning_trades || 0) / totalTrades * 100).toFixed(2) : '0.00';

    return {
      open_trades: data.open_trades,
      closed_trades: data.closed_trades,
      winning_trades: data.winning_trades,
      losing_trades: data.losing_trades,
      total_profit: parseFloat(data.total_profit),
      unrealized_pnl: parseFloat(data.unrealized_pnl),
      win_rate: parseFloat(winRate),
    };
  } catch (error) {
    console.error('Failed to get trade statistics:', error);
    return {
      open_trades: 0,
      closed_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      total_profit: 0,
      unrealized_pnl: 0,
      win_rate: 0,
    };
  }
}

/**
 * Update trade current price
 */
export async function updateTradeCurrentPrice(tradeId: number, currentPrice: number): Promise<void> {
  try {
    await pool.execute(
      `UPDATE trades SET current_price = ? WHERE id = ?`,
      [currentPrice, tradeId]
    );
  } catch (error) {
    console.error('Failed to update trade price:', error);
  }
}

/**
 * Update trade status
 */
export async function updateTradeStatus(tradeId: number, status: string): Promise<void> {
  try {
    await pool.execute(
      `UPDATE trades SET status = ? WHERE id = ?`,
      [status, tradeId]
    );
  } catch (error) {
    console.error('Failed to update trade status:', error);
  }
}

/**
 * Insert trade log
 */
export async function insertTradeLog(
  tradeId: number,
  userId: number,
  action: string,
  oldValue?: any,
  newValue?: any
): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO trade_logs (trade_id, user_id, action, old_value, new_value) VALUES (?, ?, ?, ?, ?)`,
      [tradeId, userId, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]
    );
  } catch (error) {
    console.error('Failed to insert trade log:', error);
  }
}

/**
 * Update user balance
 */
export async function updateUserBalance(userId: number, newBalance: number): Promise<void> {
  try {
    await pool.execute(
      `UPDATE user_accounts SET balance = ? WHERE user_id = ?`,
      [newBalance, userId]
    );
  } catch (error) {
    console.error('Failed to update user balance:', error);
  }
}

/**
 * Update locked balance
 */
export async function updateLockedBalance(userId: number, delta: number): Promise<void> {
  try {
    await pool.execute(
      `UPDATE user_accounts SET locked_balance = locked_balance + ? WHERE user_id = ?`,
      [delta, userId]
    );
  } catch (error) {
    console.error('Failed to update locked balance:', error);
  }
}

/**
 * Get user account balance details
 */
export async function getUserAccountBalance(userId: number): Promise<any> {
  try {
    const [accounts] = await pool.execute(
      `SELECT id, user_id, balance, equity, margin_free, locked_balance FROM user_accounts WHERE user_id = ?`,
      [userId]
    );

    const account = (accounts as any)[0];
    if (!account) return null;

    const availableBalance = account.balance - (account.locked_balance || 0);

    return {
      total_balance: parseFloat(account.balance),
      locked_balance: parseFloat(account.locked_balance || 0),
      available_balance: Number(availableBalance),
      equity: parseFloat(account.equity),
      margin_free: parseFloat(account.margin_free),
    };
  } catch (error) {
    console.error('Failed to get account balance:', error);
    return null;
  }
}

/**
 * Get account with open positions data
 */
export async function getAccountWithPositions(userId: number): Promise<any> {
  try {
    const accountData = await getUserAccountBalance(userId);
    const openTrades = await getOpenTradesByUser(userId);
    const stats = await getTradeStatistics(userId);

    if (!accountData) return null;

    const unrealizedPnL = openTrades.reduce((sum, trade) => sum + trade.pnl, 0);

    return {
      ...accountData,
      open_trades: openTrades.length,
      unrealized_pnl: unrealizedPnL,
      total_pnl: stats.total_profit + unrealizedPnL,
      positions: openTrades,
      stats,
    };
  } catch (error) {
    console.error('Failed to get account with positions:', error);
    return null;
  }
}

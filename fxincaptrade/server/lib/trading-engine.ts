import { pool } from '../../shared/database';
import { getCurrentPrice } from './price-service';

/**
 * Trade validation and creation
 */
export async function validateTradeOpen(
  userId: number,
  symbol: string,
  volume: number,
  leverage: number,
  entryPrice: number
): Promise<{ valid: boolean; error?: string; requiredBalance?: number }> {
  try {
    const availableBalance = await getAvailableBalance(userId);
    const requiredBalance = (volume * entryPrice) / leverage;

    if (availableBalance < requiredBalance) {
      return {
        valid: false,
        error: `Insufficient balance. Required: $${requiredBalance.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`,
        requiredBalance,
      };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Validation failed: ' + (error as Error).message };
  }
}

/**
 * Create a new trade
 */
export async function createTrade(
  userId: number,
  symbol: string,
  side: 'BUY' | 'SELL',
  volume: number,
  leverage: number,
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): Promise<{ tradeId: number; lockedBalance: number }> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const lockedBalance = (volume * entryPrice) / leverage;

    // Insert new trade
    const [result] = await connection.execute(
      `INSERT INTO trades (user_id, symbol, side, volume, entry_price, current_price, take_profit, stop_loss, leverage, locked_balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [userId, symbol, side, volume, entryPrice, entryPrice, takeProfit, stopLoss, leverage, lockedBalance]
    );

    const tradeId = (result as any).insertId;

    // Lock balance
    await connection.execute(
      `UPDATE user_accounts SET locked_balance = locked_balance + ?, available_balance = balance - (locked_balance + ?) 
       WHERE user_id = ?`,
      [lockedBalance, lockedBalance, userId]
    );

    // Log action
    await connection.execute(
      `INSERT INTO trade_logs (trade_id, user_id, action, new_value)
       VALUES (?, ?, 'TRADE_OPENED', ?)`,
      [tradeId, userId, JSON.stringify({ symbol, side, volume, entryPrice, lockedBalance })]
    );

    await connection.commit();

    return { tradeId, lockedBalance };
  } catch (error) {
    await connection.rollback();
    throw new Error('Failed to create trade: ' + (error as Error).message);
  } finally {
    connection.release();
  }
}

/**
 * Calculate real-time PnL
 */
export function calculatePnL(
  side: 'BUY' | 'SELL',
  entryPrice: number,
  currentPrice: number,
  volume: number
): { pnl: number; pnlPercentage: number } {
  let pnl = 0;

  if (side === 'BUY') {
    pnl = (currentPrice - entryPrice) * volume;
  } else {
    pnl = (entryPrice - currentPrice) * volume;
  }

  const pnlPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;

  return {
    pnl: parseFloat(pnl.toFixed(2)),
    pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
  };
}

/**
 * Lock balance for open trade
 */
export async function lockBalance(userId: number, amount: number): Promise<void> {
  try {
    await pool.execute(
      `UPDATE user_accounts SET locked_balance = locked_balance + ?, available_balance = balance - (locked_balance + ?) 
       WHERE user_id = ?`,
      [amount, amount, userId]
    );
  } catch (error) {
    throw new Error('Failed to lock balance: ' + (error as Error).message);
  }
}

/**
 * Unlock balance when trade closes
 */
export async function unlockBalance(userId: number, amount: number): Promise<void> {
  try {
    await pool.execute(
      `UPDATE user_accounts SET locked_balance = locked_balance - ?, available_balance = balance - (locked_balance - ?) 
       WHERE user_id = ?`,
      [amount, amount, userId]
    );
  } catch (error) {
    throw new Error('Failed to unlock balance: ' + (error as Error).message);
  }
}

/**
 * Close a trade and settle PnL
 */
export async function closeTrade(
  tradeId: number,
  closePrice: number,
  reason: 'USER_CLOSE' | 'STOP_LOSS' | 'TAKE_PROFIT'
): Promise<{ finalPnL: number; newBalance: number }> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get trade details
    const [trades] = await connection.execute(
      `SELECT * FROM trades WHERE id = ?`,
      [tradeId]
    );

    const trade = (trades as any)[0];
    if (!trade) {
      throw new Error('Trade not found');
    }

    // Calculate final PnL
    let finalPnL = 0;
    if (trade.side === 'BUY') {
      finalPnL = (closePrice - trade.entry_price) * trade.volume;
    } else {
      finalPnL = (trade.entry_price - closePrice) * trade.volume;
    }
    finalPnL = parseFloat(finalPnL.toFixed(2));

    // Unlock balance
    await connection.execute(
      `UPDATE user_accounts SET locked_balance = locked_balance - ?, available_balance = balance - (locked_balance - ?) 
       WHERE user_id = ?`,
      [trade.locked_balance, trade.locked_balance, trade.user_id]
    );

    // Get current balance
    const [accounts] = await connection.execute(
      `SELECT balance FROM user_accounts WHERE user_id = ?`,
      [trade.user_id]
    );
    const currentBalance = (accounts as any)[0].balance;
    const newBalance = currentBalance + finalPnL;

    // Update user balance
    await connection.execute(
      `UPDATE user_accounts SET balance = balance + ? WHERE user_id = ?`,
      [finalPnL, trade.user_id]
    );

    // Update trade to closed
    await connection.execute(
      `UPDATE trades SET status = 'CLOSED', close_price = ?, final_pnl = ?, closing_reason = ?, closed_at = NOW() 
       WHERE id = ?`,
      [closePrice, finalPnL, reason, tradeId]
    );

    // Log action
    await connection.execute(
      `INSERT INTO trade_logs (trade_id, user_id, action, old_value, new_value)
       VALUES (?, ?, 'TRADE_CLOSED', ?, ?)`,
      [
        tradeId,
        trade.user_id,
        JSON.stringify({ status: 'OPEN', pnl: trade.pnl }),
        JSON.stringify({ status: 'CLOSED', finalPnL, reason }),
      ]
    );

    await connection.commit();

    return { finalPnL, newBalance };
  } catch (error) {
    await connection.rollback();
    throw new Error('Failed to close trade: ' + (error as Error).message);
  } finally {
    connection.release();
  }
}

/**
 * Update trade current price and PnL (real-time)
 */
export async function updateTradeRealtime(
  tradeId: number,
  currentPrice: number
): Promise<{ pnl: number; pnlPercentage: number }> {
  const connection = await pool.getConnection();

  try {
    // Get trade
    const [trades] = await connection.execute(
      `SELECT * FROM trades WHERE id = ?`,
      [tradeId]
    );

    const trade = (trades as any)[0];
    if (!trade || trade.status !== 'OPEN') {
      throw new Error('Trade not found or not open');
    }

    // Calculate PnL
    const { pnl, pnlPercentage } = calculatePnL(trade.side, trade.entry_price, currentPrice, trade.volume);

    // Update trade with current price and PnL
    await connection.execute(
      `UPDATE trades SET current_price = ?, pnl = ?, pnl_percentage = ? WHERE id = ?`,
      [currentPrice, pnl, pnlPercentage, tradeId]
    );

    return { pnl, pnlPercentage };
  } catch (error) {
    throw new Error('Failed to update trade: ' + (error as Error).message);
  } finally {
    connection.release();
  }
}

/**
 * Check and execute stop loss / take profit
 */
export async function checkAndExecuteStopLossTakeProfit(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    // Get all open trades with stop loss or take profit
    const [trades] = await connection.execute(
      `SELECT * FROM trades WHERE status = 'OPEN' AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL)`
    );

    for (const trade of trades as any[]) {
      const currentPrice = await getCurrentPrice(trade.symbol);

      let shouldClose = false;
      let reason: 'STOP_LOSS' | 'TAKE_PROFIT' = 'STOP_LOSS';

      if (trade.side === 'BUY') {
        if (trade.stop_loss && currentPrice <= trade.stop_loss) {
          shouldClose = true;
          reason = 'STOP_LOSS';
        } else if (trade.take_profit && currentPrice >= trade.take_profit) {
          shouldClose = true;
          reason = 'TAKE_PROFIT';
        }
      } else {
        // SELL
        if (trade.stop_loss && currentPrice >= trade.stop_loss) {
          shouldClose = true;
          reason = 'STOP_LOSS';
        } else if (trade.take_profit && currentPrice <= trade.take_profit) {
          shouldClose = true;
          reason = 'TAKE_PROFIT';
        }
      }

      if (shouldClose) {
        await closeTrade(trade.id, currentPrice, reason);
        console.log(`[TRADE] Auto-closed trade ${trade.id} (${reason}) at ${currentPrice}`);
      }
    }
  } catch (error) {
    console.error('Error checking stop loss/take profit:', error);
  } finally {
    connection.release();
  }
}

/**
 * Log trade action
 */
export async function logTradeAction(
  tradeId: number,
  userId: number,
  action: string,
  oldValue: any = null,
  newValue: any = null
): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO trade_logs (trade_id, user_id, action, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [tradeId, userId, action, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null]
    );
  } catch (error) {
    console.error('Failed to log trade action:', error);
  }
}

/**
 * Get available balance for user
 */
export async function getAvailableBalance(userId: number): Promise<number> {
  try {
    const [accounts] = await pool.execute(
      `SELECT balance, locked_balance FROM user_accounts WHERE user_id = ?`,
      [userId]
    );

    const account = (accounts as any)[0];
    if (!account) {
      return 0;
    }

    return account.balance - (account.locked_balance || 0);
  } catch (error) {
    console.error('Failed to get available balance:', error);
    return 0;
  }
}

/**
 * Get account info with balance details
 */
export async function getAccountInfo(userId: number): Promise<any> {
  try {
    const [accounts] = await pool.execute(
      `SELECT id, user_id, balance, equity, margin_free, locked_balance 
       FROM user_accounts WHERE user_id = ?`,
      [userId]
    );

    const account = (accounts as any)[0];
    if (!account) {
      return null;
    }

    return {
      ...account,
      availableBalance: account.balance - (account.locked_balance || 0),
    };
  } catch (error) {
    console.error('Failed to get account info:', error);
    return null;
  }
}

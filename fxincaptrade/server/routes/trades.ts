import express, { Request, Response, NextFunction } from 'express';
import {
  validateTradeOpen,
  createTrade,
  closeTrade,
  calculatePnL,
  updateTradeRealtime,
  checkAndExecuteStopLossTakeProfit,
} from '../lib/trading-engine';
import {
  getOpenTradesByUser,
  getTradeById,
  getTradeHistory,
  getTradeStatistics,
  getUserAccountBalance,
  getAccountWithPositions,
} from '../lib/database-trading';
import { getCurrentPrice } from '../lib/price-service';

const router = express.Router();

// Middleware to extract user ID (assumes authentication middleware sets req.user)
const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
  const authUser = (req as any).user;
  if (!authUser || !authUser.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.use(authenticateUser);

/**
 * POST /api/trades/open
 * Open a new trade position
 */
router.post('/open', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { symbol, side, volume, leverage, stopLoss, takeProfit } = req.body;

    // Validate input
    if (!symbol || !side || !volume || !leverage) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, side, volume, leverage',
      });
    }

    if (!['BUY', 'SELL'].includes(side)) {
      return res.status(400).json({ error: 'Invalid side. Must be BUY or SELL' });
    }

    if (volume <= 0 || leverage <= 0) {
      return res.status(400).json({ error: 'Volume and leverage must be positive' });
    }

    // Get current price
    const entryPrice = await getCurrentPrice(symbol);
    if (!entryPrice) {
      return res.status(400).json({ error: `Could not fetch price for ${symbol}` });
    }

    // Validate trade can be opened
    const validation = await validateTradeOpen(userId, symbol, volume, leverage, entryPrice);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Create the trade
    const { tradeId, lockedBalance } = await createTrade(
      userId,
      symbol,
      side,
      volume,
      leverage,
      entryPrice,
      stopLoss || 0,
      takeProfit || 0
    );

    res.status(201).json({
      trade_id: tradeId,
      status: 'OPEN',
      symbol,
      side,
      volume,
      entry_price: entryPrice,
      leverage,
      locked_balance: lockedBalance,
      stop_loss: stopLoss || null,
      take_profit: takeProfit || null,
      opened_at: new Date().toISOString(),
      message: 'Trade opened successfully',
    });
  } catch (error) {
    console.error('Error opening trade:', error);
    res.status(500).json({ error: 'Failed to open trade: ' + (error as Error).message });
  }
});

/**
 * GET /api/trades/open
 * Get all open positions for the user
 */
router.get('/open', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const positions = await getOpenTradesByUser(userId);
    const accountData = await getUserAccountBalance(userId);

    let totalUnrealizedPnL = 0;
    for (const position of positions) {
      totalUnrealizedPnL += position.pnl;
    }

    res.json({
      positions,
      account: accountData,
      total_unrealized_pnl: totalUnrealizedPnL,
      count: positions.length,
    });
  } catch (error) {
    console.error('Error fetching open trades:', error);
    res.status(500).json({ error: 'Failed to fetch open trades' });
  }
});

/**
 * GET /api/trades/:id
 * Get a specific trade by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tradeId = parseInt(req.params.id);

    const trade = await getTradeById(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    // Verify user owns this trade
    if (trade.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this trade' });
    }

    res.json(trade);
  } catch (error) {
    console.error('Error fetching trade:', error);
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

/**
 * PUT /api/trades/:id/close
 * Close an open trade position manually
 */
router.put('/:id/close', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tradeId = parseInt(req.params.id);
    const { reason = 'USER_CLOSE' } = req.body;

    // Verify trade exists and belongs to user
    const trade = await getTradeById(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this trade' });
    }

    if (trade.status !== 'OPEN') {
      return res.status(400).json({ error: 'Trade is not open' });
    }

    // Get current price
    const closePrice = await getCurrentPrice(trade.symbol);
    if (!closePrice) {
      return res.status(400).json({ error: `Could not fetch current price for ${trade.symbol}` });
    }

    // Close the trade
    const { finalPnL, newBalance } = await closeTrade(
      tradeId,
      closePrice,
      reason as 'USER_CLOSE' | 'STOP_LOSS' | 'TAKE_PROFIT'
    );

    res.json({
      trade_id: tradeId,
      status: 'CLOSED',
      symbol: trade.symbol,
      side: trade.side,
      entry_price: trade.entry_price,
      close_price: closePrice,
      final_pnl: finalPnL,
      final_pnl_percentage: ((closePrice - trade.entry_price) / trade.entry_price * 100).toFixed(2),
      new_balance: newBalance,
      closed_at: new Date().toISOString(),
      closing_reason: reason,
      message: 'Trade closed successfully',
    });
  } catch (error) {
    console.error('Error closing trade:', error);
    res.status(500).json({ error: 'Failed to close trade: ' + (error as Error).message });
  }
});

/**
 * PUT /api/trades/:id/modify
 * Modify an open trade (stop loss, take profit, leverage)
 */
router.put('/:id/modify', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tradeId = parseInt(req.params.id);
    const { stopLoss, takeProfit, leverage } = req.body;

    // Verify trade exists and belongs to user
    const trade = await getTradeById(tradeId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this trade' });
    }

    if (trade.status !== 'OPEN') {
      return res.status(400).json({ error: 'Trade is not open' });
    }

    // Validate modifications
    const updates: { [key: string]: any } = {};
    let updateQuery = 'UPDATE trades SET ';
    const params: any[] = [];

    if (stopLoss !== undefined && stopLoss !== null) {
      updates.stop_loss = stopLoss;
      params.push(stopLoss);
      updateQuery += 'stop_loss = ?, ';
    }

    if (takeProfit !== undefined && takeProfit !== null) {
      updates.take_profit = takeProfit;
      params.push(takeProfit);
      updateQuery += 'take_profit = ?, ';
    }

    if (leverage !== undefined && leverage !== null) {
      if (leverage <= 0) {
        return res.status(400).json({ error: 'Leverage must be positive' });
      }
      updates.leverage = leverage;
      params.push(leverage);
      updateQuery += 'leverage = ?, ';
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Remove trailing comma and space, add WHERE clause
    updateQuery = updateQuery.slice(0, -2) + ' WHERE id = ?';
    params.push(tradeId);

    // Execute update
    const pool = require('../lib/database').default;
    await pool.execute(updateQuery, params);

    res.json({
      trade_id: tradeId,
      updated_fields: updates,
      message: 'Trade modified successfully',
    });
  } catch (error) {
    console.error('Error modifying trade:', error);
    res.status(500).json({ error: 'Failed to modify trade: ' + (error as Error).message });
  }
});

/**
 * GET /api/trades/history
 * Get closed/cancelled trades for the user
 */
router.get('/history/all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const trades = await getTradeHistory(userId, limit);
    const stats = await getTradeStatistics(userId);

    res.json({
      trades,
      statistics: stats,
      count: trades.length,
    });
  } catch (error) {
    console.error('Error fetching trade history:', error);
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

/**
 * GET /api/account/balance
 * Get user's account balance with locked info
 */
router.get('/account/balance', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const account = await getAccountWithPositions(userId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Error fetching account balance:', error);
    res.status(500).json({ error: 'Failed to fetch account balance' });
  }
});

/**
 * GET /api/trades/stats
 * Get trading statistics for the user
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const stats = await getTradeStatistics(userId);
    const account = await getUserAccountBalance(userId);

    res.json({
      ...stats,
      account,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * POST /api/trades/check-sl-tp
 * Check and execute stop loss / take profit (called by background job)
 */
router.post('/admin/check-sl-tp', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin verification
    await checkAndExecuteStopLossTakeProfit();
    res.json({ message: 'Stop loss/take profit check completed' });
  } catch (error) {
    console.error('Error checking stop loss/take profit:', error);
    res.status(500).json({ error: 'Failed to check stop loss/take profit' });
  }
});

/**
 * POST /api/trades/price-update
 * Update trade with current price (called by WebSocket price feed)
 */
router.post('/price-update', async (req: Request, res: Response) => {
  try {
    const { tradeId, currentPrice } = req.body;

    if (!tradeId || currentPrice === undefined) {
      return res.status(400).json({ error: 'Missing tradeId or currentPrice' });
    }

    const { pnl, pnlPercentage } = await updateTradeRealtime(tradeId, currentPrice);

    res.json({
      trade_id: tradeId,
      current_price: currentPrice,
      pnl,
      pnl_percentage: pnlPercentage,
    });
  } catch (error) {
    console.error('Error updating trade price:', error);
    res.status(500).json({ error: 'Failed to update trade price' });
  }
});

// Export closePosition handler for compatibility
export async function closePosition(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { trade_id, reason = 'USER_CLOSE' } = req.body;

    if (!trade_id) {
      return res.status(400).json({ error: 'trade_id is required' });
    }

    const tradeId = parseInt(trade_id);
    const trade = await getTradeById(tradeId);
    
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (trade.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (trade.status !== 'OPEN') {
      return res.status(400).json({ error: 'Trade is not open' });
    }

    const closePrice = await getCurrentPrice(trade.symbol);
    const { finalPnL, newBalance } = await closeTrade(tradeId, closePrice, reason);

    res.json({
      success: true,
      trade_id: tradeId,
      status: 'CLOSED',
      close_price: closePrice,
      final_pnl: finalPnL,
      new_balance: newBalance,
    });
  } catch (error) {
    console.error('Error closing position:', error);
    res.status(500).json({ error: 'Failed to close position' });
  }
}

export default router;

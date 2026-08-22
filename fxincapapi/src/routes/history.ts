import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { query } from "../lib/database.js";

const router: Router = Router();

// Ensure the trade_history table exists (created lazily if missing)
async function ensureTradeHistoryTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      account_id UUID,
      symbol VARCHAR(20) NOT NULL,
      side VARCHAR(4) NOT NULL,
      volume NUMERIC(10,4) NOT NULL,
      open_price NUMERIC(15,8) NOT NULL,
      close_price NUMERIC(15,8) NOT NULL,
      profit NUMERIC(15,2),
      profit_percentage NUMERIC(10,4),
      commission NUMERIC(10,4),
      leverage INTEGER,
      open_time TIMESTAMP,
      close_time TIMESTAMP,
      duration_seconds INTEGER,
      closed_reason VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
ensureTradeHistoryTable().catch((e) => console.error("[history] ensureTradeHistoryTable failed:", e));

// ==========================================
// Get Trade History
// ==========================================
router.get("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const accountId = typeof req.query.accountId === "string" ? req.query.accountId.trim() : "";

    const params: any[] = [userId];
    let accountFilter = "";
    if (accountId) {
      params.push(accountId);
      accountFilter = ` AND th.account_id = $${params.length}`;
    }
    params.push(limit, offset);

    const results = await query(
      `SELECT th.*, ua.account_number, ua.trading_mode AS account_mode
         FROM trade_history th
         LEFT JOIN user_accounts ua ON ua.id = th.account_id
        WHERE th.user_id = $1${accountFilter}
        ORDER BY th.close_time DESC NULLS LAST
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const history = Array.isArray(results)
      ? results.map((trade: any) => ({
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          volume: parseFloat(trade.volume),
          entryPrice: parseFloat(trade.open_price),
          closePrice: parseFloat(trade.close_price),
          exitPrice: parseFloat(trade.close_price),
          pnl: parseFloat(trade.profit ?? 0),
          profitLoss: parseFloat(trade.profit ?? 0),
          profitLossPercent: parseFloat(trade.profit_percentage ?? 0),
          commission: parseFloat(trade.commission ?? 0),
          leverage: trade.leverage,
          entryTime: trade.open_time,
          closedAt: trade.close_time,
          exitTime: trade.close_time,
          closingReason: trade.closed_reason,
          accountId: trade.account_id,
          accountNumber: trade.account_number || null,
          accountMode: trade.account_mode || null,
        }))
      : [];

    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { getConnection, query } from "../lib/database.js";
import {
  validateTradeOpen,
  createTrade,
  closeTrade,
  calculatePnL,
  getAvailableBalance,
  getAccountInfo,
  checkAndExecuteStopLossTakeProfit,
  processAllStopLossTakeProfit,
} from "../lib/trading-engine.js";
import {
  getOpenTradesByUser,
  getTradeById,
  getTradeHistory,
  getTradeStatistics,
  updateTradeCurrentPrice,
  getUserAccountBalance,
} from "../lib/database-trading.js";

const router: Router = Router();

// Open new trade
router.post("/open", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const { symbol, side, volume, entryPrice, takeProfit, stopLoss, leverage } = req.body;

    // Validate inputs
    if (!symbol || !side || !volume || !entryPrice) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Validate trade
    const validation = await validateTradeOpen(
      userId,
      symbol,
      side,
      volume,
      entryPrice,
      leverage || 1,
      stopLoss || null,
      takeProfit || null
    );

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Create trade
    const result = await createTrade(
      userId,
      symbol,
      side,
      volume,
      entryPrice,
      takeProfit || null,
      stopLoss || null,
      leverage || 1
    );

    if (result.success) {
      res.json({ success: true, tradeId: result.tradeId });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Error opening trade:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get open trades
router.get("/open", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const trades = await getOpenTradesByUser(userId);

    res.json({ success: true, trades });
  } catch (error) {
    console.error("Error getting open trades:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get trade by ID
router.get("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const tradeId = parseInt(req.params.id);
    const trade = await getTradeById(tradeId);

    if (!trade) {
      return res.status(404).json({ success: false, error: "Trade not found" });
    }

    // Verify ownership
    if (trade.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    res.json({ success: true, trade });
  } catch (error) {
    console.error("Error getting trade:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Close trade
router.put("/:id/close", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const tradeId = parseInt(req.params.id);
    const { closePrice, reason } = req.body;

    if (!closePrice) {
      return res.status(400).json({ success: false, error: "Close price required" });
    }

    // Get trade and verify ownership
    const trade = await getTradeById(tradeId);
    if (!trade) {
      return res.status(404).json({ success: false, error: "Trade not found" });
    }

    if (trade.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Close trade
    const closeReason = typeof reason === "string" && reason.trim() ? reason.trim() : "MANUAL_CLOSE";
    const result = await closeTrade(tradeId, closePrice, closeReason);

    if (result.success) {
      res.json({ success: true, finalPnL: result.finalPnL });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("Error closing trade:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Modify trade (update SL/TP)
router.put("/:id/modify", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const tradeId = parseInt(req.params.id);
    const { stopLoss, takeProfit } = req.body;

    const trade = await getTradeById(tradeId);
    if (!trade) {
      return res.status(404).json({ success: false, error: "Trade not found" });
    }

    if (trade.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    if (String(trade.status).toUpperCase() !== "OPEN") {
      return res.status(400).json({ success: false, error: "Only open trades can be modified" });
    }

    const entry = Number(trade.entry_price);
    const side = String(trade.side || "").toUpperCase();

    /** Clear when null/empty string; otherwise must be a finite price > 0. */
    const parseOptionalPrice = (v: unknown): "clear" | number | "invalid" => {
      if (v === null || v === undefined || v === "") return "clear";
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return "invalid";
      return n;
    };

    const sets: string[] = [];
    const params: any[] = [];
    let n = 1;

    if (stopLoss !== undefined) {
      const parsed = parseOptionalPrice(stopLoss);
      if (parsed === "invalid") {
        return res.status(400).json({ success: false, error: "Invalid stop loss" });
      }
      const sl = parsed === "clear" ? null : parsed;
      if (sl != null) {
        if (side === "BUY" && sl >= entry) {
          return res.status(400).json({ success: false, error: "For BUY, stop loss must be below entry price" });
        }
        if (side === "SELL" && sl <= entry) {
          return res.status(400).json({ success: false, error: "For SELL, stop loss must be above entry price" });
        }
      }
      sets.push(`stop_loss = $${n++}`);
      params.push(sl);
    }

    if (takeProfit !== undefined) {
      const parsed = parseOptionalPrice(takeProfit);
      if (parsed === "invalid") {
        return res.status(400).json({ success: false, error: "Invalid take profit" });
      }
      const tp = parsed === "clear" ? null : parsed;
      if (tp != null) {
        if (side === "BUY" && tp <= entry) {
          return res.status(400).json({ success: false, error: "For BUY, take profit must be above entry price" });
        }
        if (side === "SELL" && tp >= entry) {
          return res.status(400).json({ success: false, error: "For SELL, take profit must be below entry price" });
        }
      }
      sets.push(`take_profit = $${n++}`);
      params.push(tp);
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: "No updates provided" });
    }

    params.push(tradeId);
    const sql = `UPDATE trades SET ${sets.join(", ")} WHERE id = $${n} AND user_id = $${n + 1} AND status = 'OPEN'`;
    params.push(userId);

    const client = await getConnection();
    try {
      const result = await client.query(sql, params);
      const ok = (result.rowCount ?? 0) > 0;
      if (!ok) {
        return res.status(400).json({ success: false, error: "Could not update trade" });
      }
      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error modifying trade:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get trade history
router.get("/history/all", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const trades = await getTradeHistory(userId, limit, offset);

    res.json({ success: true, trades });
  } catch (error) {
    console.error("Error getting trade history:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get account balance
router.get("/account/balance", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const balance = await getAvailableBalance(userId);

    if (balance.success) {
      res.json({ success: true, balance: balance.availableBalance });
    } else {
      res.status(400).json(balance);
    }
  } catch (error) {
    console.error("Error getting balance:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get account info
router.get("/account/info", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const info = await getAccountInfo(userId);

    if (info.success) {
      res.json({ success: true, ...info });
    } else {
      res.status(400).json(info);
    }
  } catch (error) {
    console.error("Error getting account info:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get trade statistics
router.get("/stats/summary", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const stats = await getTradeStatistics(userId);

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error getting statistics:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Admin: Check and execute SL/TP for one trade (optional: called by price service)
router.post("/admin/check-sl-tp", async (req: AuthRequest, res: Response) => {
  try {
    const { tradeId, bid, ask, currentPrice } = req.body;

    if (!tradeId) {
      return res.status(400).json({ success: false, error: "tradeId required" });
    }

    const b = Number(bid ?? currentPrice);
    const a = Number(ask ?? currentPrice ?? bid);
    if (!Number.isFinite(b) || b <= 0) {
      return res.status(400).json({ success: false, error: "bid/currentPrice required" });
    }
    const bidPx = b;
    const askPx = Number.isFinite(a) && a > 0 ? a : b;

    const result = await checkAndExecuteStopLossTakeProfit(Number(tradeId), bidPx, askPx);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error checking SL/TP:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Admin: Run SL/TP scan for all open trades (same logic as background worker)
router.post("/admin/process-sl-tp-all", async (_req: AuthRequest, res: Response) => {
  try {
    const out = await processAllStopLossTakeProfit();
    res.json({ success: true, ...out });
  } catch (error) {
    console.error("Error processing SL/TP:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Admin: Update trade price
router.post("/price-update", async (req: AuthRequest, res: Response) => {
  try {
    const { tradeId, currentPrice } = req.body;

    if (!tradeId || !currentPrice) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    const result = await updateTradeCurrentPrice(tradeId, currentPrice);

    res.json({ success: result });
  } catch (error) {
    console.error("Error updating price:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;


import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { query } from "../lib/database.js";
import {
  validateTradeOpen,
  createTrade,
  closeTrade,
  calculatePnL,
  getAvailableBalance,
  getAccountInfo,
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

    // Get trade and verify ownership
    const trade = await getTradeById(tradeId);
    if (!trade) {
      return res.status(404).json({ success: false, error: "Trade not found" });
    }

    if (trade.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Update trade
    const updates: string[] = [];
    const params: any[] = [];

    if (stopLoss !== undefined) {
      updates.push("stop_loss = ?");
      params.push(stopLoss);
    }

    if (takeProfit !== undefined) {
      updates.push("take_profit = ?");
      params.push(takeProfit);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "No updates provided" });
    }

    params.push(tradeId);

    const updateStr = updates.join(", ");
    const result = await query(`UPDATE trades SET ${updateStr} WHERE id = ?`, params);

    res.json({ success: (result as any).affectedRows > 0 });
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

// Admin: Check and execute SL/TP (called by price service)
router.post("/admin/check-sl-tp", async (req: AuthRequest, res: Response) => {
  try {
    // TODO: Add admin authentication
    const { tradeId, currentPrice } = req.body;

    if (!tradeId || !currentPrice) {
      return res.status(400).json({ success: false, error: "Missing parameters" });
    }

    // TODO: Implement checkAndExecuteStopLossTakeProfit
    res.json({ success: true });
  } catch (error) {
    console.error("Error checking SL/TP:", error);
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


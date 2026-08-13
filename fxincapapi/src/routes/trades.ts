import { Router, Response } from "express";
import { AuthRequest, verifyToken, optionalAuth } from "./auth.js";
import { requireInternalService } from "../middleware/adminAuth.js";
import { getServerQuote, isFresh, executablePrice } from "../lib/market-price.js";
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

/**
 * Resolve the price a trade opens or closes at.
 *
 * The browser is not trusted as the source of a financial price. The server
 * obtains the executable price from fxincapws; a client-supplied value is only
 * a hint and is never used for settlement. When no fresh server price exists the
 * operation is refused rather than settled at a client or fabricated price.
 *
 * See docs/PNL_ENGINE.md §6 and docs/MARKET_DATA_ARCHITECTURE.md.
 */
async function resolveServerPrice(
  symbol: string,
  side: string,
  action: "OPEN" | "CLOSE"
): Promise<{ price: number } | { error: string }> {
  const quote = await getServerQuote(symbol);

  if (!quote) {
    return {
      error:
        "Market price unavailable for this symbol. Trading is temporarily unavailable — please try again shortly.",
    };
  }

  if (!isFresh(quote)) {
    return {
      error: "Market price is stale. Trading is temporarily unavailable — please try again shortly.",
    };
  }

  return { price: executablePrice(quote, side, action) };
}

// Open new trade
router.post("/open", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const { symbol, side, volume, takeProfit, stopLoss, leverage } = req.body;

    // Validate inputs. `entryPrice` from the request body is deliberately
    // ignored — the server sets the entry price.
    if (!symbol || !side || !volume) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const priced = await resolveServerPrice(String(symbol), String(side), "OPEN");
    if ("error" in priced) {
      return res.status(503).json({ success: false, error: priced.error });
    }
    const entryPrice = priced.price;

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
      // Return the executed entry price so the client can reconcile what it
      // displayed against what the server actually filled at.
      res.json({ success: true, tradeId: result.tradeId, entryPrice });
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
    const { reason } = req.body;

    // Get trade and verify ownership
    const trade = await getTradeById(tradeId);
    if (!trade) {
      return res.status(404).json({ success: false, error: "Trade not found" });
    }

    if (trade.user_id !== userId) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // `closePrice` from the request body is deliberately ignored — a client must
    // not choose the price its own position settles at.
    const priced = await resolveServerPrice(String(trade.symbol), String(trade.side), "CLOSE");
    if ("error" in priced) {
      return res.status(503).json({ success: false, error: priced.error });
    }
    const closePrice = priced.price;

    // Close trade
    const closeReason = typeof reason === "string" && reason.trim() ? reason.trim() : "MANUAL_CLOSE";
    const result = await closeTrade(tradeId, closePrice, closeReason);

    if (result.success) {
      res.json({ success: true, finalPnL: result.finalPnL, closePrice });
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

// Dashboard: open trades + stats + account info in one parallel request
router.get("/dashboard", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const [trades, stats, accountInfo] = await Promise.all([
      getOpenTradesByUser(userId),
      getTradeStatistics(userId),
      getAccountInfo(userId),
    ]);

    res.json({
      success: true,
      openTrades: trades,
      stats,
      account: accountInfo.success
        ? {
            balance: accountInfo.balance,
            availableBalance: accountInfo.availableBalance,
            lockedBalance: accountInfo.lockedBalance,
            totalPnL: accountInfo.totalPnL,
          }
        : null,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
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

// Internal/admin: Check and execute SL/TP for one trade.
// Guarded by requireInternalService — it can close a position at a supplied
// bid/ask and was previously reachable with no credential at all.
router.post("/admin/check-sl-tp", optionalAuth, requireInternalService, async (req: AuthRequest, res: Response) => {
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

// Internal/admin: Run SL/TP scan for all open trades (same logic as background worker)
router.post("/admin/process-sl-tp-all", optionalAuth, requireInternalService, async (_req: AuthRequest, res: Response) => {
  try {
    const out = await processAllStopLossTakeProfit();
    res.json({ success: true, ...out });
  } catch (error) {
    console.error("Error processing SL/TP:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * Internal/admin: force a price update for one trade.
 *
 * This was unauthenticated and accepted any tradeId with any price. Because the
 * auto-close worker settled at `current_price`, it was a direct route to
 * manipulating another user's realized P&L.
 *
 * Open positions are now valued by the server-side price-sync worker
 * (lib/price-sync.ts); this endpoint remains only as a maintenance tool.
 */
router.post("/price-update", optionalAuth, requireInternalService, async (req: AuthRequest, res: Response) => {
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


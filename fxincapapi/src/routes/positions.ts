import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { query } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";

const router: Router = Router();

// ==========================================
// 1. Get All Positions
// ==========================================
router.get("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const results = await query(
      `SELECT p.*, s.symbol, s.bid, s.ask 
       FROM positions p 
       JOIN symbols s ON p.symbol_id = s.id 
       WHERE p.user_id = ? AND p.status = 'open'
       ORDER BY p.opened_at DESC`,
      [userId]
    );

    const positions = Array.isArray(results)
      ? results.map((pos: any) => ({
          id: pos.id,
          symbol: pos.symbol,
          type: pos.position_type,
          volume: parseFloat(pos.volume),
          openPrice: parseFloat(pos.open_price),
          currentPrice: pos.position_type === "buy" ? parseFloat(pos.bid) : parseFloat(pos.ask),
          openedAt: pos.opened_at,
          profit:
            parseFloat(pos.bid) * parseFloat(pos.volume) -
            parseFloat(pos.open_price) * parseFloat(pos.volume),
          stopLoss: pos.stop_loss ? parseFloat(pos.stop_loss) : null,
          takeProfit: pos.take_profit ? parseFloat(pos.take_profit) : null,
        }))
      : [];

    res.json({ success: true, positions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Same data as GET / but raw array — matches trade SPA + legacy clients. */
router.get("/open", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const results = await query(
      `SELECT p.*, s.symbol, s.bid, s.ask 
       FROM positions p 
       JOIN symbols s ON p.symbol_id = s.id 
       WHERE p.user_id = ? AND p.status = 'open'
       ORDER BY p.opened_at DESC`,
      [userId]
    );

    const positions = Array.isArray(results)
      ? results.map((pos: any) => ({
          id: pos.id,
          symbol: pos.symbol,
          type: pos.position_type,
          volume: parseFloat(pos.volume),
          openPrice: parseFloat(pos.open_price),
          currentPrice: pos.position_type === "buy" ? parseFloat(pos.bid) : parseFloat(pos.ask),
          openedAt: pos.opened_at,
          profit:
            parseFloat(pos.bid) * parseFloat(pos.volume) -
            parseFloat(pos.open_price) * parseFloat(pos.volume),
          stopLoss: pos.stop_loss ? parseFloat(pos.stop_loss) : null,
          takeProfit: pos.take_profit ? parseFloat(pos.take_profit) : null,
        }))
      : [];

    res.json(positions);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Body: { positionId, closePrice? } — alias for clients that POST close instead of DELETE /:id */
router.post("/close", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const id = req.body?.positionId as string | undefined;
    if (!id) {
      return res.status(400).json({ success: false, error: "positionId required" });
    }

    const posResults = await query("SELECT * FROM positions WHERE id = ? AND user_id = ?", [id, userId]);
    if (!Array.isArray(posResults) || posResults.length === 0) {
      return res.status(404).json({ success: false, error: "Position not found" });
    }

    const position = posResults[0] as any;
    const closePrice = req.body?.closePrice ?? position.close_price ?? position.open_price;

    await query("UPDATE positions SET status = 'closed', close_price = ? WHERE id = ?", [closePrice, id]);

    const historyId = uuidv4();
    const profit = (Number(closePrice) - parseFloat(position.open_price)) * parseFloat(position.volume);
    await query(
      `INSERT INTO trade_history (id, user_id, symbol_id, entry_price, exit_price, volume, profit_loss, entry_time, exit_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [historyId, userId, position.symbol_id, position.open_price, closePrice, position.volume, profit, position.opened_at]
    );

    res.json({ success: true, message: "Position closed", profit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. Get Position by ID
// ==========================================
router.get("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const results = await query(
      `SELECT p.*, s.symbol, s.bid, s.ask 
       FROM positions p 
       JOIN symbols s ON p.symbol_id = s.id 
       WHERE p.id = ? AND p.user_id = ?`,
      [id, userId]
    );

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({ success: false, error: "Position not found" });
    }

    const pos = (results[0] as any);
    const position = {
      id: pos.id,
      symbol: pos.symbol,
      type: pos.position_type,
      volume: parseFloat(pos.volume),
      openPrice: parseFloat(pos.open_price),
      currentPrice: pos.position_type === "buy" ? parseFloat(pos.bid) : parseFloat(pos.ask),
      openedAt: pos.opened_at,
      profit: parseFloat(pos.bid) * parseFloat(pos.volume) - parseFloat(pos.open_price) * parseFloat(pos.volume),
      stopLoss: pos.stop_loss ? parseFloat(pos.stop_loss) : null,
      takeProfit: pos.take_profit ? parseFloat(pos.take_profit) : null,
    };

    res.json({ success: true, position });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. Create Position (Open Trade)
// ==========================================
router.post("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { symbol, type, volume, price, stopLoss, takeProfit } = req.body;

    if (!symbol || !type || !volume || !price || volume <= 0 || price <= 0) {
      return res.status(400).json({ success: false, error: "Invalid position data" });
    }

    // Get symbol ID
    const symbolResults = await query("SELECT id FROM symbols WHERE symbol = ?", [symbol]);
    if (!Array.isArray(symbolResults) || symbolResults.length === 0) {
      return res.status(404).json({ success: false, error: "Symbol not found" });
    }
    const symbolId = (symbolResults[0] as any).id;

    // Create position
    const positionId = uuidv4();
    await query(
      `INSERT INTO positions 
       (id, user_id, symbol_id, position_type, volume, open_price, stop_loss, take_profit, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
      [positionId, userId, symbolId, type, volume, price, stopLoss || null, takeProfit || null]
    );

    res.status(201).json({
      success: true,
      message: "Position opened",
      position: { id: positionId, symbol, type, volume, price },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. Close Position
// ==========================================
router.delete("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // Get position
    const posResults = await query("SELECT * FROM positions WHERE id = ? AND user_id = ?", [id, userId]);
    if (!Array.isArray(posResults) || posResults.length === 0) {
      return res.status(404).json({ success: false, error: "Position not found" });
    }

    const position = (posResults[0] as any);
    const closePrice = req.body.closePrice || position.close_price;

    // Update position status
    await query("UPDATE positions SET status = 'closed', close_price = ? WHERE id = ?", [closePrice, id]);

    // Add to trade history
    const historyId = uuidv4();
    const profit = (closePrice - parseFloat(position.open_price)) * parseFloat(position.volume);
    await query(
      `INSERT INTO trade_history (id, user_id, symbol_id, entry_price, exit_price, volume, profit_loss, entry_time, exit_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [historyId, userId, position.symbol_id, position.open_price, closePrice, position.volume, profit, position.opened_at]
    );

    res.json({ success: true, message: "Position closed", profit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. Update Position (Stop Loss / Take Profit)
// ==========================================
router.put("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { stopLoss, takeProfit } = req.body;

    // Verify ownership
    const results = await query("SELECT * FROM positions WHERE id = ? AND user_id = ?", [id, userId]);
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({ success: false, error: "Position not found" });
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (stopLoss !== undefined) updates.push("stop_loss = ?"), values.push(stopLoss);
    if (takeProfit !== undefined) updates.push("take_profit = ?"), values.push(takeProfit);

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "No updates provided" });
    }

    values.push(id);
    await query(`UPDATE positions SET ${updates.join(", ")} WHERE id = ?`, values);

    res.json({ success: true, message: "Position updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


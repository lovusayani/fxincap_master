import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { query } from "../lib/database.js";
import { getAvailableBalance, getRequiredMargin } from "../lib/trading-engine.js";
import { v4 as uuidv4 } from "uuid";

const router: Router = Router();

// Ensure the orders table exists (created lazily if missing)
async function ensureOrdersTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      symbol VARCHAR(20),
      symbol_id UUID,
      order_type VARCHAR(20) NOT NULL,
      side VARCHAR(4) NOT NULL,
      volume NUMERIC(15,4) NOT NULL,
      price NUMERIC(15,5) NOT NULL,
      leverage INTEGER DEFAULT 100,
      status VARCHAR(16) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS symbol VARCHAR(20)`);
  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 100`);
}
ensureOrdersTable().catch((e) => console.error("[orders] ensureOrdersTable failed:", e));

// ==========================================
// 1. Get All Orders
// ==========================================
router.get("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const results = await query(
      `SELECT o.id, o.user_id, o.symbol_id, o.order_type, o.side, o.volume, o.price, o.status, o.created_at, o.updated_at,
              o.leverage,
              COALESCE(o.symbol, s.code, '') AS symbol
       FROM orders o
       LEFT JOIN symbols s ON o.symbol_id = s.id
       WHERE o.user_id = $1 AND o.status = 'pending'
       ORDER BY o.created_at DESC`,
      [userId]
    );

    const orders = Array.isArray(results)
      ? results.map((ord: any) => ({
          id: ord.id,
          symbol: ord.symbol,
          type: ord.order_type,
          side: ord.side,
          volume: parseFloat(ord.volume),
          price: parseFloat(ord.price),
          leverage: Number(ord.leverage || 100),
          status: ord.status,
          createdAt: ord.created_at,
        }))
      : [];

    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. Get Order by ID
// ==========================================
router.get("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const results = await query(
      `SELECT o.id, o.user_id, o.symbol_id, o.order_type, o.side, o.volume, o.price, o.status, o.created_at, o.updated_at,
              o.leverage,
              COALESCE(o.symbol, s.code, '') AS symbol
       FROM orders o
       LEFT JOIN symbols s ON o.symbol_id = s.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, userId]
    );

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const ord = (results[0] as any);
    const order = {
      id: ord.id,
      symbol: ord.symbol,
      type: ord.order_type,
      side: ord.side,
      volume: parseFloat(ord.volume),
      price: parseFloat(ord.price),
      leverage: Number(ord.leverage || 100),
      status: ord.status,
      createdAt: ord.created_at,
    };

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. Create Order
// ==========================================
router.post("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { symbol, type, side, volume, price, leverage } = req.body;
    const parsedLeverage = Number(leverage || 100);

    if (!symbol || !type || !side || !volume || !price || volume <= 0 || price <= 0 || parsedLeverage <= 0) {
      return res.status(400).json({ success: false, error: "Invalid order data" });
    }

    const balanceResult = await getAvailableBalance(userId);
    const availableBalance = balanceResult.availableBalance || 0;
    const requiredMargin = getRequiredMargin(symbol, Number(volume), Number(price), parsedLeverage);

    if (!balanceResult.success) {
      return res.status(400).json({ success: false, error: balanceResult.error || "Unable to verify margin" });
    }

    if (requiredMargin > availableBalance) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. Required margin: ${requiredMargin.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`,
      });
    }

    const symbolResults = await query("SELECT id FROM symbols WHERE code = $1", [symbol]);
    const symbolId = Array.isArray(symbolResults) && symbolResults.length > 0
      ? (symbolResults[0] as any).id
      : null;

    // Create order
    const orderId = uuidv4();
    await query(
      `INSERT INTO orders 
       (id, user_id, symbol, symbol_id, order_type, side, volume, price, leverage, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [orderId, userId, symbol, symbolId, type, side, volume, price, parsedLeverage]
    );

    res.status(201).json({
      success: true,
      message: "Order created",
      order: { id: orderId, symbol, type, side, volume, price, leverage: parsedLeverage, status: "pending" },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. Cancel Order
// ==========================================
router.delete("/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    // Get order
    const ordResults = await query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [id, userId]);
    if (!Array.isArray(ordResults) || ordResults.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const order = (ordResults[0] as any);
    if (order.status !== "pending") {
      return res.status(400).json({ success: false, error: "Can only cancel pending orders" });
    }

    // Update order status
    await query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [id]);

    res.json({ success: true, message: "Order cancelled" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


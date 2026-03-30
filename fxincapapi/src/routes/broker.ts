import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";

const router: Router = Router();

// Get broker accounts
router.get("/accounts", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([]);
});

// Connect broker account
router.post("/accounts", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true, accountId: "BROKER-" + Date.now() });
});

// Get broker account details
router.get("/accounts/:accountId", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({});
});

// Sync with broker
router.post("/sync", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true, message: "Sync completed" });
});

// Get available symbols
router.get("/symbols", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([
    { symbol: "EURUSD", bid: 1.0950, ask: 1.0952 },
    { symbol: "GBPUSD", bid: 1.2750, ask: 1.2752 },
    { symbol: "USDJPY", bid: 149.50, ask: 149.52 },
  ]);
});

export default router;


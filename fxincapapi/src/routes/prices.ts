import { Router, Request, Response } from "express";

const router: Router = Router();

// Get crypto prices via API project passthrough
router.get("/crypto", async (req: Request, res: Response) => {
  try {
    const rawIds = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = rawIds
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: "ids query param is required" });
    }

    const uniqueIds = Array.from(new Set(ids)).slice(0, 30);
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(uniqueIds.join(","))}&vs_currencies=usd`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ success: false, error: "Failed to fetch external price feed" });
    }

    const data = await response.json();
    return res.json({ success: true, prices: data, updatedAt: Date.now() });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Internal server error" });
  }
});

// Get real-time prices
router.get("/", async (req: Request, res: Response) => {
  res.json([
    { symbol: "EURUSD", bid: 1.0950, ask: 1.0952, timestamp: new Date() },
    { symbol: "GBPUSD", bid: 1.2750, ask: 1.2752, timestamp: new Date() },
    { symbol: "USDJPY", bid: 149.50, ask: 149.52, timestamp: new Date() },
  ]);
});

// Get specific symbol price
router.get("/:symbol", async (req: Request, res: Response) => {
  res.json({ symbol: req.params.symbol, bid: 1.0950, ask: 1.0952, timestamp: new Date() });
});

export default router;

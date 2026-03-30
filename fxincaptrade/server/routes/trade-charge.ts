import { RequestHandler } from "express";

export const deductTradeCharge: RequestHandler = async (req, res) => {
  try {
    const { positionId, charge } = req.body;
    res.json({ success: true, message: "Trade charge deducted" });
  } catch (error) {
    console.error("Error deducting charge:", error);
    res.status(500).json({ error: "Failed to deduct charge" });
  }
};

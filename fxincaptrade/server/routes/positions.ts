import { RequestHandler } from "express";
import { mockPositions } from "../lib/mockData";

export const getOpenPositions: RequestHandler = async (req, res) => {
  try {
    res.json(mockPositions);
  } catch (error) {
    console.error("Error fetching positions:", error);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
};

export const createPosition: RequestHandler = async (req, res) => {
  try {
    const { symbol, side, volume, price } = req.body;
    const positionId = Math.random().toString(36).substring(7);
    mockPositions.push({
      id: positionId,
      userId: "demo-user",
      symbol,
      side,
      volume,
      entryPrice: price,
      takeProfit: null,
      stopLoss: null,
      pnl: 0,
      status: "OPEN",
    });
    res.json({ success: true, message: "Position created successfully", positionId });
  } catch (error) {
    console.error("Error creating position:", error);
    res.status(500).json({ error: "Failed to create position" });
  }
};

export const updatePositionPNL: RequestHandler = async (req, res) => {
  try {
    const { positionId, currentPrice } = req.body;
    const pos = mockPositions.find((p) => p.id === positionId);
    if (pos) {
      const direction = pos.side === "BUY" ? 1 : -1;
      pos.pnl = Number(((currentPrice - (pos.entryPrice || currentPrice)) * 10000 * direction).toFixed(2));
    }
    res.json({ success: true, message: "Position updated" });
  } catch (error) {
    console.error("Error updating position:", error);
    res.status(500).json({ error: "Failed to update position" });
  }
};

export const closePositionDB: RequestHandler = async (req, res) => {
  try {
    const { positionId } = req.body;
    const idx = mockPositions.findIndex((p) => p.id === positionId);
    if (idx >= 0) {
      mockPositions.splice(idx, 1);
    }
    res.json({ success: true, message: "Position closed" });
  } catch (error) {
    console.error("Error closing position:", error);
    res.status(500).json({ error: "Failed to close position" });
  }
};

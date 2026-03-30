import { RequestHandler } from "express";

export const getTradingHistory: RequestHandler = async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
};

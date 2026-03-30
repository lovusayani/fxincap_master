import { RequestHandler } from "express";

export const handleDemo: RequestHandler = async (req, res) => {
  try {
    res.json({
      message: "Hello from the API!",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  } catch (error) {
    console.error("Demo error:", error);
    res.status(500).json({ error: "Failed to fetch demo data" });
  }
};

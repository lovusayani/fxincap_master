import { RequestHandler } from "express";
import { mockOrders } from "../lib/mockData";

export const getOrders: RequestHandler = async (_req, res) => {
  try {
    res.json(mockOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const createOrder: RequestHandler = async (req, res) => {
  try {
    const { symbol, type, volume, price } = req.body;
    const orderId = Math.random().toString(36).substring(7);
    mockOrders.push({
      id: orderId,
      userId: "demo-user",
      symbol,
      type,
      volume,
      price,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true, orderId });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const cancelOrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const idx = mockOrders.findIndex((o) => o.id === orderId);
    if (idx >= 0) {
      mockOrders.splice(idx, 1);
      return res.json({ success: true, message: "Order canceled" });
    }
    res.status(404).json({ success: false, message: "Order not found" });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
};

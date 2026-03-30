import { Router, Request, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";

const router: Router = Router();

// Create deposit payment
router.post("/deposit", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true, paymentId: "PAY-" + Date.now() });
});

// Create withdrawal request
router.post("/withdraw", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true, withdrawalId: "WD-" + Date.now() });
});

// Check payment status
router.get("/status/:paymentId", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ status: "pending" });
});

// Payment webhook handler
router.post("/webhook", async (req: Request, res: Response) => {
  res.json({ received: true });
});

// Get payment methods
router.get("/methods", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([
    { id: 1, name: "Bank Transfer", enabled: true },
    { id: 2, name: "Credit Card", enabled: true },
    { id: 3, name: "Crypto", enabled: false },
  ]);
});

// Get payment history
router.get("/history", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([]);
});

export default router;


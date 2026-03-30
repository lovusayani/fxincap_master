import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";

const router: Router = Router();

// Get notifications
router.get("/", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([]);
});

// Mark as read
router.post("/mark-read", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true });
});

// Delete notification
router.delete("/:notificationId", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true });
});

// Set notification preferences
router.post("/preferences", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true });
});

export default router;


import { Router, Request, Response } from "express";
import { AuthRequest } from "./auth.js";

const router: Router = Router();

// Create support ticket
router.post("/", async (req: Request, res: Response) => {
  res.json({ success: true, ticketId: "TICKET-" + Date.now() });
});

// Get user tickets
router.get("/:userId", async (req: Request, res: Response) => {
  res.json([]);
});

export default router;


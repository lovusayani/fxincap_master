import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import {
  listCategories,
  createTicket,
  listTicketsForUser,
  getTicket,
  addReply,
} from "../lib/support.js";

const router: Router = Router();

/** Categories a trader may file under. Only enabled ones are offered. */
router.get("/categories", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await listCategories(true) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Raise a ticket. */
router.post("/", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const subject = String(req.body?.subject || "").trim();
    const description = String(req.body?.description || "").trim();
    const category = String(req.body?.category || "").trim();
    if (!subject || !description) {
      return res.status(400).json({ success: false, error: "Subject and description are required" });
    }

    // Only accept a category that is currently on offer, so tickets cannot be
    // filed under a disabled or invented one.
    if (category) {
      const allowed = await listCategories(true);
      if (!allowed.some((c) => c.name === category)) {
        return res.status(400).json({ success: false, error: "Choose a valid category" });
      }
    }

    const ticket = await createTicket({ userId, subject, description, category, priority: req.body?.priority });
    res.json({ success: true, ticketId: ticket.ticketNumber, data: ticket });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** The signed-in trader's own tickets. */
router.get("/my", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    res.json({ success: true, data: await listTicketsForUser(userId) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * One ticket with its replies. Scoped to the caller — the previous
 * `/:userId` route let any signed-in user read another user's tickets.
 */
router.get("/ticket/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });
    const ticket = await getTicket(String(req.params.id), userId);
    if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
    res.json({ success: true, data: ticket });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Trader replies to their own ticket. */
router.post("/ticket/:id/reply", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ success: false, error: "Message is required" });

    const owned = await getTicket(String(req.params.id), userId);
    if (!owned) return res.status(404).json({ success: false, error: "Ticket not found" });

    const updated = await addReply({
      ticketId: String(req.params.id),
      authorType: "trader",
      authorId: userId,
      authorName: owned.traderName || "Trader",
      message,
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

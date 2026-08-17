/**
 * Public read of the promotional hero banners shown on the trader dashboard.
 *
 * Public by design, like GET /api/admin/style-settings: it is display-only
 * marketing content with no customer or credential data, and the dashboard
 * renders it before any per-user data has loaded. Writes are admin-only and
 * live under /api/admin/offers.
 */

import { Router, Request, Response } from "express";
import { ensureOfferBannersTable, listActiveOfferBanners } from "../lib/offer-banners.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    await ensureOfferBannersTable();
    res.json({ success: true, data: await listActiveOfferBanners() });
  } catch (error: any) {
    // A banner failure must never break the dashboard — return an empty list.
    console.error("[offers] list failed:", error?.message);
    res.json({ success: true, data: [] });
  }
});

export default router;

/**
 * Partner-facing IB endpoints.
 *
 * Every handler here previously returned a hardcoded stub - empty client and
 * commission lists, all-zero stats, and a referral link pointing at a domain
 * the platform does not own. They are now backed by the real tables (see
 * lib/ib.ts), so a partner sees the clients they actually referred and the
 * commission those clients actually generated.
 */

import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { query } from "../lib/database.js";
import { ensureIBTables, getIBSettings, matureCommissions, resolveCommissionRate } from "../lib/ib.js";

const router: Router = Router();

/** The caller's IB partner record, or null when they are not a partner. */
async function currentPartner(req: AuthRequest): Promise<any | null> {
  const userId = req.user?.id;
  if (!userId) return null;
  const rows = (await query(
    `SELECT p.*, l.name AS level_name, l.commission_rate AS level_rate
       FROM ib_partners p
       LEFT JOIN ib_levels l ON l.id = p.level_id
      WHERE p.user_id = $1
      LIMIT 1`,
    [userId]
  )) as any[];
  return rows[0] || null;
}

/**
 * Base URL for referral links.
 *
 * Configurable per deployment because the platform is white-labelled; falls
 * back to the requesting origin so a link is never emitted for a domain the
 * operator does not control.
 */
function referralBase(req: AuthRequest, configured: string | null): string {
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  const origin = req.get("origin") || req.get("referer");
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      /* fall through */
    }
  }
  return `${req.protocol}://${req.get("host") || "localhost"}`;
}

function notPartner(res: Response) {
  return res.status(404).json({ success: false, error: "You are not an approved IB partner" });
}

// Partner profile and current tier.
router.get("/profile", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const partner = await currentPartner(req);
    if (!partner) return notPartner(res);
    const rate = await resolveCommissionRate(partner);
    const settings = await getIBSettings();
    res.json({
      success: true,
      data: {
        ibId: partner.id,
        ibCode: partner.ib_code,
        name: partner.name,
        email: partner.email,
        status: partner.status,
        level: partner.level_name || null,
        commissionRate: rate,
        commissionModel: settings.commission_model,
        createdAt: partner.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clients referred by this partner.
router.get("/clients", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const partner = await currentPartner(req);
    if (!partner) return notPartner(res);
    const rows = await query(
      `SELECT c.id, c.client_user_id, c.status, c.lifetime_volume, c.lifetime_commission, c.created_at,
              u.email, u.first_name, u.last_name
         FROM ib_clients c
         LEFT JOIN users u ON u.id::text = c.client_user_id
        WHERE c.ib_id = $1
        ORDER BY c.created_at DESC`,
      [partner.id]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/clients/:clientId", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const partner = await currentPartner(req);
    if (!partner) return notPartner(res);
    const rows = (await query(
      `SELECT c.*, u.email, u.first_name, u.last_name
         FROM ib_clients c
         LEFT JOIN users u ON u.id::text = c.client_user_id
        WHERE c.id = $1 AND c.ib_id = $2
        LIMIT 1`,
      [req.params.clientId, partner.id]
    )) as any[];
    if (rows.length === 0) return res.status(404).json({ success: false, error: "Client not found" });
    res.json({ success: true, data: rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commission ledger for this partner.
router.get("/commissions", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const partner = await currentPartner(req);
    if (!partner) return notPartner(res);
    await matureCommissions();
    const rows = await query(
      `SELECT m.id, m.trade_id, m.symbol, m.volume, m.rate, m.model, m.amount, m.status,
              m.matures_at, m.paid_at, m.created_at, u.email AS client_email
         FROM ib_commissions m
         LEFT JOIN users u ON u.id::text = m.client_user_id
        WHERE m.ib_id = $1
        ORDER BY m.created_at DESC
        LIMIT 500`,
      [partner.id]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Headline numbers for the partner dashboard.
router.get("/stats", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const partner = await currentPartner(req);
    if (!partner) return notPartner(res);
    await matureCommissions();
    const [agg] = (await query(
      `SELECT COALESCE(SUM(amount), 0) AS total,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN status = 'matured' THEN amount ELSE 0 END), 0) AS available,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid,
              COALESCE(SUM(volume), 0) AS volume
         FROM ib_commissions WHERE ib_id = $1`,
      [partner.id]
    )) as any[];
    const [clients] = (await query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active
         FROM ib_clients WHERE ib_id = $1`,
      [partner.id]
    )) as any[];
    res.json({
      success: true,
      data: {
        totalClients: Number(clients?.total || 0),
        activeClients: Number(clients?.active || 0),
        totalCommission: Number(agg?.total || 0),
        pendingCommission: Number(agg?.pending || 0),
        availableCommission: Number(agg?.available || 0),
        paidCommission: Number(agg?.paid || 0),
        totalVolume: Number(agg?.volume || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Request payout of matured commission.
 *
 * Only 'matured' rows are payable: 'pending' ones are still inside the
 * configured commission delay. The update is guarded on status so two
 * concurrent requests cannot withdraw the same commission twice.
 */
router.post("/withdraw", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const partner = await currentPartner(req);
    if (!partner) return notPartner(res);
    await matureCommissions();

    const paid = (await query(
      `UPDATE ib_commissions
          SET status = 'paid', paid_at = NOW()
        WHERE ib_id = $1 AND status = 'matured'
        RETURNING amount`,
      [partner.id]
    )) as any[];

    if (paid.length === 0) {
      return res.status(400).json({ success: false, error: "No matured commission available to withdraw" });
    }

    const total = paid.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const { syncPartnerCounters } = await import("../lib/ib.js");
    await syncPartnerCounters(partner.id);

    res.json({
      success: true,
      message: `Withdrawal recorded for ${paid.length} commission entr${paid.length === 1 ? "y" : "ies"}`,
      data: { amount: Math.round(total * 100) / 100, entries: paid.length },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// The partner's referral link. The code is their existing unique ib_code.
router.get("/referral-link", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const partner = await currentPartner(req);
    if (!partner) return notPartner(res);
    const settings = await getIBSettings();
    const base = referralBase(req, settings.referral_base_url);
    res.json({
      success: true,
      data: {
        code: partner.ib_code,
        referralLink: `${base}/register?ref=${encodeURIComponent(partner.ib_code)}`,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

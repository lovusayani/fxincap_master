/**
 * Authorization middleware.
 *
 * Before this existed, every /api/admin/* route was protected by `verifyToken`
 * alone — the *user* authentication middleware. It proves identity, never role,
 * so any ordinary customer's JWT was accepted on endpoints that can change
 * balances, reset passwords and impersonate traders.
 *
 * See docs/SECURITY.md §1 and docs/AUTHENTICATION.md §4.
 */

import crypto from "crypto";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../routes/auth.js";
import { query } from "../lib/database.js";
import { INTERNAL_SERVICE_TOKEN } from "../lib/env.js";

/**
 * Requires the caller to be an active administrator.
 *
 * Two independent checks, both must pass:
 *  1. the JWT claims `role: "admin"` — issued only by /api/admin-auth/login
 *     (see services/adminAuth.ts), never by the user login route;
 *  2. the subject still exists in `admin_users` with status 'active' — so a
 *     revoked or suspended admin cannot keep using a token that has not expired.
 *
 * Check 2 is what makes this safe: the role claim alone would trust the token.
 *
 * Must run after `verifyToken`, which populates req.user.
 */
export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  if (req.user?.role !== "admin") {
    res.status(403).json({ success: false, error: "Administrator privileges required" });
    return;
  }

  try {
    const rows = (await query(
      `SELECT id, status FROM admin_users WHERE id = $1 LIMIT 1`,
      [userId]
    )) as any[];

    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn(`[authz] admin role claimed but no admin_users row for subject ${userId}`);
      res.status(403).json({ success: false, error: "Administrator privileges required" });
      return;
    }

    const status = String(rows[0].status || "").toLowerCase();
    if (status !== "active") {
      res.status(403).json({ success: false, error: `Administrator account is ${status}` });
      return;
    }

    next();
  } catch (error) {
    // Fail closed: an authorization check that cannot complete must deny.
    console.error("[authz] requireAdmin lookup failed:", error);
    res.status(503).json({ success: false, error: "Authorization check unavailable" });
  }
}

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Requires a valid internal service token.
 *
 * Guards the trade-maintenance endpoints (price updates, SL/TP execution) that
 * mutate financial state and are called by trusted server-side processes, never
 * by a browser. Presented as `x-internal-token`.
 *
 * An active administrator is also accepted so the operations remain usable from
 * the back office for support purposes.
 */
export async function requireInternalService(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const presented = req.headers["x-internal-token"];
  const token = presented == null ? "" : String(presented).trim();

  if (token && INTERNAL_SERVICE_TOKEN && timingSafeEquals(token, INTERNAL_SERVICE_TOKEN)) {
    next();
    return;
  }

  // Fall back to administrator credentials when no service token was presented.
  if (req.user?.id) {
    await requireAdmin(req, res, next);
    return;
  }

  res.status(401).json({
    success: false,
    error: "Internal service token or administrator credentials required",
  });
}

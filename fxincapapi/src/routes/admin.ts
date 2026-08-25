import { Router, Response, Request } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRequest, verifyToken } from "./auth.js";
import { fetchUserById, fetchUsers, countUsers, deleteUserIfEligible } from "../services/adminUsers.js";
import { fetchFundRequests, updateFundRequestStatus, fetchFundRequestById, completeDepositAndCredit, completeWithdrawalAndDebit, rejectWithdrawalAndCredit } from "../services/adminFunds.js";
import { fetchKycDocuments, fetchKycDocumentById, updateKycStatus } from "../services/adminKyc.js";
import { getAutoCloseTimeoutMinutes, setAutoCloseTimeoutMinutes } from "../lib/trade-settings.js";
import { ensureAccountTypesTable } from "../lib/account-types.js";
import {
  ensureSymbolSpreadsTable,
  listSymbolSpreads,
  upsertSymbolSpread,
  deleteSymbolSpread,
} from "../lib/symbol-spreads.js";
import {
  closeTrade,
  createTrade,
  validateTradeOpen,
  getRequiredMargin,
  lockBalance,
  unlockBalance,
  resolveActiveAccountId,
} from "../lib/trading-engine.js";
import { getSettlementPrice } from "../lib/market-price.js";
import {
  ensureOfferBannersTable,
  listOfferBanners,
  createOfferBanner,
  updateOfferBanner,
  deleteOfferBanner,
} from "../lib/offer-banners.js";
import { getConnection, query } from "../lib/database.js";
import { JWT_SECRET } from "../lib/env.js";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { imageSizeFromFile } from "image-size/fromFile";
import { getStoredEmailSettings, maskEmailApiKey, saveStoredEmailSettings } from "../lib/email-settings.js";
import { getNotificationSettings, saveNotificationSettings } from "../lib/notificationSettings.js";
import { getEmailBranding, saveEmailBranding, EMAIL_BRANDING_DEFAULTS } from "../lib/emailBranding.js";
import {
  getEmailProvider,
  getStoredSmtpSettings,
  maskSmtpPassword,
  saveStoredSmtpSettings,
  setEmailProvider,
} from "../lib/smtp-settings.js";
import { sendEmail } from "../lib/mailer.js";
import {
  ensureIBTables,
  getIBSettings,
  matureCommissions,
  syncPartnerCounters,
} from "../lib/ib.js";

const __adminFilename = fileURLToPath(import.meta.url);
const __adminDirname = path.dirname(__adminFilename);

const logoUploadDir = path.join(__adminDirname, "../../uploads/logos");
const logoSettingsPath = path.join(logoUploadDir, "logo-settings.json");
if (!fs.existsSync(logoUploadDir)) {
  fs.mkdirSync(logoUploadDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, logoUploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `logo-${unique}${path.extname(file.originalname)}`);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/png") return cb(null, true);
    cb(new Error("Only PNG files are allowed"));
  },
});

/* Offer banner uploads — same disk-storage pattern as logos, own directory. */
const offerUploadDir = path.join(__adminDirname, "../../uploads/offers");
if (!fs.existsSync(offerUploadDir)) {
  fs.mkdirSync(offerUploadDir, { recursive: true });
}

const uploadOfferImage = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, offerUploadDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `offer-${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Wider than the logo filter: hero art is commonly JPEG or WebP.
    if (/^image\/(png|jpeg|jpg|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only PNG, JPEG, WebP or GIF images are allowed"));
  },
});

/** Only removes files we own, so a bad row cannot delete something else. */
const resolveOfferFilePath = (imageUrl: string | null | undefined) => {
  const normalized = String(imageUrl || "").trim();
  if (!normalized.startsWith("/uploads/offers/")) return null;
  return path.join(offerUploadDir, path.basename(normalized));
};

const logoDimensionsByType: Record<string, { width: number; height: number }> = {
  light: { width: 162, height: 52 },
  dark: { width: 162, height: 52 },
  square: { width: 64, height: 64 },
};

const resolveLogoFilePath = (logoUrl: string | null | undefined) => {
  const normalized = String(logoUrl || "").trim();
  if (!normalized.startsWith("/uploads/logos/")) return null;
  const fileName = path.basename(normalized);
  return path.join(logoUploadDir, fileName);
};

const toPublicLogoUrl = (req: Request, logoUrl: string | null | undefined) => {
  const normalized = String(logoUrl || "").trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  if (!host) return normalized;

  return `${protocol}://${host}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
};

const removeLogoFileByUrl = (logoUrl: string | null | undefined) => {
  const filePath = resolveLogoFilePath(logoUrl);
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best effort cleanup only.
  }
};

type LogoSettings = {
  light: string | null;
  dark: string | null;
  square: string | null;
};

const getStoredLogoSettings = (): LogoSettings => {
  try {
    if (!fs.existsSync(logoSettingsPath)) {
      return { light: null, dark: null, square: null };
    }

    const raw = fs.readFileSync(logoSettingsPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      light: typeof parsed?.light === "string" ? parsed.light : null,
      dark: typeof parsed?.dark === "string" ? parsed.dark : null,
      square: typeof parsed?.square === "string" ? parsed.square : null,
    };
  } catch {
    return { light: null, dark: null, square: null };
  }
};

const saveStoredLogoSettings = (nextSettings: LogoSettings) => {
  fs.writeFileSync(logoSettingsPath, JSON.stringify(nextSettings, null, 2), "utf8");
};

const router: Router = Router();

const ensureUserAccountSettingsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS user_account_settings (
      id SERIAL PRIMARY KEY,
      real_account_activation_enabled BOOLEAN DEFAULT TRUE,
      kyc_required_for_real_account BOOLEAN DEFAULT TRUE
    )
  `);

  await query(
    `INSERT INTO user_account_settings (id, real_account_activation_enabled, kyc_required_for_real_account)
     SELECT 1, TRUE, TRUE
     WHERE NOT EXISTS (SELECT 1 FROM user_account_settings WHERE id = 1)`
  );
};

const getUserAccountSettings = async () => {
  await ensureUserAccountSettingsTable();
  const rows = await query(
    "SELECT real_account_activation_enabled, kyc_required_for_real_account FROM user_account_settings WHERE id = 1 LIMIT 1"
  ) as any[];

  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  return {
    realAccountActivationEnabled: row?.real_account_activation_enabled !== false,
    kycRequiredForRealAccount: row?.kyc_required_for_real_account !== false,
  };
};

const quoteIdentifier = (value: string) => `\`${String(value).replace(/`/g, "") }\``;
const tableNamePattern = /^[A-Za-z0-9_]+$/;

const extractTableNames = (rows: any[], excluded: string[] = []) => {
  const excludedSet = new Set(excluded);
  return (Array.isArray(rows) ? rows : [])
    .map((row: any) => row?.tableName ?? row?.table_name ?? row?.TABLE_NAME)
    .filter((name: any) => typeof name === "string" && tableNamePattern.test(name))
    .filter((name: string) => !excludedSet.has(name));
};

// Get all users
router.get("/users", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const page = Number(req.query.page) || 1;
    const offset = page > 1 ? (page - 1) * limit : 0;
    const search = (req.query.search as string) || undefined;
    const status = (req.query.status as string) || undefined;

    const [users, total] = await Promise.all([
      fetchUsers({ limit, offset, search, status }),
      countUsers({ search, status }),
    ]);
    res.json({ success: true, data: users, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user details
router.get("/users/:userId", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await fetchUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user
router.put("/users/:userId", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ success: true });
});

// Delete user
router.delete("/users/:userId", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await deleteUserIfEligible(req.params.userId);
    if (!result.success) {
      return res.status(409).json({
        success: false,
        error: result.assessment.reason || 'User cannot be deleted',
        data: result.assessment,
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
      user: result.user,
      deleted: result.deleted,
    });
  } catch (error: any) {
    if (error?.message === 'User not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to delete user' });
  }
});

// Get fund requests
router.get("/funds", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const page = Number(req.query.page) || 1;
    const offset = page > 1 ? (page - 1) * limit : 0;
    const status = (req.query.status as string) || "pending";
    const type = (req.query.type as string) || "deposit";
    const search = (req.query.search as string) || undefined;

    const data = await fetchFundRequests({ limit, offset, status, type, search });
    res.json({ success: true, data, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single fund request
router.get("/funds/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = await fetchFundRequestById(id);
    if (!data) {
      return res.status(404).json({ success: false, error: "Fund request not found" });
    }
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve fund request
router.put("/funds/:requestId/approve", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    
    // Fetch the fund request to determine type
    const fundData = await fetchFundRequestById(requestId);
    if (!fundData) {
      return res.status(404).json({ success: false, error: "Fund request not found" });
    }

    let result;
    if (fundData.type === "deposit") {
      result = await completeDepositAndCredit(requestId);
    } else if (fundData.type === "withdrawal") {
      result = await completeWithdrawalAndDebit(requestId);
    } else {
      return res.status(400).json({ success: false, error: "Unknown fund type" });
    }

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason || "Update failed" });
    }
    res.json({ success: true, accountId: result.accountId, balanceAfter: result.balanceAfter });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.put("/funds/:requestId/reject", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    
    // Fetch the fund request to determine type
    const fundData = await fetchFundRequestById(requestId);
    if (!fundData) {
      return res.status(404).json({ success: false, error: "Fund request not found" });
    }

    let result;
    if (fundData.type === "withdrawal") {
      // Where the refund goes depends on where the money was taken from.
      // Wallet-era withdrawals have a `withdrawal_details` row and were debited
      // from the withdrawal wallet; legacy ones were debited from the trading
      // account. Refunding to the wrong place would either strand the funds or
      // credit a trading account that never paid.
      const { ensureWalletTables, refundWithdrawalToWallet } = await import("../lib/wallet.js");
      await ensureWalletTables();
      const detail = await query(
        `SELECT fund_request_id FROM withdrawal_details WHERE fund_request_id = ? LIMIT 1`,
        [requestId]
      );

      if (detail.length > 0) {
        const refund = await refundWithdrawalToWallet(requestId);
        if (!refund.success) {
          return res.status(400).json({ success: false, error: refund.error || "Refund failed" });
        }
        result = { success: true } as any;
      } else {
        result = await rejectWithdrawalAndCredit(requestId);
      }
    } else {
      // For deposits, just update status
      const ok = await updateFundRequestStatus(requestId, "rejected");
      if (!ok) return res.status(400).json({ success: false, error: "Update failed" });
      result = { success: true };
    }

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason || "Update failed" });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// KYC documents list
router.get("/kyc-documents", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const page = Number(req.query.page) || 1;
    const offset = page > 1 ? (page - 1) * limit : 0;
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const data = await fetchKycDocuments({ limit, offset, status, search });
    res.json({ success: true, data, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Single KYC document
router.get("/kyc-documents/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await fetchKycDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: "KYC document not found" });
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve KYC document
router.put("/kyc-documents/:id/approve", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await updateKycStatus(req.params.id, "approved");
    if (!ok) return res.status(400).json({ success: false, error: "Update failed" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject KYC document
router.put("/kyc-documents/:id/reject", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const ok = await updateKycStatus(req.params.id, "rejected");
    if (!ok) return res.status(400).json({ success: false, error: "Update failed" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get analytics
router.get("/analytics", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json({ totalUsers: 0, totalDeposits: 0, totalWithdrawals: 0 });
});

/**
 * Dashboard summary — every figure the admin landing page shows, in one call.
 *
 * Deliberately one round trip rather than a dozen: the page renders all of it
 * at once, and separate endpoints would make the dashboard the slowest screen
 * in the panel. `days` bounds the time series (default 14, max 90).
 */
router.get("/dashboard-stats", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);

    // Run in small batches rather than one big Promise.all: the managed database
    // caps total connections, and fanning out every query at once could claim
    // the whole pool and starve concurrent requests.
    const runBatched = async <T,>(factories: Array<() => Promise<T>>, size = 3): Promise<T[]> => {
      const out: T[] = [];
      for (let i = 0; i < factories.length; i += size) {
        out.push(...(await Promise.all(factories.slice(i, i + size).map((fn) => fn()))));
      }
      return out;
    };

    const [
      traderRows,
      accountRows,
      fundRows,
      tradeRows,
      pendingRows,
      fundSeriesRows,
      tradeSeriesRows,
      latestTradeRows,
      topSymbolRows,
      signupSeriesRows,
    ] = await runBatched([
      () => query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS new_30d,
          SUM(CASE WHEN email_verified THEN 1 ELSE 0 END) AS verified
        FROM users
      `),
      () => query(`
        SELECT
          COUNT(*) FILTER (WHERE trading_mode = 'real') AS real_accounts,
          COUNT(*) FILTER (WHERE trading_mode = 'demo') AS demo_accounts,
          COALESCE(SUM(balance) FILTER (WHERE trading_mode = 'real'), 0) AS real_balance,
          COALESCE(SUM(balance) FILTER (WHERE trading_mode = 'demo'), 0) AS demo_balance,
          COALESCE(SUM(locked_balance) FILTER (WHERE trading_mode = 'real'), 0) AS locked_balance
        FROM user_accounts
      `),
      () => query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'    AND status = 'completed'), 0) AS deposit_total,
          COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal' AND status = 'completed'), 0) AS withdrawal_total,
          COUNT(*) FILTER (WHERE type = 'deposit'    AND status = 'completed') AS deposit_count,
          COUNT(*) FILTER (WHERE type = 'withdrawal' AND status = 'completed') AS withdrawal_count
        FROM fund_requests
      `),
      () => query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'OPEN')   AS open_trades,
          COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_trades,
          COALESCE(SUM(locked_balance) FILTER (WHERE status = 'OPEN'), 0) AS margin_locked
        FROM trades
      `),
      () => query(`
        SELECT
          COUNT(*) FILTER (WHERE type = 'deposit')    AS pending_deposits,
          COUNT(*) FILTER (WHERE type = 'withdrawal') AS pending_withdrawals,
          COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'), 0)    AS pending_deposit_amount,
          COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0) AS pending_withdrawal_amount
        FROM fund_requests
        WHERE status IN ('pending', 'processing')
      `),
      // Series are generated off a date spine so quiet days render as zero
      // instead of collapsing the chart's x-axis.
      () => query(`
        SELECT
          to_char(d.day, 'YYYY-MM-DD') AS day,
          COALESCE(SUM(fr.amount) FILTER (WHERE fr.type = 'deposit'), 0)    AS deposits,
          COALESCE(SUM(fr.amount) FILTER (WHERE fr.type = 'withdrawal'), 0) AS withdrawals
        FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day') AS d(day)
        LEFT JOIN fund_requests fr
          ON fr.created_at::date = d.day AND fr.status = 'completed'
        GROUP BY d.day
        ORDER BY d.day
      `, [days]),
      () => query(`
        SELECT
          to_char(d.day, 'YYYY-MM-DD') AS day,
          COUNT(th.id) AS trades,
          COALESCE(SUM(th.profit), 0) AS pnl
        FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day') AS d(day)
        LEFT JOIN trade_history th ON th.close_time::date = d.day
        GROUP BY d.day
        ORDER BY d.day
      `, [days]),
      () => query(`
        SELECT th.id, th.symbol, th.side, th.volume, th.open_price, th.close_price,
               th.profit, th.close_time,
               u.first_name, u.last_name, u.email,
               ua.account_number
          FROM trade_history th
          LEFT JOIN users u ON u.id = th.user_id
          LEFT JOIN user_accounts ua ON ua.id = th.account_id
         ORDER BY th.close_time DESC NULLS LAST
         LIMIT 10
      `),
      () => query(`
        SELECT symbol,
               COUNT(*) AS trades,
               COALESCE(SUM(profit), 0) AS pnl,
               COUNT(*) FILTER (WHERE profit >= 0) AS wins
          FROM trade_history
         GROUP BY symbol
         ORDER BY trades DESC
         LIMIT 6
      `),
      () => query(`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(u.id) AS signups
        FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, '1 day') AS d(day)
        LEFT JOIN users u ON u.created_at::date = d.day
        GROUP BY d.day
        ORDER BY d.day
      `, [days]),
    ]) as any[][];

    const first = (rows: any[]) => (Array.isArray(rows) && rows[0]) || {};
    const t = first(traderRows);
    const a = first(accountRows);
    const f = first(fundRows);
    const tr = first(tradeRows);
    const p = first(pendingRows);

    const closedTrades = Number(tr.closed_trades || 0);
    const winRows = await query(
      `SELECT COUNT(*) FILTER (WHERE profit >= 0) AS wins, COUNT(*) AS total FROM trade_history`
    ) as any[];
    const w = first(winRows);

    res.json({
      success: true,
      data: {
        traders: {
          total: Number(t.total || 0),
          active: Number(t.active || 0),
          verified: Number(t.verified || 0),
          new30d: Number(t.new_30d || 0),
        },
        accounts: {
          real: Number(a.real_accounts || 0),
          demo: Number(a.demo_accounts || 0),
          realBalance: Number(a.real_balance || 0),
          demoBalance: Number(a.demo_balance || 0),
          lockedBalance: Number(a.locked_balance || 0),
        },
        funds: {
          depositTotal: Number(f.deposit_total || 0),
          withdrawalTotal: Number(f.withdrawal_total || 0),
          depositCount: Number(f.deposit_count || 0),
          withdrawalCount: Number(f.withdrawal_count || 0),
          netFlow: Number(f.deposit_total || 0) - Number(f.withdrawal_total || 0),
        },
        trades: {
          open: Number(tr.open_trades || 0),
          closed: closedTrades,
          marginLocked: Number(tr.margin_locked || 0),
          wins: Number(w.wins || 0),
          totalHistory: Number(w.total || 0),
          winRate: Number(w.total || 0) > 0
            ? (Number(w.wins || 0) / Number(w.total || 0)) * 100
            : 0,
        },
        pending: {
          deposits: Number(p.pending_deposits || 0),
          withdrawals: Number(p.pending_withdrawals || 0),
          depositAmount: Number(p.pending_deposit_amount || 0),
          withdrawalAmount: Number(p.pending_withdrawal_amount || 0),
        },
        series: {
          days,
          funds: (fundSeriesRows || []).map((r: any) => ({
            day: r.day,
            deposits: Number(r.deposits || 0),
            withdrawals: Number(r.withdrawals || 0),
          })),
          trades: (tradeSeriesRows || []).map((r: any) => ({
            day: r.day,
            trades: Number(r.trades || 0),
            pnl: Number(r.pnl || 0),
          })),
          signups: (signupSeriesRows || []).map((r: any) => ({
            day: r.day,
            signups: Number(r.signups || 0),
          })),
        },
        latestTrades: (latestTradeRows || []).map((r: any) => ({
          id: r.id,
          symbol: r.symbol,
          side: String(r.side || "").toUpperCase(),
          volume: Number(r.volume || 0),
          openPrice: Number(r.open_price || 0),
          closePrice: Number(r.close_price || 0),
          profit: Number(r.profit || 0),
          closeTime: r.close_time,
          traderName: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
          traderEmail: r.email || null,
          accountNumber: r.account_number || null,
        })),
        topSymbols: (topSymbolRows || []).map((r: any) => ({
          symbol: r.symbol,
          trades: Number(r.trades || 0),
          pnl: Number(r.pnl || 0),
          wins: Number(r.wins || 0),
        })),
      },
    });
  } catch (error: any) {
    console.error("[ADMIN] dashboard-stats failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get reports
router.get("/reports", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([]);
});

/** Shared date-window parser for the report endpoints. Empty = no bound. */
function reportDateRange(req: AuthRequest) {
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  return { from: valid(from) ? from : null, to: valid(to) ? to : null };
}

/**
 * Transactions report — the money-movement ledger (deposits + withdrawals)
 * with filters and summary totals. Distinct from /wallet-report, which lists
 * current per-user balances rather than the movements behind them.
 */
router.get("/reports/transactions", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = reportDateRange(req);
    const type = String(req.query.type || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

    const where: string[] = [];
    const values: any[] = [];
    if (from) { where.push("fr.created_at >= ?::date"); values.push(from); }
    if (to) { where.push("fr.created_at < (?::date + 1)"); values.push(to); }
    if (type === "deposit" || type === "withdrawal") { where.push("fr.type = ?"); values.push(type); }
    if (status) { where.push("fr.status = ?"); values.push(status); }
    if (search) {
      const like = `%${search}%`;
      where.push("(u.email ILIKE ? OR u.first_name ILIKE ? OR u.last_name ILIKE ? OR fr.reference_number ILIKE ?)");
      values.push(like, like, like, like);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows, summaryRows] = await Promise.all([
      query(
        `SELECT fr.id, fr.type, fr.amount, fr.status, fr.method, fr.reference_number,
                fr.created_at, fr.completed_at,
                u.email, u.first_name, u.last_name,
                ua.account_number, ua.trading_mode
           FROM fund_requests fr
           LEFT JOIN users u ON u.id = fr.user_id
           LEFT JOIN user_accounts ua ON ua.id = fr.account_id
           ${whereClause}
          ORDER BY fr.created_at DESC
          LIMIT ${limit}`,
        values
      ),
      query(
        `SELECT
           COALESCE(SUM(fr.amount) FILTER (WHERE fr.type='deposit'    AND fr.status='completed'), 0) AS deposits,
           COALESCE(SUM(fr.amount) FILTER (WHERE fr.type='withdrawal' AND fr.status='completed'), 0) AS withdrawals,
           COALESCE(SUM(fr.amount) FILTER (WHERE fr.status IN ('pending','processing')), 0) AS pending_amount,
           COUNT(*) AS total_rows,
           COUNT(*) FILTER (WHERE fr.status='completed') AS completed_count,
           COUNT(*) FILTER (WHERE fr.status IN ('pending','processing')) AS pending_count,
           COUNT(*) FILTER (WHERE fr.status='rejected') AS rejected_count
         FROM fund_requests fr
         LEFT JOIN users u ON u.id = fr.user_id
         ${whereClause}`,
        values
      ),
    ]) as any[][];

    const s = (Array.isArray(summaryRows) && summaryRows[0]) || {};
    res.json({
      success: true,
      data: {
        rows: (rows || []).map((r: any) => ({
          id: r.id,
          type: r.type,
          amount: Number(r.amount || 0),
          status: r.status,
          method: r.method || null,
          reference: r.reference_number || null,
          createdAt: r.created_at,
          completedAt: r.completed_at,
          traderName: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
          traderEmail: r.email || null,
          accountNumber: r.account_number || null,
          tradingMode: r.trading_mode || null,
        })),
        summary: {
          deposits: Number(s.deposits || 0),
          withdrawals: Number(s.withdrawals || 0),
          net: Number(s.deposits || 0) - Number(s.withdrawals || 0),
          pendingAmount: Number(s.pending_amount || 0),
          totalRows: Number(s.total_rows || 0),
          completedCount: Number(s.completed_count || 0),
          pendingCount: Number(s.pending_count || 0),
          rejectedCount: Number(s.rejected_count || 0),
        },
      },
    });
  } catch (error: any) {
    console.error("[ADMIN] reports/transactions failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Balance sheet — the platform's financial position: what is owed to clients,
 * what came in, what went out, and how it breaks down by account type.
 */
router.get("/reports/balance-sheet", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const [positionRows, fundRows, tradeRows, byTypeRows, byModeRows] = await Promise.all([
      query(`
        SELECT
          COALESCE(SUM(balance)           FILTER (WHERE trading_mode='real'), 0) AS real_balance,
          COALESCE(SUM(balance)           FILTER (WHERE trading_mode='demo'), 0) AS demo_balance,
          COALESCE(SUM(equity)            FILTER (WHERE trading_mode='real'), 0) AS real_equity,
          COALESCE(SUM(locked_balance)    FILTER (WHERE trading_mode='real'), 0) AS locked,
          COALESCE(SUM(available_balance) FILTER (WHERE trading_mode='real'), 0) AS available,
          COUNT(*) FILTER (WHERE trading_mode='real') AS real_accounts,
          COUNT(*) FILTER (WHERE trading_mode='demo') AS demo_accounts
        FROM user_accounts
      `),
      query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type='deposit'    AND status='completed'), 0) AS deposits,
          COALESCE(SUM(amount) FILTER (WHERE type='withdrawal' AND status='completed'), 0) AS withdrawals,
          COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','processing')), 0) AS pending
        FROM fund_requests
      `),
      query(`
        SELECT
          COALESCE(SUM(profit), 0) AS realised_pnl,
          COALESCE(SUM(commission), 0) AS commission,
          COUNT(*) AS closed_trades
        FROM trade_history
      `),
      query(`
        SELECT COALESCE(at.name, 'Unassigned') AS account_type,
               COUNT(ua.id) AS accounts,
               COALESCE(SUM(ua.balance), 0) AS balance,
               COALESCE(SUM(ua.locked_balance), 0) AS locked
          FROM user_accounts ua
          LEFT JOIN account_types at ON at.id = ua.account_type_id
         WHERE ua.trading_mode = 'real'
         GROUP BY COALESCE(at.name, 'Unassigned')
         ORDER BY balance DESC
      `),
      query(`
        SELECT trading_mode,
               COUNT(*) AS accounts,
               COALESCE(SUM(balance), 0) AS balance
          FROM user_accounts
         GROUP BY trading_mode
      `),
    ]) as any[][];

    const p = (Array.isArray(positionRows) && positionRows[0]) || {};
    const f = (Array.isArray(fundRows) && fundRows[0]) || {};
    const t = (Array.isArray(tradeRows) && tradeRows[0]) || {};

    const deposits = Number(f.deposits || 0);
    const withdrawals = Number(f.withdrawals || 0);
    const clientFunds = Number(p.real_balance || 0);

    res.json({
      success: true,
      data: {
        clientFunds: {
          realBalance: clientFunds,
          demoBalance: Number(p.demo_balance || 0),
          realEquity: Number(p.real_equity || 0),
          locked: Number(p.locked || 0),
          available: Number(p.available || 0),
          realAccounts: Number(p.real_accounts || 0),
          demoAccounts: Number(p.demo_accounts || 0),
        },
        cashFlow: {
          deposits,
          withdrawals,
          net: deposits - withdrawals,
          pending: Number(f.pending || 0),
        },
        trading: {
          realisedPnl: Number(t.realised_pnl || 0),
          commission: Number(t.commission || 0),
          closedTrades: Number(t.closed_trades || 0),
        },
        // Net inflow minus what clients currently hold — positive means client
        // losses have accrued to the platform, negative means client gains.
        platformPosition: deposits - withdrawals - clientFunds,
        byAccountType: (byTypeRows || []).map((r: any) => ({
          accountType: r.account_type,
          accounts: Number(r.accounts || 0),
          balance: Number(r.balance || 0),
          locked: Number(r.locked || 0),
        })),
        byMode: (byModeRows || []).map((r: any) => ({
          mode: r.trading_mode,
          accounts: Number(r.accounts || 0),
          balance: Number(r.balance || 0),
        })),
      },
    });
  } catch (error: any) {
    console.error("[ADMIN] reports/balance-sheet failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Trading report — closed-trade performance grouped by symbol or by trader.
 */
router.get("/reports/trading", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = reportDateRange(req);
    const groupBy = String(req.query.groupBy || "symbol").trim().toLowerCase() === "trader" ? "trader" : "symbol";

    const where: string[] = [];
    const values: any[] = [];
    if (from) { where.push("th.close_time >= ?::date"); values.push(from); }
    if (to) { where.push("th.close_time < (?::date + 1)"); values.push(to); }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const groupExpr = groupBy === "trader"
      ? "COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''), u.email, 'Unknown')"
      : "th.symbol";

    const [rows, summaryRows] = await Promise.all([
      query(
        `SELECT ${groupExpr} AS label,
                COUNT(*) AS trades,
                COALESCE(SUM(th.volume), 0) AS volume,
                COALESCE(SUM(th.profit), 0) AS pnl,
                COUNT(*) FILTER (WHERE th.profit >= 0) AS wins,
                COUNT(*) FILTER (WHERE th.profit < 0) AS losses,
                COALESCE(AVG(th.profit), 0) AS avg_pnl,
                COALESCE(MAX(th.profit), 0) AS best,
                COALESCE(MIN(th.profit), 0) AS worst
           FROM trade_history th
           LEFT JOIN users u ON u.id = th.user_id
           ${whereClause}
          GROUP BY ${groupExpr}
          ORDER BY trades DESC
          LIMIT 100`,
        values
      ),
      query(
        `SELECT COUNT(*) AS trades,
                COALESCE(SUM(th.volume), 0) AS volume,
                COALESCE(SUM(th.profit), 0) AS pnl,
                COUNT(*) FILTER (WHERE th.profit >= 0) AS wins
           FROM trade_history th
           LEFT JOIN users u ON u.id = th.user_id
           ${whereClause}`,
        values
      ),
    ]) as any[][];

    const s = (Array.isArray(summaryRows) && summaryRows[0]) || {};
    const totalTrades = Number(s.trades || 0);

    res.json({
      success: true,
      data: {
        groupBy,
        rows: (rows || []).map((r: any) => {
          const trades = Number(r.trades || 0);
          return {
            label: r.label,
            trades,
            volume: Number(r.volume || 0),
            pnl: Number(r.pnl || 0),
            wins: Number(r.wins || 0),
            losses: Number(r.losses || 0),
            winRate: trades > 0 ? (Number(r.wins || 0) / trades) * 100 : 0,
            avgPnl: Number(r.avg_pnl || 0),
            best: Number(r.best || 0),
            worst: Number(r.worst || 0),
          };
        }),
        summary: {
          trades: totalTrades,
          volume: Number(s.volume || 0),
          pnl: Number(s.pnl || 0),
          wins: Number(s.wins || 0),
          losses: totalTrades - Number(s.wins || 0),
          winRate: totalTrades > 0 ? (Number(s.wins || 0) / totalTrades) * 100 : 0,
        },
      },
    });
  } catch (error: any) {
    console.error("[ADMIN] reports/trading failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Wallet report for admin
router.get("/wallet-report", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const page = Number(req.query.page) || 1;
    const offset = page > 1 ? (page - 1) * limit : 0;
    const search = String(req.query.search || "").trim();

    const values: any[] = [];
    let whereClause = "";
    if (search) {
      const like = `%${search}%`;
      whereClause = "WHERE (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.id LIKE ?)";
      values.push(like, like, like, like);
    }

    const rows = await query(
      `SELECT
         u.id,
         u.email,
         u.first_name,
         u.last_name,
         ua.account_number,
         COALESCE(ua.balance, 0) AS real_balance,
         COALESCE(ua.equity, 0) AS equity,
         COALESCE(ua.margin_free, 0) AS margin_free,
         ua.currency,
         ua.account_status
       FROM users u
       LEFT JOIN user_accounts ua
         ON ua.user_id = u.id AND ua.trading_mode = 'real'
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ${Math.min(Math.max(1, limit), 200)} OFFSET ${Math.max(0, offset)}`,
      values
    );

    const totals = await query(
      `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
      values
    ) as any[];

    res.json({
      success: true,
      data: Array.isArray(rows) ? rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—",
        accountNumber: r.account_number || null,
        realBalance: Number(r.real_balance || 0),
        equity: Number(r.equity || 0),
        freeMargin: Number(r.margin_free || 0),
        currency: r.currency || "USD",
        status: r.account_status || "active",
      })) : [],
      total: Number(totals?.[0]?.total || 0),
      page,
      limit,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load wallet report" });
  }
});

// Update user's real wallet balance
router.put("/wallet-report/:userId/balance", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const nextBalance = Number(req.body?.balance);

    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      return res.status(400).json({ success: false, error: "Balance must be a non-negative number" });
    }

    const users = await query("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]) as any[];
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const existing = await query(
      "SELECT id, balance FROM user_accounts WHERE user_id = ? AND trading_mode = 'real' LIMIT 1",
      [userId]
    ) as any[];

    if (!Array.isArray(existing) || existing.length === 0) {
      const accountId = uuidv4();
      const accountNumber = `REAL-${String(userId).substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      await query(
        "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, available_balance, trading_mode, currency, account_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'real', 'USD', 'active')",
        [accountId, userId, accountNumber, nextBalance, nextBalance, nextBalance, nextBalance]
      );
      return res.json({ success: true, message: "Real wallet created and updated", previousBalance: 0, newBalance: nextBalance });
    }

    const previous = Number(existing[0].balance || 0);
    await query(
      "UPDATE user_accounts SET balance = ?, equity = ?, margin_free = ?, available_balance = ? WHERE id = ?",
      [nextBalance, nextBalance, nextBalance, nextBalance, existing[0].id]
    );

    res.json({ success: true, message: "Wallet balance updated", previousBalance: previous, newBalance: nextBalance });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to update wallet balance" });
  }
});

// ==========================================
// All trades for admin (from `trades` table)
// ==========================================
router.get("/trades", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const statusFilter = String(req.query.status || "").toUpperCase(); // OPEN | CLOSED | CANCELLED | ""
    const search = String(req.query.search || "");
    const from = req.query.from as string;
    const to = req.query.to as string;
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"))));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (statusFilter) {
      if (statusFilter === "OPEN") {
        conditions.push(`t.status = $${idx++}`);
        params.push("OPEN");
      } else if (statusFilter === "CLOSED") {
        conditions.push(`t.status IN ('CLOSED', 'CANCELLED')`);
      }
    }

    if (search) {
      conditions.push(`(t.symbol ILIKE $${idx} OR u.email ILIKE $${idx} OR u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (from) {
      conditions.push(`t.opened_at >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`t.opened_at <= $${idx++}`);
      params.push(to + " 23:59:59");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await query(`
      SELECT t.id, t.symbol, t.side, t.volume, t.entry_price, t.current_price,
             t.close_price, t.final_pnl, t.pnl, t.pnl_percentage,
             t.leverage, t.status, t.opened_at, t.closed_at, t.closing_reason,
             t.stop_loss, t.take_profit,
             u.email, u.first_name, u.last_name
      FROM trades t
      JOIN users u ON u.id = t.user_id
      ${where}
      ORDER BY t.opened_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, [...params, limit, offset]) as any[];

    const countRows = await query(`
      SELECT COUNT(*) as total FROM trades t
      JOIN users u ON u.id = t.user_id
      ${where}
    `, params) as any[];

    const total = Number(countRows?.[0]?.total || 0);

    // Stats (all matching, not paginated)
    const statsRows = await query(`
      SELECT
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE t.status = 'OPEN') as open_trades,
        COUNT(*) FILTER (WHERE t.status IN ('CLOSED','CANCELLED')) as closed_trades,
        COALESCE(SUM(CASE WHEN t.status IN ('CLOSED','CANCELLED') THEN t.final_pnl ELSE t.pnl END), 0) as total_profit
      FROM trades t
      JOIN users u ON u.id = t.user_id
      ${where}
    `, params) as any[];

    const s = statsRows?.[0] || {};

    res.json({
      success: true,
      data: (Array.isArray(rows) ? rows : []).map((t: any) => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        volume: Number(t.volume),
        openPrice: Number(t.entry_price),
        currentPrice: Number(t.current_price || t.entry_price),
        closePrice: t.close_price ? Number(t.close_price) : null,
        stopLoss: t.stop_loss ? Number(t.stop_loss) : null,
        takeProfit: t.take_profit ? Number(t.take_profit) : null,
        profit: Number(t.status === "OPEN" ? (t.pnl || 0) : (t.final_pnl || 0)),
        leverage: Number(t.leverage || 1),
        status: String(t.status || "").toLowerCase(),
        openTime: t.opened_at,
        closeTime: t.closed_at,
        closingReason: t.closing_reason,
        traderEmail: t.email,
        traderName: `${t.first_name || ""} ${t.last_name || ""}`.trim(),
      })),
      total,
      stats: {
        totalTrades: Number(s.total_trades || 0),
        openPositions: Number(s.open_trades || 0),
        closedTrades: Number(s.closed_trades || 0),
        totalProfit: Number(s.total_profit || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all positions (legacy stub kept for backward compat)
router.get("/positions", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([]);
});

// Style Settings endpoints
const normalizeShadcnTheme = (value: any) => {
  const raw = String(value || "").toLowerCase();
  if (raw === "nutral") return "neutral";
  if (["default", "neutral", "amber", "blue", "cyan", "pink"].includes(raw)) return raw;
  return "default";
};

const ensureStyleSettingsExtrasTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS style_settings_extras (
        id SERIAL PRIMARY KEY,
        shadcn_theme VARCHAR(32) DEFAULT 'default'
      )
    `);
  } catch {
    // Best effort only; API must still work even if DB permissions are limited.
  }
};

const ensureDepositOffersTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS deposit_offers (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      description TEXT NOT NULL,
      badge VARCHAR(64),
      active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const ensureStyleSettingsTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS style_settings (
      id SERIAL PRIMARY KEY,
      header_color VARCHAR(32) DEFAULT 'default',
      topbar_bg_color VARCHAR(32) DEFAULT 'default',
      theme_mode VARCHAR(16) DEFAULT 'default',
      platform_font_size VARCHAR(32) DEFAULT '16px',
      button_text_color VARCHAR(32) DEFAULT 'white',
      font_color_mode VARCHAR(16) DEFAULT 'auto',
      glossy_effect VARCHAR(16) DEFAULT 'on'
    )
  `);
};

// Generic key-value config table — app user always owns this (created fresh).
// Avoids ALTER TABLE on style_settings which may be owned by a different DB user.
const ensurePlatformConfigTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS platform_config (
        key   VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      )
    `);
  } catch {
    // Best effort — degrade gracefully if permissions are restricted.
  }
};

const getStoredPlatformName = async (): Promise<string> => {
  try {
    await ensurePlatformConfigTable();
    const rows = await query(`SELECT value FROM platform_config WHERE key = 'platform_name'`);
    return Array.isArray(rows) && rows.length > 0 ? (rows as any[])[0].value || "SuimFx" : "SuimFx";
  } catch {
    return "SuimFx";
  }
};

const saveStoredPlatformName = async (name: string): Promise<void> => {
  try {
    await ensurePlatformConfigTable();
    await query(
      `INSERT INTO platform_config (key, value) VALUES ('platform_name', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [name]
    );
  } catch {
    // Non-fatal — other settings still save normally.
  }
};

const getStoredShadcnTheme = async () => {
  try {
    await ensureStyleSettingsExtrasTable();
    const rows = await query("SELECT shadcn_theme FROM style_settings_extras ORDER BY id ASC LIMIT 1");
    const theme = Array.isArray(rows) && rows.length > 0 ? (rows as any[])[0].shadcn_theme : "default";
    return normalizeShadcnTheme(theme);
  } catch {
    return "default";
  }
};

const saveStoredShadcnTheme = async (theme: string) => {
  try {
    await ensureStyleSettingsExtrasTable();
    const existing = await query("SELECT id FROM style_settings_extras ORDER BY id ASC LIMIT 1");
    if (Array.isArray(existing) && existing.length > 0) {
      const existingId = (existing as any[])[0].id;
      await query("UPDATE style_settings_extras SET shadcn_theme = ? WHERE id = ?", [theme, existingId]);
    } else {
      await query("INSERT INTO style_settings_extras (shadcn_theme) VALUES (?)", [theme]);
    }
  } catch {
    // Ignore persistence failure and keep request successful for other settings.
  }
};

router.get("/email-settings", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const [mgSettings, smtpSettings, emailProvider] = await Promise.all([
      getStoredEmailSettings(),
      getStoredSmtpSettings(),
      getEmailProvider(),
    ]);
    res.json({
      success: true,
      data: {
        // Mailgun
        mailgunDomain: mgSettings.mailgunDomain || "",
        mailgunFrom: mgSettings.mailgunFrom || "",
        mailgunRegion: mgSettings.mailgunRegion,
        hasMailgunApiKey: Boolean(mgSettings.mailgunApiKey),
        maskedMailgunApiKey: maskEmailApiKey(mgSettings.mailgunApiKey),
        // SMTP
        smtpHost:           smtpSettings.smtpHost,
        smtpPort:           smtpSettings.smtpPort,
        smtpSecure:         smtpSettings.smtpSecure,
        smtpUser:           smtpSettings.smtpUser,
        smtpFrom:           smtpSettings.smtpFrom,
        hasSmtpPassword:    Boolean(smtpSettings.smtpPassword),
        maskedSmtpPassword: maskSmtpPassword(smtpSettings.smtpPassword),
        // Provider selector
        emailProvider,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load email settings" });
  }
});

router.post("/email-settings", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body ?? {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // A From header may carry a display name — "NcapFX <noreply@example.com>" —
    // which is what recipients actually see in their inbox, so accept both forms.
    const fromRegex = /^(?:[^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

    // --- Mailgun ---
    const mailgunFrom = String(body.mailgunFrom || "").trim();
    if (mailgunFrom && !fromRegex.test(mailgunFrom)) {
      return res.status(400).json({
        success: false,
        error: 'Enter a valid From address — either "you@example.com" or "Display Name <you@example.com>"',
      });
    }
    const currentMg = await getStoredEmailSettings();
    const mailgunApiKeyInput = body.mailgunApiKey;
    const nextApiKey = typeof mailgunApiKeyInput === "string" && mailgunApiKeyInput.trim()
      ? mailgunApiKeyInput.trim()
      : currentMg.mailgunApiKey;
    const mailgunRegionInput = String(body.mailgunRegion || "").trim().toLowerCase();
    const savedMg = await saveStoredEmailSettings({
      mailgunApiKey: nextApiKey,
      mailgunDomain: typeof body.mailgunDomain === "string" ? body.mailgunDomain.trim() : currentMg.mailgunDomain,
      mailgunFrom: mailgunFrom || currentMg.mailgunFrom,
      mailgunRegion: mailgunRegionInput === "eu" ? "eu" : mailgunRegionInput === "us" ? "us" : currentMg.mailgunRegion,
    });

    // --- SMTP ---
    const smtpUpdate: Record<string, any> = {};
    if (typeof body.smtpHost     === "string") smtpUpdate.smtpHost     = body.smtpHost.trim();
    if (typeof body.smtpPort     !== "undefined") smtpUpdate.smtpPort  = parseInt(String(body.smtpPort), 10) || 465;
    if (typeof body.smtpSecure   !== "undefined") smtpUpdate.smtpSecure = body.smtpSecure === true || body.smtpSecure === "true";
    if (typeof body.smtpUser     === "string") smtpUpdate.smtpUser     = body.smtpUser.trim();
    if (typeof body.smtpPassword === "string" && body.smtpPassword.trim()) smtpUpdate.smtpPassword = body.smtpPassword.trim();
    if (typeof body.smtpFrom     === "string") smtpUpdate.smtpFrom     = body.smtpFrom.trim();
    const savedSmtp = await saveStoredSmtpSettings(smtpUpdate);

    // --- Provider ---
    const providerInput = String(body.emailProvider || "").trim().toLowerCase();
    if (providerInput === "smtp" || providerInput === "mailgun") {
      await setEmailProvider(providerInput as "smtp" | "mailgun");
    }
    const emailProvider = await getEmailProvider();

    res.json({
      success: true,
      data: {
        mailgunDomain: savedMg.mailgunDomain,
        mailgunFrom: savedMg.mailgunFrom,
        mailgunRegion: savedMg.mailgunRegion,
        hasMailgunApiKey: Boolean(savedMg.mailgunApiKey),
        maskedMailgunApiKey: maskEmailApiKey(savedMg.mailgunApiKey),
        smtpHost:           savedSmtp.smtpHost,
        smtpPort:           savedSmtp.smtpPort,
        smtpSecure:         savedSmtp.smtpSecure,
        smtpUser:           savedSmtp.smtpUser,
        smtpFrom:           savedSmtp.smtpFrom,
        hasSmtpPassword:    Boolean(savedSmtp.smtpPassword),
        maskedSmtpPassword: maskSmtpPassword(savedSmtp.smtpPassword),
        emailProvider,
      },
      message: "Email settings saved successfully",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to save email settings" });
  }
});

router.post("/email-settings/test", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const to = String(req.body?.to || "").trim();
    if (!to) return res.status(400).json({ success: false, error: "Recipient email is required" });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) return res.status(400).json({ success: false, error: "Enter a valid email address" });

    const provider = await getEmailProvider();
    const sentAt = new Date().toISOString();
    await sendEmail({
      to,
      subject: `[Test] Curreex email delivery check — ${sentAt}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <h2 style="color:#d97706;margin:0 0 12px">Email Delivery Test</h2>
          <p style="color:#cbd5e1;margin:0 0 8px">This is a test email sent from the <strong>Curreex admin panel</strong>.</p>
          <p style="color:#94a3b8;font-size:13px">Provider: <strong>${provider.toUpperCase()}</strong></p>
          <p style="color:#94a3b8;font-size:13px">Sent at: ${sentAt}</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px;border-top:1px solid #334155;padding-top:12px">If you received this, email delivery is working correctly.</p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: `Test email sent to ${to} via ${provider.toUpperCase()}`,
      provider,
      sentAt,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to send test email" });
  }
});

router.get("/notification-settings", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getNotificationSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load notification settings" });
  }
});

router.post("/notification-settings", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body ?? {};
    const dailyCap = body.dailyCap !== undefined ? parseInt(String(body.dailyCap), 10) : undefined;
    const typesEnabled = body.typesEnabled && typeof body.typesEnabled === "object" ? {
      deposit: typeof body.typesEnabled.deposit === "boolean" ? body.typesEnabled.deposit : undefined,
      withdrawal: typeof body.typesEnabled.withdrawal === "boolean" ? body.typesEnabled.withdrawal : undefined,
      trade: typeof body.typesEnabled.trade === "boolean" ? body.typesEnabled.trade : undefined,
    } : undefined;

    const settings = await saveNotificationSettings({ dailyCap, typesEnabled });
    res.json({ success: true, data: settings, message: "Notification settings saved successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to save notification settings" });
  }
});

/** Static page content (About Us, etc.), keyed by slug. */
const ensurePageContentTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS page_content (
      slug       VARCHAR(64) PRIMARY KEY,
      title      VARCHAR(255) NOT NULL DEFAULT '',
      content    TEXT NOT NULL DEFAULT '',
      published  BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const ALLOWED_PAGE_SLUGS = new Set(["about-us"]);

router.get("/page-content/:slug", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!ALLOWED_PAGE_SLUGS.has(slug)) {
      return res.status(400).json({ success: false, error: "Unknown page" });
    }
    await ensurePageContentTable();
    const rows = (await query(
      `SELECT slug, title, content, published, updated_at FROM page_content WHERE slug = ? LIMIT 1`,
      [slug]
    )) as any[];
    const row = Array.isArray(rows) && rows[0];
    res.json({
      success: true,
      data: row
        ? {
            slug: row.slug,
            title: row.title || "",
            content: row.content || "",
            published: row.published !== false,
            updatedAt: row.updated_at,
          }
        : { slug, title: "", content: "", published: true, updatedAt: null },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load page content" });
  }
});

router.post("/page-content/:slug", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    if (!ALLOWED_PAGE_SLUGS.has(slug)) {
      return res.status(400).json({ success: false, error: "Unknown page" });
    }

    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();
    const published = req.body?.published === undefined ? true : Boolean(req.body.published);

    if (!title) return res.status(400).json({ success: false, error: "Title is required", fields: ["title"] });
    if (!content) return res.status(400).json({ success: false, error: "Content is required", fields: ["content"] });

    await ensurePageContentTable();
    await query(
      `INSERT INTO page_content (slug, title, content, published, updated_at)
       VALUES (?, ?, ?, ?, NOW())
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             content = EXCLUDED.content,
             published = EXCLUDED.published,
             updated_at = NOW()`,
      [slug, title, content, published]
    );

    res.json({ success: true, data: { slug, title, content, published }, message: "Page content saved successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to save page content" });
  }
});

router.get("/email-branding", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const branding = await getEmailBranding();
    res.json({ success: true, data: branding, defaults: EMAIL_BRANDING_DEFAULTS });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load email branding" });
  }
});

router.post("/email-branding", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body ?? {};
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

    // These drive customer-facing mail, so an accidental blank is rejected
    // rather than silently falling back to a default.
    const required: Array<[string, string]> = [
      ["header", str(body.header)],
      ["footer", str(body.footer)],
      ["bodyRegistration", str(body.bodyRegistration)],
      ["bodyLogin", str(body.bodyLogin)],
    ];
    const missing = required.filter(([, value]) => !value).map(([field]) => field);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Required field(s) missing: ${missing.join(", ")}`,
        fields: missing,
      });
    }

    const logoUrl = str(body.logoUrl);
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      return res.status(400).json({
        success: false,
        error: "Logo URL must be a full http(s) URL — email clients cannot load relative paths",
        fields: ["logoUrl"],
      });
    }

    const saved = await saveEmailBranding({
      logoUrl,
      header: str(body.header),
      footer: str(body.footer),
      bodyRegistration: str(body.bodyRegistration),
      bodyLogin: str(body.bodyLogin),
    });

    res.json({ success: true, data: saved, message: "Email settings saved successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to save email branding" });
  }
});

router.get("/style-settings", async (req: Request, res: Response) => {
  try {
    await ensureStyleSettingsTable();

    const [shadcnTheme, platformName] = await Promise.all([
      getStoredShadcnTheme(),
      getStoredPlatformName(),
    ]);
    const storedLogos = getStoredLogoSettings();
    const settings = await query(`
      SELECT
        id,
        header_color,
        topbar_bg_color,
        theme_mode,
        platform_font_size,
        button_text_color,
        font_color_mode,
        glossy_effect
      FROM style_settings
      LIMIT 1
    `);

    if (!settings || (settings as any[]).length === 0) {
      return res.json({
        success: true,
        data: {
          topbarBgColor: "default",
          themeMode: "default",
          shadcnTheme,
          platformFontSize: "16px",
          fontColorMode: "auto",
          glossyEffect: "on",
          buttonTextColor: "white",
          platformName,
          logoLightUrl: toPublicLogoUrl(req, storedLogos.light),
          logoDarkUrl: toPublicLogoUrl(req, storedLogos.dark),
          logoSquareUrl: toPublicLogoUrl(req, storedLogos.square),
        }
      });
    }

    const data = (settings as any[])[0];
    res.json({
      success: true,
      data: {
        topbarBgColor: data.topbar_bg_color || data.header_color || "default",
        headerColor: data.topbar_bg_color || data.header_color || "default",
        themeMode: data.theme_mode || "default",
        shadcnTheme,
        platformFontSize: data.platform_font_size || "16px",
        fontColorMode: data.font_color_mode || "auto",
        glossyEffect: data.glossy_effect || "on",
        buttonTextColor: data.button_text_color || "white",
        platformName,
        logoLightUrl: toPublicLogoUrl(req, storedLogos.light),
        logoDarkUrl: toPublicLogoUrl(req, storedLogos.dark),
        logoSquareUrl: toPublicLogoUrl(req, storedLogos.square),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/style-settings", async (req: Request, res: Response) => {
  try {
    const {
      topbarBgColor,
      headerColor,
      themeMode,
      shadcnTheme,
      platformFontSize,
      buttonTextColor,
      fontColorMode,
      glossyEffect,
      platformName,
    } = req.body;
    await ensureStyleSettingsTable();
    const nextPlatformName = String(platformName || "SuimFx").trim().slice(0, 128) || "SuimFx";
    const incomingTopbar = String(topbarBgColor || headerColor || "");
    const nextTopbarBgColor = ["default", "red", "blue", "green", "purple", "dark", "light"].includes(incomingTopbar)
      ? incomingTopbar
      : "default";
    const nextThemeMode = ["default", "dark", "light"].includes(String(themeMode || ""))
      ? String(themeMode)
      : "default";
    const nextShadcnTheme = normalizeShadcnTheme(shadcnTheme);
    const nextFontSize = ["8px", "14px", "16px"].includes(String(platformFontSize || ""))
      ? String(platformFontSize)
      : "16px";
    const nextButtonTextColor = ["white", "black", "yellow", "cyan"].includes(String(buttonTextColor || ""))
      ? String(buttonTextColor)
      : "white";
    const nextFontColorMode = ["auto"].includes(String(fontColorMode || ""))
      ? String(fontColorMode)
      : "auto";
    const nextGlossyEffect = ["on", "off"].includes(String(glossyEffect || ""))
      ? String(glossyEffect)
      : "on";
    
    // Upsert settings — PostgreSQL compatible
    const existing = await query("SELECT id FROM style_settings LIMIT 1");
    
    if (existing && (existing as any[]).length > 0) {
      const existingId = (existing as any[])[0].id;
      await query(
        "UPDATE style_settings SET topbar_bg_color = ?, header_color = ?, theme_mode = ?, platform_font_size = ?, button_text_color = ?, font_color_mode = ?, glossy_effect = ? WHERE id = ?",
        [nextTopbarBgColor, nextTopbarBgColor, nextThemeMode, nextFontSize, nextButtonTextColor, nextFontColorMode, nextGlossyEffect, existingId]
      );
    } else {
      await query(
        "INSERT INTO style_settings (topbar_bg_color, header_color, theme_mode, platform_font_size, button_text_color, font_color_mode, glossy_effect) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [nextTopbarBgColor, nextTopbarBgColor, nextThemeMode, nextFontSize, nextButtonTextColor, nextFontColorMode, nextGlossyEffect]
      );
    }
    await Promise.all([
      saveStoredShadcnTheme(nextShadcnTheme),
      saveStoredPlatformName(nextPlatformName),
    ]);

    res.json({
      success: true,
      data: {
        topbarBgColor: nextTopbarBgColor,
        headerColor: nextTopbarBgColor,
        themeMode: nextThemeMode,
        shadcnTheme: nextShadcnTheme,
        platformFontSize: nextFontSize,
        fontColorMode: nextFontColorMode,
        glossyEffect: nextGlossyEffect,
        buttonTextColor: nextButtonTextColor,
        platformName: nextPlatformName,
      },
      message: "Settings saved successfully"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/logo-upload", verifyToken, uploadLogo.single("logo"), async (req: AuthRequest, res: Response) => {
  try {
    const type = String(req.body?.type || "").trim();
    if (!["light", "dark", "square"].includes(type)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: "type must be light, dark, or square" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const expected = logoDimensionsByType[type];
    const dimensions = await imageSizeFromFile(req.file.path);
    if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: `${type} logo must be ${expected.width}x${expected.height}px PNG`,
      });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const storedLogos = getStoredLogoSettings();
    const previousLogoUrl = storedLogos[type as keyof LogoSettings] || null;

    saveStoredLogoSettings({
      ...storedLogos,
      [type]: logoUrl,
    } as LogoSettings);

    if (previousLogoUrl && previousLogoUrl !== logoUrl) {
      removeLogoFileByUrl(previousLogoUrl);
    }

    res.json({
      success: true,
      data: {
        logoUrl: toPublicLogoUrl(req, logoUrl),
        type,
      },
      message: "Logo uploaded successfully",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/logo-delete", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const type = String(req.body?.type || "").trim();
    if (!["light", "dark", "square"].includes(type)) {
      return res.status(400).json({ success: false, error: "type must be light, dark, or square" });
    }

    const storedLogos = getStoredLogoSettings();
    const previousLogoUrl = storedLogos[type as keyof LogoSettings] || null;

    saveStoredLogoSettings({
      ...storedLogos,
      [type]: null,
    } as LogoSettings);

    removeLogoFileByUrl(previousLogoUrl);

    res.json({ success: true, message: "Logo removed" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/deposit-offers", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureDepositOffersTable();
    const rows = await query(
      `SELECT id, title, description, badge, active, sort_order, created_at
       FROM deposit_offers
       ORDER BY sort_order ASC, created_at DESC`
    ) as any[];

    const data = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      badge: row.badge || "",
      active: row.active !== false,
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at,
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to fetch offers" });
  }
});

router.post("/deposit-offers", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDepositOffersTable();
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    const badge = String(req.body?.badge || "").trim();
    const active = req.body?.active !== false;
    const sortOrder = Number(req.body?.sortOrder || 0);

    if (!title || !description) {
      return res.status(400).json({ success: false, error: "title and description are required" });
    }

    const id = uuidv4();
    await query(
      `INSERT INTO deposit_offers (id, title, description, badge, active, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, title, description, badge || null, active, Number.isFinite(sortOrder) ? sortOrder : 0]
    );

    res.status(201).json({ success: true, data: { id }, message: "Offer created" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to create offer" });
  }
});

router.put("/deposit-offers/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDepositOffersTable();
    const { id } = req.params;
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    const badge = String(req.body?.badge || "").trim();
    const active = req.body?.active !== false;
    const sortOrder = Number(req.body?.sortOrder || 0);

    if (!title || !description) {
      return res.status(400).json({ success: false, error: "title and description are required" });
    }

    await query(
      `UPDATE deposit_offers
       SET title = ?, description = ?, badge = ?, active = ?, sort_order = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, description, badge || null, active, Number.isFinite(sortOrder) ? sortOrder : 0, id]
    );

    res.json({ success: true, message: "Offer updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to update offer" });
  }
});

router.delete("/deposit-offers/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDepositOffersTable();
    await query("DELETE FROM deposit_offers WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Offer deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to delete offer" });
  }
});

router.get("/trade-settings", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const autoCloseTimeoutMinutes = await getAutoCloseTimeoutMinutes();
    res.json({
      success: true,
      data: { autoCloseTimeoutMinutes },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/trade-settings", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const timeoutValue = Number(req.body?.autoCloseTimeoutMinutes);

    if (!Number.isInteger(timeoutValue) || timeoutValue < 1 || timeoutValue > 1440) {
      return res.status(400).json({
        success: false,
        error: "autoCloseTimeoutMinutes must be an integer between 1 and 1440",
      });
    }

    const autoCloseTimeoutMinutes = await setAutoCloseTimeoutMinutes(timeoutValue);
    res.json({
      success: true,
      data: { autoCloseTimeoutMinutes },
      message: "Trade settings updated successfully",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/user-account-settings", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getUserAccountSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load user account settings" });
  }
});

router.post("/user-account-settings", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const realAccountActivationEnabled = req.body?.realAccountActivationEnabled !== false;
    const kycRequiredForRealAccount = req.body?.kycRequiredForRealAccount !== false;

    await ensureUserAccountSettingsTable();
    await query(
      "UPDATE user_account_settings SET real_account_activation_enabled = ?, kyc_required_for_real_account = ? WHERE id = 1",
      [realAccountActivationEnabled, kycRequiredForRealAccount]
    );

    res.json({
      success: true,
      data: {
        realAccountActivationEnabled,
        kycRequiredForRealAccount,
      },
      message: "User account settings saved successfully",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to save user account settings" });
  }
});

router.post("/server-settings/reset-user", verifyToken, async (req: AuthRequest, res: Response) => {
  const connection = await getConnection();
  try {
    const rawIdentifier = String(req.body?.userIdentifier || "").trim();
    const deleteUser = Boolean(req.body?.deleteUser);
    const confirmText = String(req.body?.confirmText || "").trim();

    if (!rawIdentifier) {
      return res.status(400).json({ success: false, error: "userIdentifier is required" });
    }
    if (confirmText !== "RESET USER DATA") {
      return res.status(400).json({ success: false, error: "Invalid confirmation text" });
    }

    const byEmail = rawIdentifier.includes("@");
    const [users] = await connection.execute(
      byEmail ? "SELECT id, email FROM users WHERE email = ? LIMIT 1" : "SELECT id, email FROM users WHERE id = ? LIMIT 1",
      [rawIdentifier]
    );
    const userRows = users as any[];
    if (!Array.isArray(userRows) || userRows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = userRows[0];
    const userId = String(user.id);

    await connection.beginTransaction();

    const [accountRowsRaw] = await connection.execute(
      "SELECT id FROM user_accounts WHERE user_id = ?",
      [userId]
    );
    const accountRows = accountRowsRaw as any[];
    const accountIds = Array.isArray(accountRows) ? accountRows.map((row: any) => String(row.id)) : [];

    const deletedSummary: Record<string, number> = {};

    if (accountIds.length > 0) {
      const [accountTablesRaw] = await connection.execute(
        `SELECT DISTINCT table_name
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND column_name = 'account_id'`
      );
      const accountTables = extractTableNames(accountTablesRaw as any[], ["user_accounts"]);

      for (const tableName of accountTables) {
        const placeholders = accountIds.map(() => "?").join(",");
        const sql = `DELETE FROM ${quoteIdentifier(tableName)} WHERE account_id IN (${placeholders})`;
        const [result] = await connection.execute(sql, accountIds);
        const affected = Number((result as any)?.affectedRows || 0);
        if (affected > 0) deletedSummary[tableName] = affected;
      }
    }

    const [userTablesRaw] = await connection.execute(
      `SELECT DISTINCT table_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND column_name = 'user_id'`
    );
    const userTables = extractTableNames(userTablesRaw as any[], ["users"]);

    for (const tableName of userTables) {
      const sql = `DELETE FROM ${quoteIdentifier(tableName)} WHERE user_id = ?`;
      const [result] = await connection.execute(sql, [userId]);
      const affected = Number((result as any)?.affectedRows || 0);
      if (affected > 0) {
        deletedSummary[tableName] = (deletedSummary[tableName] || 0) + affected;
      }
    }

    if (deleteUser) {
      const [result] = await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
      const affected = Number((result as any)?.affectedRows || 0);
      if (affected > 0) deletedSummary.users = affected;
    }

    await connection.commit();

    return res.json({
      success: true,
      message: deleteUser
        ? "User and related records have been reset"
        : "User related records have been reset",
      user: { id: userId, email: user.email || null },
      deleted: deletedSummary,
      deleteUser,
    });
  } catch (error: any) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // noop
    }
    return res.status(500).json({ success: false, error: error.message || "Failed to reset user" });
  } finally {
    connection.release();
  }
});

router.post("/server-settings/reset-all-users", verifyToken, async (req: AuthRequest, res: Response) => {
  const connection = await getConnection();
  try {
    const confirmText = String(req.body?.confirmText || "").trim();
    if (confirmText !== "RESET ALL USER DATA") {
      return res.status(400).json({ success: false, error: "Invalid confirmation text" });
    }

    await connection.beginTransaction();

    const deletedSummary: Record<string, number> = {};

    const [accountTablesRaw] = await connection.execute(
      `SELECT DISTINCT table_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND column_name = 'account_id'`
    );
    const accountTables = extractTableNames(accountTablesRaw as any[], ["user_accounts"]);

    for (const tableName of accountTables) {
      // For full reset, deleting by non-null foreign key is faster and avoids huge IN clauses.
      const sql = `DELETE FROM ${quoteIdentifier(tableName)} WHERE account_id IS NOT NULL`;
      const [result] = await connection.execute(sql);
      const affected = Number((result as any)?.affectedRows || 0);
      if (affected > 0) deletedSummary[tableName] = affected;
    }

    const [userTablesRaw] = await connection.execute(
      `SELECT DISTINCT table_name
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND column_name = 'user_id'`
    );
    const userTables = extractTableNames(userTablesRaw as any[], ["users"]);

    for (const tableName of userTables) {
      const sql = `DELETE FROM ${quoteIdentifier(tableName)} WHERE user_id IS NOT NULL`;
      const [result] = await connection.execute(sql);
      const affected = Number((result as any)?.affectedRows || 0);
      if (affected > 0) {
        deletedSummary[tableName] = (deletedSummary[tableName] || 0) + affected;
      }
    }

    const [accountDeleteResult] = await connection.execute("DELETE FROM user_accounts");
    const deletedAccounts = Number((accountDeleteResult as any)?.affectedRows || 0);
    if (deletedAccounts > 0) deletedSummary.user_accounts = deletedAccounts;

    const [userDeleteResult] = await connection.execute("DELETE FROM users");
    const deletedUsers = Number((userDeleteResult as any)?.affectedRows || 0);
    if (deletedUsers > 0) deletedSummary.users = deletedUsers;

    await connection.commit();

    return res.json({
      success: true,
      message: "All users and related records have been reset",
      deleted: deletedSummary,
    });
  } catch (error: any) {
    try {
      await connection.rollback();
    } catch (_rollbackError) {
      // noop
    }
    return res.status(500).json({ success: false, error: error.message || "Failed to reset all users" });
  } finally {
    connection.release();
  }
});

// ==========================================
// Trader stats — counts by status
// ==========================================
router.get("/traders/stats", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'banned'    THEN 1 ELSE 0 END) AS banned,
        SUM(CASE WHEN status NOT IN ('active','banned') OR status IS NULL THEN 1 ELSE 0 END) AS inactive
      FROM users
    `) as any[];
    const r = Array.isArray(rows) && rows[0] ? rows[0] : {}
    res.json({
      success: true,
      data: {
        total:    Number(r.total    || 0),
        active:   Number(r.active   || 0),
        banned:   Number(r.banned   || 0),
        inactive: Number(r.inactive || 0),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==========================================
// Traders — users with account balance
// ==========================================
router.get("/traders", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const page = Number(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const status = (req.query.status as string) || "";
    const sortBy = (req.query.sortBy as string) || "created_at";
    const sortDir = (req.query.sortDir as string) === "asc" ? "ASC" : "DESC";

    const allowedSort: Record<string, string> = {
      name: "u.first_name",
      email: "u.email",
      status: "u.status",
      createdAt: "u.created_at",
      realBalance: "real_balance",
    };
    const orderCol = allowedSort[sortBy] || "u.created_at";

    const whereParts: string[] = [];
    const values: any[] = [];
    if (search) {
      const like = `%${search}%`;
      whereParts.push("(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.phone LIKE ?)");
      values.push(like, like, like, like);
    }
    if (status) {
      whereParts.push("u.status = ?");
      values.push(status);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const rows = await query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.status, u.created_at,
             COALESCE(SUM(CASE WHEN ua.trading_mode = 'real' THEN ua.balance ELSE 0 END), 0) AS real_balance,
             COALESCE(SUM(CASE WHEN ua.trading_mode = 'demo' THEN ua.balance ELSE 0 END), 0) AS demo_balance
      FROM users u
      LEFT JOIN user_accounts ua ON ua.user_id = u.id
      ${where}
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.phone, u.status, u.created_at
      ORDER BY ${orderCol} ${sortDir}
      LIMIT ${limit} OFFSET ${offset}
    `, values) as any[];

    const countRows = await query(`SELECT COUNT(*) AS total FROM users u ${where}`, values) as any[];
    const total = Number(countRows?.[0]?.total || 0);

    const data = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      phone: row.phone || null,
      status: row.status || null,
      realBalance: Number(row.real_balance || 0),
      demoBalance: Number(row.demo_balance || 0),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    }));

    res.json({ success: true, data, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/traders/:userId/ban", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await query("UPDATE users SET status = 'banned' WHERE id = ?", [req.params.userId]);
    res.json({ success: true, message: "Trader banned" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/traders/:userId/unban", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await query("UPDATE users SET status = 'active' WHERE id = ?", [req.params.userId]);
    res.json({ success: true, message: "Trader unbanned" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/traders/:userId/change-password", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const newPassword = String(req.body?.newPassword || "").trim();
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }
    const hashed = await bcryptjs.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [hashed, req.params.userId]);
    res.json({ success: true, message: "Password changed" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/traders/:userId/deduct-fund", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.body?.amount);
    const mode = String(req.body?.mode || "demo");
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be greater than 0" });
    }
    const accounts = await query(
      "SELECT id, balance FROM user_accounts WHERE user_id = ? AND trading_mode = ? LIMIT 1",
      [req.params.userId, mode]
    ) as any[];
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }
    const account = accounts[0];
    if (Number(account.balance || 0) < amount) {
      return res.status(400).json({ success: false, error: "Insufficient balance" });
    }
    await query(
      "UPDATE user_accounts SET balance = balance - ?, equity = equity - ?, available_balance = available_balance - ? WHERE id = ?",
      [amount, amount, amount, account.id]
    );
    res.json({ success: true, message: `Deducted $${amount} from ${mode} account` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Trader — Trading Accounts
// ==========================================
router.get("/traders/:userId/trading-accounts", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const accounts = await query(
      `SELECT id, account_number, trading_mode, balance, equity, margin_free, available_balance, currency, account_status, created_at
       FROM user_accounts WHERE user_id = ? ORDER BY trading_mode ASC`,
      [userId]
    ) as any[];

    const data = (Array.isArray(accounts) ? accounts : []).map((a: any) => ({
      id: a.id,
      accountNumber: a.account_number,
      mode: a.trading_mode,
      balance: Number(a.balance || 0),
      equity: Number(a.equity || 0),
      freeMargin: Number(a.margin_free || 0),
      availableBalance: Number(a.available_balance || 0),
      currency: a.currency || "USD",
      status: a.account_status,
      createdAt: a.created_at,
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Trader Accounts — flat, trader-wise view of every account across all
// traders, with per-account admin actions (ban / activate / modify / delete).
// ==========================================
router.get("/trader-accounts", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const mode = (req.query.mode as string) || "";
    const status = (req.query.status as string) || "";

    await ensureAccountTypesTable();

    const whereParts: string[] = [];
    const values: any[] = [];
    if (search) {
      const like = `%${search}%`;
      whereParts.push("(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR ua.account_number LIKE ?)");
      values.push(like, like, like, like);
    }
    if (mode) {
      whereParts.push("ua.trading_mode = ?");
      values.push(mode);
    }
    if (status) {
      whereParts.push("ua.account_status = ?");
      values.push(status);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const rows = (await query(
      `
      SELECT ua.id, ua.user_id, ua.account_number, ua.trading_mode, ua.balance, ua.equity,
             ua.margin_free, ua.available_balance, ua.currency, ua.leverage, ua.is_active,
             ua.account_status, ua.account_type_id, ua.created_at,
             u.email, u.first_name, u.last_name,
             at.name AS account_type_name
      FROM user_accounts ua
      JOIN users u ON u.id = ua.user_id
      LEFT JOIN account_types at ON at.id = ua.account_type_id
      ${where}
      ORDER BY ua.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      values
    )) as any[];

    const countRows = (await query(
      `SELECT COUNT(*) AS total FROM user_accounts ua JOIN users u ON u.id = ua.user_id ${where}`,
      values
    )) as any[];
    const total = Number(countRows?.[0]?.total || 0);

    const data = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      traderName: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "—",
      traderEmail: row.email,
      accountNumber: row.account_number,
      tradingMode: row.trading_mode,
      balance: Number(row.balance || 0),
      equity: Number(row.equity || 0),
      freeMargin: Number(row.margin_free || 0),
      availableBalance: Number(row.available_balance || 0),
      currency: row.currency || "USD",
      leverage: Number(row.leverage || 500),
      isActive: Boolean(row.is_active),
      status: row.account_status || "active",
      accountTypeId: row.account_type_id,
      accountTypeName: row.account_type_name || "Standard",
      createdAt: row.created_at,
    }));

    res.json({ success: true, data, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/trader-accounts/:id/ban", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query("UPDATE user_accounts SET account_status = 'banned' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Account banned" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/trader-accounts/:id/activate", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await query("UPDATE user_accounts SET account_status = 'active' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Account activated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/trader-accounts/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { balance, equity, leverage, accountTypeId } = req.body || {};

    const sets: string[] = [];
    const values: any[] = [];

    if (balance !== undefined) {
      const n = Number(balance);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success: false, error: "Invalid balance" });
      sets.push("balance = ?");
      values.push(n);
      // available_balance and margin_free both represent "free" balance in
      // different code paths (legacy split column) — keep both consistent
      // with the new balance; margin locked by open trades is preserved.
      sets.push("available_balance = GREATEST(0, ? - locked_balance)");
      values.push(n);
      sets.push("margin_free = GREATEST(0, ? - locked_balance)");
      values.push(n);
    }
    if (equity !== undefined) {
      const n = Number(equity);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ success: false, error: "Invalid equity" });
      sets.push("equity = ?");
      values.push(n);
    }
    if (leverage !== undefined) {
      const n = Number(leverage);
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, error: "Invalid leverage" });
      sets.push("leverage = ?");
      values.push(n);
    }
    if (accountTypeId !== undefined) {
      if (accountTypeId !== null) {
        const typeRows = (await query("SELECT id FROM account_types WHERE id = ? LIMIT 1", [accountTypeId])) as any[];
        if (!Array.isArray(typeRows) || typeRows.length === 0) {
          return res.status(404).json({ success: false, error: "Account type not found" });
        }
      }
      sets.push("account_type_id = ?");
      values.push(accountTypeId);
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: "No fields to update" });
    }

    values.push(id);
    const updated = await query(`UPDATE user_accounts SET ${sets.join(", ")} WHERE id = ?`, values);

    res.json({ success: true, message: "Account updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/trader-accounts/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const acctRows = (await query(
      "SELECT user_id, trading_mode, is_active FROM user_accounts WHERE id = ? LIMIT 1",
      [id]
    )) as any[];
    if (!Array.isArray(acctRows) || acctRows.length === 0) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }
    const account = acctRows[0];

    const openTradeRows = (await query(
      "SELECT COUNT(*) AS open_count FROM trades WHERE account_id = ? AND status = 'OPEN'",
      [id]
    )) as any[];
    const openCount = Number(openTradeRows?.[0]?.open_count || 0);
    if (openCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete: this account has ${openCount} open trade${openCount === 1 ? "" : "s"}. Close them first.`,
      });
    }

    await query("DELETE FROM user_accounts WHERE id = ?", [id]);

    // If the deleted account was the active one for its mode, promote the
    // most recently created remaining account of that mode so the trader
    // isn't left without a resolvable account.
    if (account.is_active) {
      const siblings = (await query(
        "SELECT id FROM user_accounts WHERE user_id = ? AND trading_mode = ? ORDER BY created_at DESC LIMIT 1",
        [account.user_id, account.trading_mode]
      )) as any[];
      if (Array.isArray(siblings) && siblings.length > 0) {
        await query("UPDATE user_accounts SET is_active = true WHERE id = ?", [siblings[0].id]);
      }
    }

    res.json({ success: true, message: "Account deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Trader — Login as User (impersonate)
// ==========================================
router.post("/traders/:userId/login-as", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const users = await query(
      "SELECT id, email, first_name, last_name FROM users WHERE id = ? LIMIT 1",
      [userId]
    ) as any[];

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = users[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ success: true, token, user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Sub Agents — admin_users list
// ==========================================
router.get("/sub-agents", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const page = Number(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const whereParts: string[] = [];
    const values: any[] = [];
    if (search) {
      const like = `%${search}%`;
      whereParts.push("(email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)");
      values.push(like, like, like);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const rows = await query(`
      SELECT id, email, first_name, last_name, status, email_verified, last_login_at, created_at
      FROM admin_users ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, values) as any[];

    const countRows = await query(`SELECT COUNT(*) AS total FROM admin_users ${where}`, values) as any[];
    const total = Number(countRows?.[0]?.total || 0);

    const data = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      status: row.status || null,
      emailVerified: row.email_verified === true || row.email_verified === 1,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    }));

    res.json({ success: true, data, total, page, limit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Account Types — CRUD operations
// ==========================================
router.get("/account-types", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureAccountTypesTable();

    const rows = await query(`
      SELECT id, name, description, min_deposit, leverage, exposure_limit, is_demo, created_at, updated_at
      FROM account_types
      ORDER BY created_at DESC
    `) as any[];

    const data = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      minDeposit: Number(row.min_deposit || 0),
      leverage: Number(row.leverage || 100),
      exposureLimit: Number(row.exposure_limit || 0),
      isDemo: Boolean(row.is_demo),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/account-types", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureAccountTypesTable();

    const { name, description, minDeposit, leverage, exposureLimit, isDemo } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    if (!leverage || Number(leverage) <= 0) {
      return res.status(400).json({ success: false, error: "Valid leverage is required" });
    }

    const id = uuidv4();
    await query(`
      INSERT INTO account_types (id, name, description, min_deposit, leverage, exposure_limit, is_demo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [id, name, description || "", minDeposit || 0, leverage, exposureLimit || 0, isDemo ? 1 : 0]);

    res.status(201).json({
      success: true,
      message: "Account type created successfully",
      data: { id, name, description, minDeposit, leverage, exposureLimit, isDemo }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/account-types/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureAccountTypesTable();

    const { id } = req.params;
    const { name, description, minDeposit, leverage, exposureLimit, isDemo } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    if (!leverage || Number(leverage) <= 0) {
      return res.status(400).json({ success: false, error: "Valid leverage is required" });
    }

    await query(`
      UPDATE account_types
      SET name = ?, description = ?, min_deposit = ?, leverage = ?, exposure_limit = ?, is_demo = ?, updated_at = NOW()
      WHERE id = ?
    `, [name, description || "", minDeposit || 0, leverage, exposureLimit || 0, isDemo ? 1 : 0, id]);

    res.json({
      success: true,
      message: "Account type updated successfully",
      data: { id, name, description, minDeposit, leverage, exposureLimit, isDemo }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/account-types/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureAccountTypesTable();

    const { id } = req.params;

    await query(`DELETE FROM account_types WHERE id = ?`, [id]);

    res.json({ success: true, message: "Account type deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// IB Program routes
// ─────────────────────────────────────────────────────────────

// Schema lives in lib/ib.ts alongside the referral and commission logic so the
// admin routes, the partner routes and the registration hook cannot drift apart.

router.get("/ib/stats", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    await matureCommissions();

    // Partner counts come from ib_partners, but every money figure is computed
    // from the ib_commissions ledger rather than the denormalised counters, so
    // the dashboard cannot report a stale cache as fact.
    const [ibRow] = await query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
         FROM ib_partners`
    );
    const [refRow] = await query(`SELECT COUNT(*) AS total FROM ib_clients`);
    const [comRow] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total,
              COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE THEN amount ELSE 0 END), 0) AS today,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending,
              COALESCE(SUM(CASE WHEN status = 'matured' THEN amount ELSE 0 END), 0) AS payable,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid
         FROM ib_commissions`
    );
    const [payRow] = await query(
      `SELECT COUNT(DISTINCT ib_id) AS requests FROM ib_commissions WHERE status = 'matured'`
    );

    res.json({
      success: true,
      data: {
        totalIBs:           Number(ibRow?.total || 0),
        pendingIBs:         Number(ibRow?.pending || 0),
        totalReferrals:     Number(refRow?.total || 0),
        totalCommissions:   Number(comRow?.total || 0),
        todayCommissions:   Number(comRow?.today || 0),
        pendingCommissions: Number(comRow?.pending || 0),
        paidCommissions:    Number(comRow?.paid || 0),
        // "Pending withdrawals" is matured commission awaiting payout.
        pendingWithdrawals: Number(comRow?.payable || 0),
        withdrawalRequests: Number(payRow?.requests || 0),
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ib/list", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const rows = await query(`SELECT * FROM ib_partners WHERE status = 'active' ORDER BY created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ib/applications", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const rows = await query(`SELECT * FROM ib_applications WHERE status = 'pending' ORDER BY created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ib/applications/:id/approve", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const { id } = req.params;
    const [app] = await query(`SELECT * FROM ib_applications WHERE id = ?`, [id]);
    if (!app) return res.status(404).json({ success: false, error: "Application not found" });

    await query(`UPDATE ib_applications SET status = 'approved' WHERE id = ?`, [id]);

    // Approving twice must not mint a second partner for the same user.
    const existing = await query(`SELECT id, ib_code FROM ib_partners WHERE user_id = ? LIMIT 1`, [
      app.user_id || "",
    ]);
    if (existing.length > 0) {
      return res.json({
        success: true,
        message: "Application approved",
        data: { ibCode: existing[0].ib_code, alreadyPartner: true },
      });
    }

    // ib_code is UNIQUE and doubles as the public referral code, so a collision
    // would fail the insert. Retry a few times before giving up.
    let ibCode = "";
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = "IB" + Math.random().toString(36).toUpperCase().slice(2, 8).padEnd(6, "0");
      const clash = await query(`SELECT 1 FROM ib_partners WHERE ib_code = ? LIMIT 1`, [candidate]);
      if (clash.length === 0) {
        ibCode = candidate;
        break;
      }
    }
    if (!ibCode) {
      return res.status(500).json({ success: false, error: "Could not allocate a unique IB code" });
    }

    await query(
      `INSERT INTO ib_partners (id, user_id, name, email, phone, ib_code, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [uuidv4(), app.user_id || "", app.name, app.email, app.phone, ibCode]
    );
    res.json({ success: true, message: "Application approved", data: { ibCode } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ib/applications/:id/reject", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const { id } = req.params;
    await query(`UPDATE ib_applications SET status = 'rejected' WHERE id = ?`, [id]);
    res.json({ success: true, message: "Application rejected" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ib/levels", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const rows = await query(`
      SELECT l.*, COUNT(p.id) AS ib_count
      FROM ib_levels l
      LEFT JOIN ib_partners p ON p.level_id = l.id
      GROUP BY l.id
      ORDER BY l.commission_rate ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ib/levels", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const { name, commission_rate, min_referrals, description } = req.body;
    if (!name || !commission_rate) return res.status(400).json({ success: false, error: "Name and commission rate are required" });
    const id = uuidv4();
    await query(
      `INSERT INTO ib_levels (id, name, commission_rate, min_referrals, description) VALUES (?, ?, ?, ?, ?)`,
      [id, name, commission_rate, min_referrals || 0, description || ""]
    );
    res.json({ success: true, message: "Level created", data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ib/settings", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const [row] = await query(`SELECT * FROM ib_settings WHERE id = 1`);
    res.json({ success: true, data: row || {} });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/ib/settings", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const {
      min_deposit,
      commission_delay_days,
      auto_approve,
      ib_registration_open,
      commission_model,
      referral_base_url,
    } = req.body;

    // Only the two supported models are accepted; anything else would silently
    // change how every future commission is calculated.
    const model = commission_model === "percent_notional" ? "percent_notional" : "per_lot";

    await query(
      `UPDATE ib_settings
          SET min_deposit = ?, commission_delay_days = ?, auto_approve = ?,
              ib_registration_open = ?, commission_model = ?, referral_base_url = ?
        WHERE id = 1`,
      [
        min_deposit || 0,
        commission_delay_days || 0,
        auto_approve ? true : false,
        ib_registration_open ? true : false,
        model,
        referral_base_url || null,
      ]
    );
    res.json({ success: true, message: "Settings saved" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Withdrawal charges + withdrawal reporting
// ─────────────────────────────────────────────────────────────

/** Per-method withdrawal charge rules (USDT / Bank). */
// ── Support ─────────────────────────────────────────────────────────────────

router.get("/support/categories", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const { listCategories } = await import("../lib/support.js");
    res.json({ success: true, data: await listCategories(false) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/support/categories", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { createCategory } = await import("../lib/support.js");
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ success: false, error: "Name is required" });
    res.json({ success: true, data: await createCategory(name, Number(req.body?.sortOrder) || 0) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/support/categories/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { updateCategory } = await import("../lib/support.js");
    res.json({ success: true, data: await updateCategory(String(req.params.id), req.body || {}) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete("/support/categories/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { deleteCategory } = await import("../lib/support.js");
    await deleteCategory(String(req.params.id));
    res.json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/support/tickets", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { listTicketsForAdmin } = await import("../lib/support.js");
    const data = await listTicketsForAdmin({
      status: String(req.query.status || "").trim(),
      category: String(req.query.category || "").trim(),
      search: String(req.query.search || "").trim(),
      limit: Number(req.query.limit) || 100,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/support/tickets/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { getTicket } = await import("../lib/support.js");
    const ticket = await getTicket(String(req.params.id));
    if (!ticket) return res.status(404).json({ success: false, error: "Ticket not found" });
    res.json({ success: true, data: ticket });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/support/tickets/:id/reply", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { addReply } = await import("../lib/support.js");
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ success: false, error: "Message is required" });
    const data = await addReply({
      ticketId: String(req.params.id),
      authorType: "admin",
      authorId: req.user?.id || null,
      authorName: "Support",
      message,
      newStatus: req.body?.status,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch("/support/tickets/:id", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { setTicketStatus } = await import("../lib/support.js");
    res.json({ success: true, data: await setTicketStatus(String(req.params.id), String(req.body?.status || "")) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/withdrawal-fees", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    const { getFeeRules } = await import("../lib/wallet.js");
    res.json({ success: true, data: await getFeeRules() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Two explicit paths rather than an optional ":network?" segment: Express 5 /
// path-to-regexp v8 dropped optional params and throws at route-registration.
const saveWithdrawalFee = async (req: AuthRequest, res: Response) => {
  try {
    const { saveFeeRule, WITHDRAWAL_METHODS, USDT_NETWORKS } = await import("../lib/wallet.js");
    const method = String(req.params.method || "").toLowerCase();
    if (!(WITHDRAWAL_METHODS as string[]).includes(method)) {
      return res.status(400).json({ success: false, error: "Unknown withdrawal method" });
    }

    // A network segment is only meaningful for USDT, and must be one we support.
    const rawNetwork = String(req.params.network || req.body?.network || "").trim().toUpperCase();
    if (rawNetwork && method !== "usdt") {
      return res.status(400).json({ success: false, error: `${method} withdrawals have no network` });
    }
    if (rawNetwork && !(USDT_NETWORKS as readonly string[]).includes(rawNetwork)) {
      return res.status(400).json({ success: false, error: `Unsupported network: ${rawNetwork}` });
    }

    const saved = await saveFeeRule(method as any, req.body || {}, rawNetwork);
    res.json({ success: true, message: "Charges saved", data: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

router.put("/withdrawal-fees/:method", verifyToken, saveWithdrawalFee);
router.put("/withdrawal-fees/:method/:network", verifyToken, saveWithdrawalFee);

/**
 * Withdrawal report: every withdrawal with its method, fee and net payout.
 *
 * Fees live in `withdrawal_details` rather than on `fund_requests` because the
 * application role cannot ALTER tables owned by `doadmin`.
 */
router.get("/reports/withdrawals", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { ensureWalletTables } = await import("../lib/wallet.js");
    await ensureWalletTables();

    const status = String(req.query.status || "").trim();
    const method = String(req.query.method || "").trim();
    const params: any[] = [];
    const clauses: string[] = ["f.type = 'withdrawal'"];
    if (status) { params.push(status); clauses.push(`f.status = $${params.length}`); }
    if (method) { params.push(method); clauses.push(`d.method = $${params.length}`); }

    const rows = await query(
      `SELECT f.id, f.amount, f.status, f.reference_number, f.created_at, f.completed_at,
              d.method, d.fee_amount, d.net_amount, d.fee_type, d.fee_value,
              d.usdt_address, d.usdt_network, d.bank_name, d.bank_account_name,
              d.bank_account_number, d.bank_ifsc, d.bank_swift,
              u.email, u.first_name, u.last_name
         FROM fund_requests f
         LEFT JOIN withdrawal_details d ON d.fund_request_id = f.id::text
         LEFT JOIN users u ON u.id = f.user_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY f.created_at DESC
        LIMIT 500`,
      params
    );

    const [totals] = (await query(
      `SELECT COALESCE(SUM(f.amount), 0) AS gross,
              COALESCE(SUM(d.fee_amount), 0) AS fees,
              COALESCE(SUM(d.net_amount), 0) AS net,
              COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN f.status IN ('pending','processing') THEN f.amount ELSE 0 END), 0) AS in_process
         FROM fund_requests f
         LEFT JOIN withdrawal_details d ON d.fund_request_id = f.id::text
        WHERE f.type = 'withdrawal'`
    )) as any[];

    const byMethod = await query(
      `SELECT COALESCE(d.method, f.method, 'unknown') AS method,
              COUNT(*) AS count,
              COALESCE(SUM(f.amount), 0) AS gross,
              COALESCE(SUM(d.fee_amount), 0) AS fees
         FROM fund_requests f
         LEFT JOIN withdrawal_details d ON d.fund_request_id = f.id::text
        WHERE f.type = 'withdrawal'
        GROUP BY 1 ORDER BY 1`
    );

    res.json({
      success: true,
      data: {
        rows,
        totals: {
          gross: Number(totals?.gross || 0),
          fees: Number(totals?.fees || 0),
          net: Number(totals?.net || 0),
          count: Number(totals?.count || 0),
          inProcess: Number(totals?.in_process || 0),
        },
        byMethod,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Deposit report, mirroring the withdrawal report for the Transactions menu. */
router.get("/reports/deposits", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status || "").trim();
    const params: any[] = [];
    const clauses: string[] = ["f.type = 'deposit'"];
    if (status) { params.push(status); clauses.push(`f.status = $${params.length}`); }

    const rows = await query(
      `SELECT f.id, f.amount, f.method, f.status, f.reference_number, f.created_at, f.completed_at,
              a.account_number, u.email, u.first_name, u.last_name
         FROM fund_requests f
         LEFT JOIN user_accounts a ON a.id = f.account_id
         LEFT JOIN users u ON u.id = f.user_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY f.created_at DESC
        LIMIT 500`,
      params
    );
    const [totals] = (await query(
      `SELECT COALESCE(SUM(amount), 0) AS gross, COUNT(*) AS count,
              COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN amount ELSE 0 END), 0) AS in_process
         FROM fund_requests WHERE type = 'deposit'`
    )) as any[];

    res.json({
      success: true,
      data: {
        rows,
        totals: {
          gross: Number(totals?.gross || 0),
          count: Number(totals?.count || 0),
          inProcess: Number(totals?.in_process || 0),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Commission ledger across all partners, for the admin Referrals view. */
router.get("/ib/commissions", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    await matureCommissions();
    const status = String(req.query.status || "").trim();
    const params: any[] = [];
    let where = "";
    if (status) {
      params.push(status);
      where = `WHERE m.status = $${params.length}`;
    }
    const rows = await query(
      `SELECT m.id, m.trade_id, m.symbol, m.volume, m.rate, m.model, m.amount, m.status,
              m.matures_at, m.paid_at, m.created_at,
              p.ib_code, p.name AS ib_name,
              u.email AS client_email
         FROM ib_commissions m
         LEFT JOIN ib_partners p ON p.id = m.ib_id
         LEFT JOIN users u ON u.id::text = m.client_user_id
         ${where}
        ORDER BY m.created_at DESC
        LIMIT 500`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Clients referred by one partner. */
router.get("/ib/partners/:id/clients", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    const rows = await query(
      `SELECT c.id, c.client_user_id, c.status, c.lifetime_volume, c.lifetime_commission, c.created_at,
              u.email, u.first_name, u.last_name
         FROM ib_clients c
         LEFT JOIN users u ON u.id::text = c.client_user_id
        WHERE c.ib_id = $1
        ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Recomputes every partner's cached counters from the ledger.
 *
 * A repair hatch for rows that predate the ledger or drifted after a manual
 * database edit.
 */
router.post("/ib/recalculate", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureIBTables();
    await matureCommissions();
    const partners = await query(`SELECT id FROM ib_partners`);
    for (const p of partners as any[]) await syncPartnerCounters(p.id);
    res.json({ success: true, message: `Recalculated ${partners.length} partner(s)` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// MAM & PAM (Copy Trade Management) routes
// ─────────────────────────────────────────────────────────────

async function ensureMamPamTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS mam_masters (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      name VARCHAR(255),
      email VARCHAR(255),
      strategy TEXT,
      profit_share DECIMAL(5,2) DEFAULT 20,
      min_copy_amount DECIMAL(18,2) DEFAULT 100,
      total_pnl DECIMAL(18,2) DEFAULT 0,
      followers INT DEFAULT 0,
      copied_trades INT DEFAULT 0,
      admin_pool DECIMAL(18,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS mam_applications (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      name VARCHAR(255),
      email VARCHAR(255),
      strategy TEXT,
      profit_share DECIMAL(5,2) DEFAULT 20,
      min_copy_amount DECIMAL(18,2) DEFAULT 100,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS mam_followers (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      master_id VARCHAR(36),
      follower_name VARCHAR(255),
      master_name VARCHAR(255),
      email VARCHAR(255),
      copy_amount DECIMAL(18,2) DEFAULT 0,
      total_profit DECIMAL(18,2) DEFAULT 0,
      trades_copied INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

router.get("/mampam/stats", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureMamPamTables();
    const [mRow]  = await query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM mam_masters`);
    const [fRow]  = await query(`SELECT COUNT(*) AS total FROM mam_followers WHERE status='active'`);
    const [tRow]  = await query(`SELECT COALESCE(SUM(copied_trades),0) AS total FROM mam_masters`);
    const [oRow]  = await query(`SELECT COUNT(*) AS total FROM trades WHERE status='OPEN'`);
    const [pRow]  = await query(`SELECT COALESCE(SUM(admin_pool),0) AS total FROM mam_masters`);
    res.json({
      success: true,
      data: {
        masterTraders:  Number(mRow?.total   || 0),
        pendingMasters: Number(mRow?.pending  || 0),
        totalFollowers: Number(fRow?.total    || 0),
        copiedTrades:   Number(tRow?.total    || 0),
        openTrades:     Number(oRow?.total    || 0),
        adminPool:      Number(pRow?.total    || 0),
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/mampam/masters", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureMamPamTables();
    const rows = await query(`SELECT * FROM mam_masters ORDER BY created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/mampam/masters/:id/status", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureMamPamTables();
    const { id } = req.params;
    const { status } = req.body;
    await query(`UPDATE mam_masters SET status = ? WHERE id = ?`, [status, id]);
    res.json({ success: true, message: "Status updated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/mampam/applications", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureMamPamTables();
    const rows = await query(`SELECT * FROM mam_applications WHERE status = 'pending' ORDER BY created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/mampam/applications/:id/approve", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureMamPamTables();
    const { id } = req.params;
    const [app] = await query(`SELECT * FROM mam_applications WHERE id = ?`, [id]);
    if (!app) return res.status(404).json({ success: false, error: "Application not found" });
    await query(`UPDATE mam_applications SET status = 'approved' WHERE id = ?`, [id]);
    await query(
      `INSERT INTO mam_masters (id, user_id, name, email, strategy, profit_share, min_copy_amount) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), app.user_id || "", app.name, app.email, app.strategy, app.profit_share || 20, app.min_copy_amount || 100]
    );
    res.json({ success: true, message: "Application approved — master trader created" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/mampam/applications/:id/reject", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureMamPamTables();
    const { id } = req.params;
    await query(`UPDATE mam_applications SET status = 'rejected' WHERE id = ?`, [id]);
    res.json({ success: true, message: "Application rejected" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/mampam/followers", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    await ensureMamPamTables();
    const rows = await query(`SELECT * FROM mam_followers ORDER BY created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ------------------------------------------------------------------ *
 * Open-trade administration
 *
 * Lets an administrator close or amend a trader's open position from the
 * Trade Settings page.
 *
 * Closing settles real money, so the close price is taken from the
 * server-authoritative feed (getSettlementPrice) and never from the request
 * body — the same rule the trader-facing close path follows. An admin can
 * override it, but that is recorded as a distinct closing reason.
 * ------------------------------------------------------------------ */

router.post("/trades/:id/close", async (req: AuthRequest, res: Response) => {
  try {
    const tradeId = Number(req.params.id);
    if (!Number.isInteger(tradeId) || tradeId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid trade id" });
    }

    const existing = await query(
      `SELECT id, symbol, side, status FROM trades WHERE id = $1`,
      [tradeId],
    );
    const trade = existing?.[0];
    if (!trade) {
      return res.status(404).json({ success: false, error: "Trade not found" });
    }
    if (String(trade.status).toUpperCase() !== "OPEN") {
      return res.status(409).json({ success: false, error: "Trade is already closed" });
    }

    // An explicit admin price is allowed but must be deliberate; otherwise the
    // live server price is used.
    const overrideRaw = req.body?.closePrice;
    const hasOverride = overrideRaw !== undefined && overrideRaw !== null && overrideRaw !== "";
    let closePrice: number | null = null;
    let reason = "ADMIN_CLOSE";

    if (hasOverride) {
      const parsed = Number(overrideRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, error: "closePrice must be a positive number" });
      }
      closePrice = parsed;
      reason = "ADMIN_CLOSE_MANUAL_PRICE";
    } else {
      closePrice = await getSettlementPrice(trade.symbol, trade.side, "CLOSE");
      if (closePrice == null) {
        // Refusing beats settling at a stale or invented price.
        return res.status(503).json({
          success: false,
          error: `No fresh market price available for ${trade.symbol}. Retry, or supply an explicit closePrice.`,
        });
      }
    }

    const result = await closeTrade(tradeId, closePrice, reason);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, tradeId, closePrice, finalPnL: result.finalPnL, reason });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Amend stop loss / take profit on an open trade. */
router.patch("/trades/:id", async (req: AuthRequest, res: Response) => {
  try {
    const tradeId = Number(req.params.id);
    if (!Number.isInteger(tradeId) || tradeId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid trade id" });
    }

    const existing = await query(`SELECT id, status FROM trades WHERE id = $1`, [tradeId]);
    const trade = existing?.[0];
    if (!trade) {
      return res.status(404).json({ success: false, error: "Trade not found" });
    }
    if (String(trade.status).toUpperCase() !== "OPEN") {
      return res.status(409).json({ success: false, error: "Only open trades can be amended" });
    }

    const parseLevel = (value: unknown, label: string): number | null | undefined => {
      if (value === undefined) return undefined;            // not supplied — leave as is
      if (value === null || value === "") return null;       // explicitly cleared
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be a positive number or empty`);
      return n;
    };

    const stopLoss = parseLevel(req.body?.stopLoss, "stopLoss");
    const takeProfit = parseLevel(req.body?.takeProfit, "takeProfit");

    let volume: number | undefined;
    if (req.body?.volume !== undefined && req.body?.volume !== null && req.body?.volume !== "") {
      const parsed = Number(req.body.volume);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, error: "volume must be greater than 0" });
      }
      volume = parsed;
    }

    let side: "BUY" | "SELL" | undefined;
    if (req.body?.side !== undefined && req.body?.side !== null && req.body?.side !== "") {
      const normalized = String(req.body.side).trim().toUpperCase();
      if (normalized !== "BUY" && normalized !== "SELL") {
        return res.status(400).json({ success: false, error: "side must be BUY or SELL" });
      }
      side = normalized;
    }

    if (stopLoss === undefined && takeProfit === undefined && volume === undefined && side === undefined) {
      return res.status(400).json({ success: false, error: "Nothing to update" });
    }

    // Entry price stays fixed — rewriting it would silently restate the P&L
    // already accrued against the position.
    //
    // Volume, when changed, must move the locked margin with it: the original
    // lock was computed from the old volume, so writing a new volume alone
    // would leave the trader's available balance wrong for the life of the
    // trade. Done under one transaction with a row lock.
    const conn = await getConnection();
    const warnings: string[] = [];
    try {
      await conn.query("BEGIN");

      const locked = await conn.query(
        `SELECT id, user_id, account_id, symbol, side, volume, entry_price, leverage,
                locked_balance, stop_loss, take_profit, pnl
           FROM trades WHERE id = $1 AND status = 'OPEN' FOR UPDATE`,
        [tradeId],
      );
      const row = locked.rows?.[0];
      if (!row) {
        await conn.query("ROLLBACK");
        return res.status(409).json({ success: false, error: "Trade is no longer open" });
      }

      const sets: string[] = [];
      const params: any[] = [];

      if (stopLoss !== undefined) {
        params.push(stopLoss);
        sets.push(`stop_loss = $${params.length}`);
      }
      if (takeProfit !== undefined) {
        params.push(takeProfit);
        sets.push(`take_profit = $${params.length}`);
      }

      /**
       * Side swap. Margin is side-independent, so the lock is untouched — but
       * two things do change:
       *
       *  - SL/TP sit on opposite sides of entry for BUY vs SELL. Carrying them
       *    across a flip would leave a stop that is instantly triggerable, so
       *    any level that ends up on the wrong side is cleared rather than
       *    silently left armed.
       *  - Stored pnl was computed for the old direction; negating it keeps the
       *    row coherent until the next price tick recomputes it.
       */
      const sideChanged = side !== undefined && side !== String(row.side).toUpperCase();
      if (sideChanged) {
        params.push(side);
        sets.push(`side = $${params.length}`);

        const entry = Number(row.entry_price);
        const effectiveSl = stopLoss !== undefined ? stopLoss : (row.stop_loss === null ? null : Number(row.stop_loss));
        const effectiveTp = takeProfit !== undefined ? takeProfit : (row.take_profit === null ? null : Number(row.take_profit));

        // BUY expects SL below entry and TP above; SELL is the mirror image.
        const slValid = effectiveSl === null || (side === "BUY" ? effectiveSl < entry : effectiveSl > entry);
        const tpValid = effectiveTp === null || (side === "BUY" ? effectiveTp > entry : effectiveTp < entry);

        if (!slValid) {
          params.push(null);
          sets.push(`stop_loss = $${params.length}`);
          warnings.push("stop loss cleared — it was on the wrong side of entry after the swap");
        }
        if (!tpValid) {
          params.push(null);
          sets.push(`take_profit = $${params.length}`);
          warnings.push("take profit cleared — it was on the wrong side of entry after the swap");
        }

        const currentPnl = Number(row.pnl);
        if (Number.isFinite(currentPnl) && currentPnl !== 0) {
          params.push(-currentPnl);
          sets.push(`pnl = $${params.length}`);
        }
      }

      if (volume !== undefined) {
        const newLocked = getRequiredMargin(row.symbol, volume, Number(row.entry_price), Number(row.leverage));
        if (newLocked == null) {
          await conn.query("ROLLBACK");
          return res.status(400).json({ success: false, error: "Could not recalculate margin for that volume" });
        }

        const oldLocked = Number(row.locked_balance) || 0;
        const delta = newLocked - oldLocked;
        const accountId = row.account_id || (await resolveActiveAccountId(row.user_id, conn));
        if (!accountId) {
          await conn.query("ROLLBACK");
          return res.status(400).json({ success: false, error: "No account found to adjust margin against" });
        }

        if (delta > 0) {
          const lockRes = await lockBalance(accountId, delta, conn);
          if (!lockRes.success) {
            await conn.query("ROLLBACK");
            return res.status(400).json({ success: false, error: lockRes.error || "Insufficient free margin for the larger volume" });
          }
        } else if (delta < 0) {
          const unlockRes = await unlockBalance(accountId, -delta, conn);
          if (!unlockRes.success) {
            await conn.query("ROLLBACK");
            return res.status(400).json({ success: false, error: unlockRes.error });
          }
        }

        params.push(volume);
        sets.push(`volume = $${params.length}`);
        params.push(newLocked);
        sets.push(`locked_balance = $${params.length}`);
      }

      params.push(tradeId);
      await conn.query(`UPDATE trades SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
      await conn.query("COMMIT");
    } catch (txError: any) {
      await conn.query("ROLLBACK").catch(() => {});
      return res.status(500).json({ success: false, error: txError.message });
    } finally {
      conn.release();
    }

    const updated = await query(
      `SELECT id, symbol, side, volume, stop_loss, take_profit, locked_balance FROM trades WHERE id = $1`,
      [tradeId],
    );
    res.json({ success: true, trade: updated?.[0], warnings });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Delete a trade record outright.
 *
 * This is not "close" — it removes the row and leaves no settlement. An OPEN
 * trade also holds locked margin, so deleting one without releasing it would
 * strand the trader's balance; that release happens here in the same
 * transaction. Intended for cleaning up erroneous records, not for exiting
 * positions — use /close for that.
 */
router.delete("/trades/:id", async (req: AuthRequest, res: Response) => {
  const tradeId = Number(req.params.id);
  if (!Number.isInteger(tradeId) || tradeId <= 0) {
    return res.status(400).json({ success: false, error: "Invalid trade id" });
  }

  const conn = await getConnection();
  try {
    await conn.query("BEGIN");

    const found = await conn.query(
      `SELECT id, user_id, account_id, status, locked_balance FROM trades WHERE id = $1 FOR UPDATE`,
      [tradeId],
    );
    const trade = found.rows?.[0];
    if (!trade) {
      await conn.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Trade not found" });
    }

    if (String(trade.status).toUpperCase() === "OPEN") {
      const accountId = trade.account_id || (await resolveActiveAccountId(trade.user_id, conn));
      if (accountId) {
        const unlocked = await unlockBalance(accountId, trade.locked_balance, conn);
        if (!unlocked.success) {
          await conn.query("ROLLBACK");
          return res.status(400).json({ success: false, error: unlocked.error });
        }
      }
    }

    await conn.query(`DELETE FROM trades WHERE id = $1`, [tradeId]);
    await conn.query("COMMIT");
    res.json({ success: true, tradeId, releasedMargin: String(trade.status).toUpperCase() === "OPEN" });
  } catch (error: any) {
    await conn.query("ROLLBACK").catch(() => {});
    res.status(500).json({ success: false, error: error.message });
  } finally {
    conn.release();
  }
});

/**
 * Open a position on a trader's behalf.
 *
 * Uses the same validate + create path as the trader-facing route, so margin,
 * balance and SL/TP rules are identical. The entry price comes from the
 * server-authoritative feed unless an admin deliberately supplies one.
 */
router.post("/trades", async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.body?.userId ?? "").trim();
    const symbol = String(req.body?.symbol ?? "").trim().toUpperCase();
    const side = String(req.body?.side ?? "").trim().toUpperCase();
    const volume = Number(req.body?.volume);
    const leverage = Number(req.body?.leverage ?? 100);

    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });
    if (!symbol) return res.status(400).json({ success: false, error: "symbol is required" });
    if (side !== "BUY" && side !== "SELL") {
      return res.status(400).json({ success: false, error: "side must be BUY or SELL" });
    }
    if (!Number.isFinite(volume) || volume <= 0) {
      return res.status(400).json({ success: false, error: "volume must be greater than 0" });
    }

    const parseLevel = (value: unknown) => {
      if (value === undefined || value === null || value === "") return null;
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const stopLoss = parseLevel(req.body?.stopLoss);
    const takeProfit = parseLevel(req.body?.takeProfit);

    const userRow = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!userRow?.length) {
      return res.status(404).json({ success: false, error: "Trader not found" });
    }

    let entryPrice: number | null;
    const overrideRaw = req.body?.entryPrice;
    if (overrideRaw !== undefined && overrideRaw !== null && overrideRaw !== "") {
      const parsed = Number(overrideRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, error: "entryPrice must be a positive number" });
      }
      entryPrice = parsed;
    } else {
      entryPrice = await getSettlementPrice(symbol, side, "OPEN");
      if (entryPrice == null) {
        return res.status(503).json({
          success: false,
          error: `No fresh market price available for ${symbol}. Retry, or supply an explicit entryPrice.`,
        });
      }
    }

    const validation = await validateTradeOpen(userId, symbol, side, volume, entryPrice, leverage, stopLoss, takeProfit);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const created = await createTrade(userId, symbol, side as "BUY" | "SELL", volume, entryPrice, takeProfit, stopLoss, leverage);
    if (!created.success) {
      return res.status(400).json({ success: false, error: created.error });
    }

    res.json({ success: true, tradeId: created.tradeId, symbol, side, volume, entryPrice, leverage });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ------------------------------------------------------------------ *
 * Offer banners — hero images on the trader dashboard
 *
 * Admin-only CRUD. The trading client reads the enabled ones from the public
 * GET /api/offers (see routes/offers.ts).
 * ------------------------------------------------------------------ */

router.get("/offers", async (_req: AuthRequest, res: Response) => {
  try {
    await ensureOfferBannersTable();
    res.json({ success: true, data: await listOfferBanners() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/offers", uploadOfferImage.single("image"), async (req: AuthRequest, res: Response) => {
  try {
    await ensureOfferBannersTable();

    // Either an uploaded file or an external URL, but one of them is required.
    const uploaded = req.file ? `/uploads/offers/${req.file.filename}` : null;
    const provided = String(req.body?.imageUrl ?? "").trim();
    const imageUrl = uploaded || provided;

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: "An image file or imageUrl is required" });
    }

    const sortOrderRaw = Number(req.body?.sortOrder);
    const banner = await createOfferBanner({
      imageUrl,
      title: req.body?.title?.trim() || null,
      subtitle: req.body?.subtitle?.trim() || null,
      linkUrl: req.body?.linkUrl?.trim() || null,
      sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0,
      enabled: req.body?.enabled === undefined ? true : String(req.body.enabled) !== "false",
    });

    res.json({ success: true, data: banner });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/offers/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid banner id" });
    }

    const patch: any = {};
    if (req.body?.title !== undefined) patch.title = req.body.title?.trim() || null;
    if (req.body?.subtitle !== undefined) patch.subtitle = req.body.subtitle?.trim() || null;
    if (req.body?.linkUrl !== undefined) patch.linkUrl = req.body.linkUrl?.trim() || null;
    if (req.body?.enabled !== undefined) patch.enabled = Boolean(req.body.enabled);
    if (req.body?.sortOrder !== undefined) {
      const n = Number(req.body.sortOrder);
      if (!Number.isFinite(n)) return res.status(400).json({ success: false, error: "sortOrder must be a number" });
      patch.sortOrder = n;
    }

    const updated = await updateOfferBanner(id, patch);
    if (!updated) return res.status(404).json({ success: false, error: "Banner not found or nothing to update" });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/offers/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: "Invalid banner id" });
    }

    const removed = await deleteOfferBanner(id);
    if (!removed) return res.status(404).json({ success: false, error: "Banner not found" });

    // Best-effort file cleanup; a missing file must not fail the request.
    const filePath = resolveOfferFilePath(removed.imageUrl);
    if (filePath) {
      fs.promises.unlink(filePath).catch(() => {});
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ------------------------------------------------------------------ *
 * Forex charges — spread configuration
 *
 * Backs the admin Forex Charges page. Spreads are stored here and applied
 * server-side in fxincap-ws at the quote boundary, never in the browser.
 *
 * Mounted under /api/admin, which index.ts guards with verifyToken +
 * requireAdmin, so these inherit administrator authorization.
 * ------------------------------------------------------------------ */

router.get("/forex-charges", async (_req: AuthRequest, res: Response) => {
  try {
    await ensureSymbolSpreadsTable();
    const spreads = await listSymbolSpreads();
    // commissions/swaps are not implemented yet; the page renders all three
    // sections, so return empty lists rather than letting it read undefined.
    res.json({ success: true, spreads, commissions: [], swaps: [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/forex-charges/spread", async (req: AuthRequest, res: Response) => {
  try {
    const rawSymbol = String(req.body?.symbol ?? "").trim().toUpperCase();
    if (!rawSymbol) {
      return res.status(400).json({ success: false, error: "symbol is required" });
    }
    if (!/^[A-Z0-9._]{2,32}$/.test(rawSymbol)) {
      return res.status(400).json({ success: false, error: "symbol must be 2-32 characters (A-Z, 0-9, dot, underscore)" });
    }

    const pips = Number(req.body?.spreadPips);
    if (!Number.isFinite(pips) || pips < 0) {
      return res.status(400).json({ success: false, error: "spreadPips must be a number >= 0" });
    }
    // A markup this wide is almost certainly a unit mix-up (price vs pips) and
    // would make the symbol untradeable, so refuse rather than apply it.
    if (pips > 1000) {
      return res.status(400).json({ success: false, error: "spreadPips above 1000 is rejected as a likely unit error" });
    }

    const enabled = req.body?.enabled === undefined ? true : Boolean(req.body.enabled);

    await ensureSymbolSpreadsTable();
    const saved = await upsertSymbolSpread(rawSymbol, pips, enabled);
    res.json({ success: true, spread: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/forex-charges/spread/:symbol", async (req: AuthRequest, res: Response) => {
  try {
    await ensureSymbolSpreadsTable();
    const removed = await deleteSymbolSpread(req.params.symbol);
    if (!removed) {
      return res.status(404).json({ success: false, error: "No spread configured for that symbol" });
    }
    res.json({ success: true });
  } catch (error: any) {
    // deleteSymbolSpread throws when asked to remove the structural ALL row.
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;


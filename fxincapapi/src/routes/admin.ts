import { Router, Response, Request } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { fetchUserById, fetchUsers, countUsers, deleteUserIfEligible } from "../services/adminUsers.js";
import { fetchFundRequests, updateFundRequestStatus, fetchFundRequestById, completeDepositAndCredit, completeWithdrawalAndDebit, rejectWithdrawalAndCredit } from "../services/adminFunds.js";
import { fetchKycDocuments, fetchKycDocumentById, updateKycStatus } from "../services/adminKyc.js";
import { getAutoCloseTimeoutMinutes, setAutoCloseTimeoutMinutes } from "../lib/trade-settings.js";
import { getConnection, query } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { imageSizeFromFile } from "image-size/fromFile";
import { getStoredEmailSettings, maskEmailApiKey, saveStoredEmailSettings } from "../lib/email-settings.js";
import {
  getEmailProvider,
  getStoredSmtpSettings,
  maskSmtpPassword,
  saveStoredSmtpSettings,
  setEmailProvider,
} from "../lib/smtp-settings.js";
import { sendEmail } from "../lib/mailer.js";

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
      // For withdrawals, credit the balance back
      result = await rejectWithdrawalAndCredit(requestId);
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

// Get reports
router.get("/reports", verifyToken, async (req: AuthRequest, res: Response) => {
  res.json([]);
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

// Get all positions
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
    const [sgSettings, smtpSettings, emailProvider] = await Promise.all([
      getStoredEmailSettings(),
      getStoredSmtpSettings(),
      getEmailProvider(),
    ]);
    res.json({
      success: true,
      data: {
        // SendGrid
        sendgridFrom: sgSettings.sendgridFrom || "",
        hasSendgridApiKey: Boolean(sgSettings.sendgridApiKey),
        maskedSendgridApiKey: maskEmailApiKey(sgSettings.sendgridApiKey),
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

    // --- SendGrid ---
    const sendgridFrom = String(body.sendgridFrom || "").trim();
    if (sendgridFrom && !emailRegex.test(sendgridFrom)) {
      return res.status(400).json({ success: false, error: "Enter a valid SendGrid from email address" });
    }
    const currentSg = await getStoredEmailSettings();
    const sendgridApiKeyInput = body.sendgridApiKey;
    const nextApiKey = typeof sendgridApiKeyInput === "string" && sendgridApiKeyInput.trim()
      ? sendgridApiKeyInput.trim()
      : currentSg.sendgridApiKey;
    const savedSg = await saveStoredEmailSettings({
      sendgridApiKey: nextApiKey,
      sendgridFrom: sendgridFrom || currentSg.sendgridFrom,
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
    if (providerInput === "smtp" || providerInput === "sendgrid") {
      await setEmailProvider(providerInput as "smtp" | "sendgrid");
    }
    const emailProvider = await getEmailProvider();

    res.json({
      success: true,
      data: {
        sendgridFrom: savedSg.sendgridFrom,
        hasSendgridApiKey: Boolean(savedSg.sendgridApiKey),
        maskedSendgridApiKey: maskEmailApiKey(savedSg.sendgridApiKey),
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

router.get("/style-settings", async (req: Request, res: Response) => {
  try {
    await ensureStyleSettingsTable();

    const shadcnTheme = await getStoredShadcnTheme();
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
        logoLightUrl: toPublicLogoUrl(req, storedLogos.light),
        logoDarkUrl: toPublicLogoUrl(req, storedLogos.dark),
        logoSquareUrl: toPublicLogoUrl(req, storedLogos.square),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/style-settings", verifyToken, async (req: AuthRequest, res: Response) => {
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
    } = req.body;
    await ensureStyleSettingsTable();
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
    await saveStoredShadcnTheme(nextShadcnTheme);
    
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

export default router;


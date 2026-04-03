import { Router, Request, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { query } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendDepositEmail, sendEmail } from "../lib/mailer.js";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// ...existing code...


// Multer storage for profile pictures
const uploadDir = path.join(__dirname, "../../uploads/profile-pictures");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for KYC documents
const kycUploadDir = path.join(__dirname, "../../uploads/kyc-documents");
if (!fs.existsSync(kycUploadDir)) {
  fs.mkdirSync(kycUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `profile-${unique}${path.extname(file.originalname)}`);
  },
});

const kycStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, kycUploadDir),
  filename: (req: any, file, cb) => {
    const userId = req.user?.id || 'unknown';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `kyc-${userId}-${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const isExtOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const isMimeOk = allowed.test(file.mimetype);
    if (isExtOk && isMimeOk) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});
const kycUpload = multer({
  storage: kycStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = /^image\/(jpeg|png|gif|webp)$/i;
    if (allowedMimeTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});
// Multer storage for deposit screenshots
const depositDir = path.join(__dirname, "../../uploads/deposit-screenshots");
if (!fs.existsSync(depositDir)) {
  fs.mkdirSync(depositDir, { recursive: true });
}

const depositStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, depositDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `deposit-${unique}${path.extname(file.originalname)}`);
  },
});

const uploadDeposit = multer({
  storage: depositStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(jpeg|jpg|png|gif|webp)$/i;
    const allowedMime = /^image\/(jpeg|png|gif|webp)$/i;
    const isExtOk = allowedExt.test(file.originalname.toLowerCase());
    const isMimeOk = allowedMime.test(file.mimetype.toLowerCase());
    if (isExtOk && isMimeOk) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

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

const ensureDepositFeatureSchema = async () => {
  const runOptionalMigration = async (sql: string) => {
    try {
      await query(sql);
    } catch (error: any) {
      const msg = String(error?.message || "").toLowerCase();
      // In production, API role may not own legacy tables; skip optional ALTERs in that case.
      if (msg.includes("must be owner") || msg.includes("permission denied")) {
        console.warn("[DEPOSIT] Skipping optional migration due to DB role permissions:", sql);
        return;
      }
      throw error;
    }
  };

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

  await query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(64) UNIQUE NOT NULL,
      discount_percent DECIMAL(6,2) NOT NULL DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      starts_at TIMESTAMP NULL,
      expires_at TIMESTAMP NULL,
      max_uses INTEGER NULL,
      used_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runOptionalMigration("ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32)");
  await runOptionalMigration("ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS payment_chain VARCHAR(32)");
  await runOptionalMigration("ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS promo_code VARCHAR(64)");
  await runOptionalMigration("ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS promo_discount_percent DECIMAL(6,2)");
  await runOptionalMigration("ALTER TABLE fund_requests ADD COLUMN IF NOT EXISTS remarks TEXT");

  await query(
    `INSERT INTO promo_codes (id, code, discount_percent, active, max_uses)
     SELECT ?, 'WELCOME10', 10, TRUE, NULL
     WHERE NOT EXISTS (SELECT 1 FROM promo_codes WHERE UPPER(code) = 'WELCOME10')`,
    [uuidv4()]
  );
};

let cachedFundRequestColumns: Set<string> | null = null;

const getFundRequestColumns = async () => {
  if (cachedFundRequestColumns) return cachedFundRequestColumns;

  const rows = await query(
    `SELECT LOWER(column_name) AS column_name
     FROM information_schema.columns
     WHERE LOWER(table_name) = 'fund_requests'`
  ) as any[];

  const next = new Set(
    (Array.isArray(rows) ? rows : [])
      .map((r: any) => String(r.column_name || "").toLowerCase())
      .filter(Boolean)
  );

  cachedFundRequestColumns = next;
  return next;
};

const normalizePromoCode = (value: any) => String(value || "").trim().toUpperCase();

const resolvePromo = async (promoCodeRaw: any) => {
  const promoCode = normalizePromoCode(promoCodeRaw);
  if (!promoCode) {
    return {
      code: null,
      valid: false,
      discountPercent: 0,
      reason: null,
    };
  }

  await ensureDepositFeatureSchema();
  const rows = await query(
    `SELECT id, code, discount_percent, active, starts_at, expires_at, max_uses, used_count
     FROM promo_codes
     WHERE UPPER(code) = ?
     LIMIT 1`,
    [promoCode]
  ) as any[];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { code: promoCode, valid: false, discountPercent: 0, reason: "Promo code not found" };
  }

  const row = rows[0];
  if (row.active === false) {
    return { code: promoCode, valid: false, discountPercent: 0, reason: "Promo code is inactive" };
  }

  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) {
    return { code: promoCode, valid: false, discountPercent: 0, reason: "Promo code is not active yet" };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < now) {
    return { code: promoCode, valid: false, discountPercent: 0, reason: "Promo code has expired" };
  }

  const maxUses = row.max_uses === null || row.max_uses === undefined ? null : Number(row.max_uses);
  const usedCount = Number(row.used_count || 0);
  if (maxUses !== null && usedCount >= maxUses) {
    return { code: promoCode, valid: false, discountPercent: 0, reason: "Promo code usage limit reached" };
  }

  const discountPercent = Math.max(0, Math.min(100, Number(row.discount_percent || 0)));
  return { code: promoCode, valid: true, discountPercent, reason: null };
};

const usdtWallets: Record<string, string> = {
  ERC20: "0x7f07dB2b7D94C6A4274f814d6f79CB4fAecB6110",
  TRC20: "TLfLaBvJ5H8j8qCWjVQ63Hz8xYx2f2Qj1P",
  BEP20: "0x7f07dB2b7D94C6A4274f814d6f79CB4fAecB6110",
};

router.get("/deposit-payment-config", verifyToken, async (_req: AuthRequest, res) => {
  try {
    const methods = [
      { code: "USDT", label: "USDT", active: true },
      { code: "BTC", label: "BTC", active: false },
      { code: "USD", label: "USD", active: false },
    ];
    const chains = Object.keys(usdtWallets).map((key) => ({
      code: key,
      label: key,
      walletAddress: usdtWallets[key],
    }));

    res.json({ success: true, data: { methods, chains } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load payment config" });
  }
});

router.get("/deposit-offers", verifyToken, async (_req: AuthRequest, res) => {
  try {
    await ensureDepositFeatureSchema();
    const rows = await query(
      `SELECT id, title, description, badge, active, sort_order, created_at
       FROM deposit_offers
       WHERE active = TRUE
       ORDER BY sort_order ASC, created_at DESC`
    ) as any[];

    const offers = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      badge: row.badge || null,
      active: row.active !== false,
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at,
    }));

    res.json({ success: true, data: offers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load offers" });
  }
});

router.post("/deposit/validate-promo", verifyToken, async (req: AuthRequest, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be greater than 0" });
    }

    const promo = await resolvePromo(req.body?.promoCode);
    if (!promo.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: promo.reason || "Invalid promo code",
      });
    }

    const discountAmount = (amount * promo.discountPercent) / 100;
    const payableAmount = Math.max(0, amount - discountAmount);

    res.json({
      success: true,
      valid: true,
      data: {
        code: promo.code,
        discountPercent: promo.discountPercent,
        discountAmount,
        payableAmount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to validate promo" });
  }
});

// ==========================================
// 1. Get User Profile
// ==========================================
router.get("/profile", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const userResults = await query("SELECT * FROM users WHERE id = ?", [userId]);
    if (!Array.isArray(userResults) || userResults.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = userResults[0] as any;
    const profileResults = await query("SELECT * FROM user_profiles WHERE user_id = ?", [userId]);
    const profile = (Array.isArray(profileResults) && profileResults.length > 0 ? profileResults[0] : {}) as any;
    const accountResults = await query("SELECT * FROM user_accounts WHERE user_id = ? LIMIT 1", [userId]);
    const account = (Array.isArray(accountResults) && accountResults.length > 0 ? accountResults[0] : null) as any;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        countryCode: user.country_code,
        status: user.status,
        createdAt: user.created_at,
      },
      profile: {
        kycStatus: profile.kyc_status || "pending",
        accountType: profile.account_type || "standard",
        leverage: profile.leverage || 500,
        profilePicture: profile.profile_picture || null,
        profile_picture: profile.profile_picture || null,
      },
      account: account ? { balance: parseFloat(account.balance), equity: parseFloat(account.equity) } : null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 2. Update User Profile
// ==========================================
router.put("/profile", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, phone, countryCode } = req.body;
    if (firstName || lastName || phone || countryCode) {
      const updates: string[] = [];
      const values: any[] = [];
      if (firstName) updates.push("first_name = ?"), values.push(firstName);
      if (lastName) updates.push("last_name = ?"), values.push(lastName);
      if (phone !== undefined) updates.push("phone = ?"), values.push(phone || null);
      if (countryCode !== undefined) updates.push("country_code = ?"), values.push(countryCode || null);
      values.push(userId);
      await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
    }
    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. Get Account Balance (Demo vs Real)
// ==========================================
router.get("/balance", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    let mode = (req.query.mode as string) || "";

    // If no mode in query: prefer real when a real account row exists unless the user explicitly chose demo in Settings.
    if (!mode) {
      const profileRows = await query(
        "SELECT selected_trading_mode FROM user_profiles WHERE user_id = $1 LIMIT 1",
        [userId]
      ) as any[];
      const persisted =
        Array.isArray(profileRows) && profileRows.length > 0
          ? profileRows[0].selected_trading_mode
          : null;

      const hasRealRows = await query(
        "SELECT 1 FROM user_accounts WHERE user_id = $1 AND trading_mode = 'real' LIMIT 1",
        [userId]
      ) as any[];
      const hasReal = Array.isArray(hasRealRows) && hasRealRows.length > 0;

      if (hasReal) {
        mode = persisted === "demo" ? "demo" : "real";
      } else {
        mode = persisted || "demo";
      }
    }

    // Fetch account by user_id and trading_mode
    const accountResults = await query(
      "SELECT * FROM user_accounts WHERE user_id = $1 AND trading_mode = $2 LIMIT 1",
      [userId, mode]
    );
    
    if (!Array.isArray(accountResults) || accountResults.length === 0) {
      // If no account found for this mode, return zero balance
      return res.json({
        success: true,
        balance: {
          tradingMode: mode,
          accountNumber: null,
          balance: 0,
          equity: 0,
          margin: 0,
          freeMargin: 0,
          currency: "USD",
        },
      });
    }
    
    const account = accountResults[0] as any;
    const totalBalance = parseFloat(account.balance) || 0;
    const lockedBalance =
      account.locked_balance !== undefined && account.locked_balance !== null
        ? parseFloat(account.locked_balance)
        : parseFloat(account.margin_used) || 0;
    // available_balance may be 0 if column was not populated when the account was funded;
    // fall back to balance - locked_balance in that case.
    const storedAvailableBal = parseFloat(account.available_balance) || 0;
    const computedAvailable = Math.max(0, totalBalance - lockedBalance);
    const availableBalance = storedAvailableBal > 0 ? storedAvailableBal : computedAvailable;

    res.json({
      success: true,
      balance: {
        tradingMode: account.trading_mode || mode,
        accountNumber: account.account_number || account.accountNumber || null,
        balance: totalBalance,
        equity: parseFloat(account.equity) || 0,
        margin: lockedBalance,
        freeMargin: availableBalance,
        currency: account.currency || "USD",
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/trading-mode", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { tradingMode: requestedTradingMode, mode } = req.body || {};
    const tradingMode = requestedTradingMode || mode;
    if (!tradingMode || !["demo", "real"].includes(String(tradingMode))) {
      return res.status(400).json({ success: false, message: "Invalid trading mode" });
    }

    const acctRows = await query(
      "SELECT account_number, balance, equity, margin_free FROM user_accounts WHERE user_id = $1 AND trading_mode = $2 LIMIT 1",
      [userId, tradingMode]
    );
    if (!Array.isArray(acctRows) || acctRows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found for selected mode" });
    }

    const updated = await query(
      "UPDATE user_profiles SET selected_trading_mode = $1 WHERE user_id = $2 RETURNING user_id",
      [tradingMode, userId]
    );
    if (!Array.isArray(updated) || updated.length === 0) {
      await query("INSERT INTO user_profiles (id, user_id, selected_trading_mode) VALUES ($1, $2, $3)", [
        uuidv4(),
        userId,
        tradingMode,
      ]);
    }

    const acct = acctRows[0] as any;
    const margin =
      acct.margin_free != null && acct.equity != null && acct.balance != null
        ? Math.max(0, Number(acct.equity) - Number(acct.margin_free))
        : 0;
    const marginLevel = margin > 0 ? Number(((Number(acct.equity) / margin) * 100).toFixed(2)) : 0;
    const levRows = await query("SELECT leverage FROM user_profiles WHERE user_id = $1 LIMIT 1", [userId]);
    const leverage =
      Array.isArray(levRows) && levRows.length > 0 ? Number((levRows[0] as any).leverage || 500) : 500;

    res.json({
      success: true,
      message: "Trading mode applied",
      data: {
        tradingMode,
        accountNumber: acct.account_number,
        balance: Number(acct.balance),
        equity: Number(acct.equity),
        margin,
        freeMargin: Number(acct.margin_free),
        marginLevel,
        currency: "USD",
        leverage,
      },
    });
  } catch (error: any) {
    console.error("Error updating trading mode:", error);
    res.status(500).json({ success: false, message: "Failed to update trading mode" });
  }
});

router.get("/account-activation-settings", verifyToken, async (_req: AuthRequest, res) => {
  try {
    const settings = await getUserAccountSettings();
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to load account activation settings" });
  }
});

router.post("/activate-real-account", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const settings = await getUserAccountSettings();
    if (!settings.realAccountActivationEnabled) {
      return res.status(403).json({
        success: false,
        message: "Real account activation is currently unavailable, please contact support for more information",
      });
    }

    const existingReal = await query(
      "SELECT account_number, balance, equity, margin_free, currency FROM user_accounts WHERE user_id = ? AND trading_mode = 'real' LIMIT 1",
      [userId]
    ) as any[];

    if (Array.isArray(existingReal) && existingReal.length > 0) {
      const account = existingReal[0];
      await query("UPDATE user_profiles SET selected_trading_mode = ? WHERE user_id = ?", ["real", userId]);
      return res.json({
        success: true,
        alreadyExists: true,
        message: "Your real account has been activated successfully",
        data: {
          tradingMode: "real",
          accountNumber: account.account_number,
          balance: Number(account.balance || 0),
          equity: Number(account.equity || 0),
          margin: 0,
          freeMargin: Number(account.margin_free || 0),
          currency: String(account.currency || "USD"),
          leverage: 500,
        },
      });
    }

    const demoRows = await query(
      "SELECT id FROM user_accounts WHERE user_id = ? AND trading_mode = 'demo' LIMIT 1",
      [userId]
    ) as any[];

    if (!Array.isArray(demoRows) || demoRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please create a demo account first",
      });
    }

    if (settings.kycRequiredForRealAccount) {
      const profileRows = await query(
        "SELECT kyc_status FROM user_profiles WHERE user_id = ? LIMIT 1",
        [userId]
      ) as any[];

      const kycStatus = String((Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0].kyc_status : "pending") || "pending").toLowerCase();
      if (!["approved", "verified"].includes(kycStatus)) {
        return res.status(400).json({
          success: false,
          requiresKyc: true,
          message: "Please complete your KYC verification to activate real account",
        });
      }
    }

    const realAccountNumber = `REAL-${String(userId).slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    await query(
      "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, available_balance, trading_mode, currency, account_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'real', 'USD', 'active')",
      [uuidv4(), userId, realAccountNumber, 0, 0, 0, 0]
    );

    await query("UPDATE user_profiles SET selected_trading_mode = ? WHERE user_id = ?", ["real", userId]);

    const message = settings.kycRequiredForRealAccount
      ? "Your real account has been activated successfully"
      : "Your real account has been created successfully";

    return res.json({
      success: true,
      message,
      data: {
        tradingMode: "real",
        accountNumber: realAccountNumber,
        balance: 0,
        equity: 0,
        margin: 0,
        freeMargin: 0,
        currency: "USD",
        leverage: 500,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Failed to activate real account, please try again later", error: error.message });
  }
});

// ==========================================
// 4. Get Bank Accounts
// ==========================================
router.get("/bank-accounts", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const results = await query("SELECT * FROM bank_accounts WHERE user_id = ? ORDER BY is_default DESC", [userId]);
    const bankAccounts = Array.isArray(results) ? results.map((acc: any) => ({ id: acc.id, bankName: acc.bank_name, accountNumber: acc.account_number })) : [];
    res.json({ success: true, bankAccounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. Add Bank Account
// ==========================================
router.post("/bank-accounts", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { bankName, accountHolder, accountNumber, ifscCode } = req.body;
    if (!bankName || !accountHolder || !accountNumber) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const id = uuidv4();
    await query(
      "INSERT INTO bank_accounts (id, user_id, bank_name, account_holder, account_number, ifsc_code) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userId, bankName, accountHolder, accountNumber, ifscCode || null]
    );
    res.status(201).json({ success: true, message: "Bank account added", bankAccount: { id, bankName, accountNumber } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. Submit Fund Request
// ==========================================
router.post("/fund-request", verifyToken, uploadDeposit.single("screenshot"), async (req: AuthRequest, res) => {
  try {
    await ensureDepositFeatureSchema();
    const fundRequestColumns = await getFundRequestColumns();
    const hasPaymentMethod = fundRequestColumns.has("payment_method");
    const hasPaymentChain = fundRequestColumns.has("payment_chain");
    const hasPromoCode = fundRequestColumns.has("promo_code");
    const hasPromoDiscountPercent = fundRequestColumns.has("promo_discount_percent");
    const hasRemarks = fundRequestColumns.has("remarks");
    const userId = req.user?.id;
    const {
      type,
      amount,
      method,
      chain,
      cryptoSymbol,
      walletOwnerName,
      walletAddress,
      paymentMethod,
      paymentChain,
      promoCode,
      remarks,
    } = req.body;
    const numericAmount = parseFloat(amount as any);
    const safeMethod = method || "crypto";

    console.log("===== FUND REQUEST DEBUG =====");
    console.log("Body:", req.body);
    console.log("File:", req.file);
    console.log("Headers:", req.headers);
    console.log("=================================");

    if (!type || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid request" });
    }

    if (type === "withdrawal") {
      if (!walletAddress || !chain || !cryptoSymbol) {
        return res.status(400).json({ success: false, error: "Missing withdrawal details" });
      }

      const accounts: any = await query(
        "SELECT id, balance, equity, margin_free FROM user_accounts WHERE user_id = ? AND trading_mode = 'real' LIMIT 1",
        [userId]
      );

      if (!Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ success: false, error: "No trading account found" });
      }

      const account = accounts[0];
      const balanceBefore = parseFloat(account.balance || 0);
      if (balanceBefore < numericAmount) {
        return res.status(400).json({ success: false, error: "Insufficient balance" });
      }

      const balanceAfter = balanceBefore - numericAmount;
      await query(
        "UPDATE user_accounts SET balance = ?, equity = GREATEST(0, equity - ?), margin_free = GREATEST(0, margin_free - ?) WHERE id = ?",
        [balanceAfter, numericAmount, numericAmount, account.id]
      );

      const id = uuidv4();
      const refNum = `WD-${Date.now()}-${cryptoSymbol || "CRYPTO"}-${chain || "CHAIN"}`;
      const notes = walletOwnerName ? `Wallet Owner: ${walletOwnerName}` : null;

      await query(
        "INSERT INTO fund_requests (id, user_id, account_id, type, amount, method, reference_number, crypto_chain, crypto_address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, userId, account.id, "withdrawal", numericAmount, safeMethod, refNum, chain || null, walletAddress, notes]
      );

      await query(
        "INSERT INTO transactions (id, user_id, account_id, type, amount, balance_before, balance_after, description, reference_id) VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, ?, ?)",
        [uuidv4(), userId, account.id, numericAmount, balanceBefore, balanceAfter, "Withdrawal requested by user", refNum]
      );

      return res.status(201).json({
        success: true,
        requestId: id,
        reference: refNum,
        status: "pending",
        chain,
        cryptoSymbol,
        walletAddress,
        balanceAfter,
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "Screenshot is required" });
    }

    const selectedPaymentMethod = String(paymentMethod || "USDT").toUpperCase();
    if (selectedPaymentMethod !== "USDT") {
      return res.status(400).json({ success: false, error: "Only USDT payment method is active right now" });
    }

    const selectedPaymentChain = String(paymentChain || chain || "").toUpperCase();
    if (!Object.keys(usdtWallets).includes(selectedPaymentChain)) {
      return res.status(400).json({ success: false, error: "Please select a valid USDT chain" });
    }

    const promo = await resolvePromo(promoCode);
    const appliedPromoCode = promo.valid ? promo.code : null;
    const promoDiscountPercent = promo.valid ? promo.discountPercent : 0;
    const discountAmount = (numericAmount * promoDiscountPercent) / 100;
    const payableAmount = Math.max(0, numericAmount - discountAmount);

    const id = uuidv4();
    const refNum = `REF-${Date.now()}-${cryptoSymbol || "CRYPTO"}-${chain || "CHAIN"}`;
    const notesParts: string[] = [];
    if (walletOwnerName) notesParts.push(`Wallet Owner: ${walletOwnerName}`);
    if (appliedPromoCode) notesParts.push(`Promo: ${appliedPromoCode} (${promoDiscountPercent}% OFF)`);
    if (Number.isFinite(payableAmount)) notesParts.push(`Payable Amount: ${payableAmount.toFixed(2)} USD`);
    const notes = notesParts.length > 0 ? notesParts.join(" | ") : null;
    const screenshotPath = `/uploads/deposit-screenshots/${req.file.filename}`;

    // Fetch user email for the notification
    const userResults = await query("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
    const userEmail = (Array.isArray(userResults) && userResults[0] as any)?.email || null;

    const insertColumns = [
      "id",
      "user_id",
      "type",
      "amount",
      "method",
      "reference_number",
      "crypto_chain",
      "notes",
      "screenshot_path",
    ];
    const insertValues: any[] = [
      id,
      userId,
      type,
      numericAmount,
      safeMethod,
      refNum,
      selectedPaymentChain,
      notes,
      screenshotPath,
    ];

    if (hasPaymentMethod) {
      insertColumns.push("payment_method");
      insertValues.push(selectedPaymentMethod);
    }
    if (hasPaymentChain) {
      insertColumns.push("payment_chain");
      insertValues.push(selectedPaymentChain);
    }
    if (hasPromoCode) {
      insertColumns.push("promo_code");
      insertValues.push(appliedPromoCode);
    }
    if (hasPromoDiscountPercent) {
      insertColumns.push("promo_discount_percent");
      insertValues.push(promoDiscountPercent);
    }
    if (hasRemarks) {
      insertColumns.push("remarks");
      insertValues.push(remarks ? String(remarks) : null);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    await query(
      `INSERT INTO fund_requests (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    if (promo.valid && promo.code) {
      await query(
        "UPDATE promo_codes SET used_count = COALESCE(used_count, 0) + 1, updated_at = NOW() WHERE UPPER(code) = ?",
        [promo.code]
      );
    }

    // Send notification email (now awaited for clarity on delivery status)
    const screenshotUrl = `https://api.suimfx.com${screenshotPath}`;
    const verificationKey = process.env.VERIFICATION_KEY || "";
    const verificationParams = new URLSearchParams({
      reference: refNum,
      amount: String(numericAmount),
      crypto: cryptoSymbol || "",
      chain: chain || "",
      walletOwner: walletOwnerName || "",
      screenshot: screenshotUrl,
    });
    if (verificationKey) {
      verificationParams.append("key", verificationKey);
    }
    const verificationUrl = `https://terminal.suimfx.com/verifypayment/?${verificationParams.toString()}`;
    const timestamp = new Date().toLocaleString();

    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1a1a2e; padding: 20px; border-radius: 8px; color: #ffffff;">
            <h2 style="color: #4ade80; margin-top: 0;">🔔 New Deposit Request</h2>
            
            <div style="background-color: #0f3460; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 10px 0;"><strong>Status:</strong> Pending Verification</p>
              <p style="margin: 10px 0; color: #4ade80;"><strong>Reference ID:</strong> ${refNum}</p>
              <p style="margin: 10px 0;"><strong>Timestamp:</strong> ${timestamp}</p>
            </div>

            <h3 style="color: #e0e0e0; margin-top: 20px;">Deposit Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background-color: #0f3460;">
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Amount</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e; color: #4ade80;"><strong>$${Number(numericAmount).toFixed(2)} USD</strong></td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Cryptocurrency</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;">${cryptoSymbol || "N/A"}</td>
              </tr>
              <tr style="background-color: #0f3460;">
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Blockchain Chain</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;">${selectedPaymentChain || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Payment Method</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;">${selectedPaymentMethod}</td>
              </tr>
              <tr style="background-color: #0f3460;">
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Promo Code</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;">${appliedPromoCode || "Not applied"}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Discount</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;">${promoDiscountPercent}%</td>
              </tr>
              <tr style="background-color: #0f3460;">
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Payable Amount</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e; color: #4ade80;"><strong>$${Number(payableAmount).toFixed(2)} USD</strong></td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>Wallet Owner Name</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;">${walletOwnerName || "Not provided"}</td>
              </tr>
              <tr style="background-color: #0f3460;">
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>User ID</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;">${userId}</td>
              </tr>
              ${userEmail ? `
              <tr>
                <td style="padding: 10px; border: 1px solid #16213e;"><strong>User Email</strong></td>
                <td style="padding: 10px; border: 1px solid #16213e;"><a href="mailto:${userEmail}" style="color: #4ade80;">${userEmail}</a></td>
              </tr>
              ` : ""}
            </table>

            <div style="background-color: #0f3460; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #e0e0e0;">📸 Transaction Proof</h3>
              <p style="margin: 10px 0;">
                <a href="${screenshotUrl}" style="background-color: #4ade80; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                  View Screenshot →
                </a>
              </p>
            </div>

            <div style="background-color: #0f3460; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #e0e0e0;">⚠️ Action Required</h3>
              <p style="margin: 10px 0;">Please review the deposit details and screenshot, then verify this request.</p>
              <p style="margin-top: 15px;">
                <a href="${verificationUrl}" style="background-color: #4ade80; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                  Go to Verification Page →
                </a>
              </p>
            </div>

            <div style="border-top: 1px solid #16213e; padding-top: 15px; margin-top: 20px; font-size: 12px; color: #888;">
              <p>This is an automated email from SUIMFX Trading Platform.</p>
              <p>Transaction ID: ${id}</p>
            </div>
          </div>
        </div>
      `;

    let emailSent = false;
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || "halderamit163@gmail.com",
        subject: `New Deposit Request - ${refNum}`,
        html: emailHtml,
      });
      emailSent = true;
    } catch (err: any) {
      console.error("[FUND-REQUEST] Email send error:", err?.response?.body || err?.message || err);
      emailSent = false;
    }

    res.status(201).json({
      success: true,
      requestId: id,
      reference: refNum,
      status: "pending",
      chain: selectedPaymentChain,
      paymentMethod: selectedPaymentMethod,
      promoCode: appliedPromoCode,
      promoDiscountPercent,
      payableAmount,
      cryptoSymbol,
      walletOwnerName: walletOwnerName || null,
      screenshotPath,
      emailSent,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7. Get Fund Requests
// ==========================================
router.get("/fund-requests", verifyToken, async (req: AuthRequest, res) => {
  try {
    const fundRequestColumns = await getFundRequestColumns();
    const paymentMethodExpr = fundRequestColumns.has("payment_method") ? "payment_method" : "NULL AS payment_method";
    const paymentChainExpr = fundRequestColumns.has("payment_chain") ? "payment_chain" : "NULL AS payment_chain";
    const promoCodeExpr = fundRequestColumns.has("promo_code") ? "promo_code" : "NULL AS promo_code";
    const promoDiscountExpr = fundRequestColumns.has("promo_discount_percent") ? "promo_discount_percent" : "NULL AS promo_discount_percent";
    const remarksExpr = fundRequestColumns.has("remarks") ? "remarks" : "NULL AS remarks";

    const userId = req.user?.id;
    const results = await query(
      `SELECT id, type, amount, status, method, ${paymentMethodExpr}, ${paymentChainExpr}, ${promoCodeExpr}, ${promoDiscountExpr}, ${remarksExpr}, crypto_chain, crypto_address, reference_number, created_at, notes FROM fund_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    const requests = Array.isArray(results)
      ? results.map((r: any) => ({
          id: r.id,
          type: r.type,
          amount: parseFloat(r.amount),
          status: r.status,
          method: r.method,
          paymentMethod: r.payment_method || null,
          paymentChain: r.payment_chain || r.crypto_chain || null,
          promoCode: r.promo_code || null,
          promoDiscountPercent: r.promo_discount_percent === null || r.promo_discount_percent === undefined ? null : parseFloat(r.promo_discount_percent),
          remarks: r.remarks || null,
          chain: r.crypto_chain,
          walletAddress: r.crypto_address,
          reference: r.reference_number,
          notes: r.notes,
          createdAt: r.created_at,
        }))
      : [];
    res.json({ success: true, requests });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7b. Verify Fund Request (admin link)
// ==========================================
router.get("/fund-request/verify", async (req, res) => {
  try {
    const { reference, key } = req.query as { reference?: string; key?: string };
    if (!reference) {
      return res.status(400).json({ success: false, error: "Reference is required" });
    }

    const verificationKey = process.env.VERIFICATION_KEY || "";
    if (verificationKey && verificationKey !== key) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const results = await query(
      "SELECT id, user_id, amount, method, reference_number, crypto_chain, notes, status, created_at FROM fund_requests WHERE reference_number = ? LIMIT 1",
      [reference]
    );

    const record = Array.isArray(results) && (results as any[])[0];
    if (!record) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    return res.json({
      success: true,
      request: {
        id: record.id,
        userId: record.user_id,
        amount: parseFloat(record.amount),
        method: record.method,
        reference: record.reference_number,
        chain: record.crypto_chain,
        walletOwnerName: record.notes,
        status: record.status || "pending",
        createdAt: record.created_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/fund-request/verify", async (req, res) => {
  try {
    console.log("[VERIFY] Request body:", req.body);
    const { reference, key } = req.body as { reference?: string; key?: string };
    if (!reference) {
      return res.status(400).json({ success: false, error: "Reference is required" });
    }

    const verificationKey = process.env.VERIFICATION_KEY || "";
    if (verificationKey && verificationKey !== key) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Fetch the fund request to get user_id and amount
    const fundResults = await query(
      "SELECT id, user_id, amount FROM fund_requests WHERE reference_number = ? LIMIT 1",
      [reference]
    );
    const fundRecord = Array.isArray(fundResults) && (fundResults as any[])[0];
    if (!fundRecord) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    const userId = fundRecord.user_id;
    const depositAmount = parseFloat(fundRecord.amount);

    console.log("[VERIFY] Fund record found - userId:", userId, "amount:", depositAmount);

    // Use valid enum value for status column
    const statusValue = "completed"; // Valid enum: pending, processing, completed, failed, rejected
    console.log("[VERIFY] Updating reference:", reference, "with status:", statusValue);
    const updateResult: any = await query("UPDATE fund_requests SET status = ? WHERE reference_number = ? LIMIT 1", [statusValue, reference]);
    console.log("[VERIFY] Fund request status updated:", updateResult);

    // Check if user account exists
    const accountCheckResults = await query("SELECT id, balance FROM user_accounts WHERE user_id = ?", [userId]);
    console.log("[VERIFY] User account check for userId", userId, ":", accountCheckResults);
    
    if (!Array.isArray(accountCheckResults) || accountCheckResults.length === 0) {
      console.log("[VERIFY] No user_accounts found for userId:", userId, "Creating one...");
      // Create account if it doesn't exist
      const accountId = require("uuid").v4();
      await query(
        "INSERT INTO user_accounts (id, user_id, balance, available_balance, trading_mode, currency) VALUES (?, ?, ?, ?, ?, ?)",
        [accountId, userId, depositAmount, depositAmount, "real", "USD"]
      );
      console.log("[VERIFY] Created new account with balance:", depositAmount);
      return res.json({ success: true, message: "Payment verified and balance updated" });
    }

    // Update user's wallet balance
    console.log("[VERIFY] Updating user", userId, "balance by +", depositAmount);
    const balanceResult: any = await query(
      "UPDATE user_accounts SET balance = balance + ?, available_balance = available_balance + ? WHERE user_id = ?",
      [depositAmount, depositAmount, userId]
    );
    console.log("[VERIFY] Balance update result:", balanceResult);

    return res.json({ success: true, message: "Payment verified and balance updated" });
  } catch (error: any) {
    console.error("[VERIFY] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 8b. Beneficiaries (Crypto) - list & add
// ==========================================
router.get("/beneficiaries", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const results = await query(
      "SELECT id, type, full_name, wallet_address, wallet_type, chain_type, created_at FROM beneficiaries WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    const beneficiaries = Array.isArray(results)
      ? results.map((b: any) => ({
          id: b.id,
          type: b.type,
          fullName: b.full_name,
          walletAddress: b.wallet_address,
          walletType: b.wallet_type,
          chainType: b.chain_type,
          createdAt: b.created_at,
        }))
      : [];

    res.json({ success: true, beneficiaries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/beneficiary", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { type = "crypto", fullName, walletAddress, walletType, chainType } = req.body as {
      type?: string;
      fullName?: string;
      walletAddress?: string;
      walletType?: string;
      chainType?: string;
    };

    if (!fullName || !walletAddress) {
      return res.status(400).json({ success: false, error: "Full name and wallet address are required" });
    }

    // Only crypto is enabled for now
    const safeType = type === "bank" ? "bank" : "crypto";
    if (safeType === "bank") {
      return res.status(400).json({ success: false, error: "Bank beneficiaries are coming soon" });
    }

    const allowedWalletTypes = ["USDT", "BTC"];
    const allowedChains = ["TRC20", "BEP20", "ERC20"];
    const safeWalletType = allowedWalletTypes.includes(walletType || "") ? walletType : "USDT";
    const safeChainType = allowedChains.includes(chainType || "") ? chainType : "TRC20";

    const id = uuidv4();
    await query(
      `INSERT INTO beneficiaries (id, user_id, type, full_name, wallet_address, wallet_type, chain_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, safeType, fullName, walletAddress, safeWalletType, safeChainType]
    );

    res.json({ success: true, beneficiary: { id, type: safeType, fullName, walletAddress, walletType: safeWalletType, chainType: safeChainType } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 8. Get KYC Status
// ==========================================
router.get("/kyc", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const profileResults = await query("SELECT kyc_status FROM user_profiles WHERE user_id = ?", [userId]);
    const profile = (Array.isArray(profileResults) && profileResults.length > 0 ? profileResults[0] : null) as any;
    const docsResults = await query("SELECT * FROM kyc_documents WHERE user_id = ?", [userId]);
    const documents = Array.isArray(docsResults)
      ? docsResults.map((doc: any) => ({
          id: doc.id,
          type: doc.document_type,
          status: doc.status,
          documentUrl: doc.document_url || null,
          documentNumber: doc.document_number || null,
          uploadedAt: doc.created_at || null,
        }))
      : [];
    res.json({ success: true, kyc: { status: profile?.kyc_status || "pending", documents } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 9. Upload KYC
// ==========================================
router.post("/kyc", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { documentType, documentUrl } = req.body;
    if (!documentType || !documentUrl) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }
    const id = uuidv4();
    await query(
      "INSERT INTO kyc_documents (id, user_id, document_type, document_url) VALUES (?, ?, ?, ?)",
      [id, userId, documentType, documentUrl]
    );
    await query("UPDATE user_profiles SET kyc_status = ? WHERE user_id = ?", ["pending", userId]);
    res.status(201).json({ success: true, message: "Document uploaded" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 9b. Upload KYC Document with File
// ==========================================
router.post("/kyc/upload", verifyToken, kycUpload.single("document"), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { documentType, documentNumber } = req.body as { documentType?: string; documentNumber?: string };
    const file = req.file;

    if (!documentType || !file) {
      return res.status(400).json({ success: false, error: "Document type and file are required" });
    }

    const publicPath = `/uploads/kyc-documents/${file.filename}`;
    const id = uuidv4();

    // Check if document already exists for this type
    const existingDocs = await query(
      "SELECT id FROM kyc_documents WHERE user_id = ? AND document_type = ?",
      [userId, documentType]
    );

    if (Array.isArray(existingDocs) && existingDocs.length > 0) {
      // Update existing document
      const updates: string[] = ["document_url = ?", "status = ?"]; const values: any[] = [publicPath, "pending"];
      if (documentNumber) { updates.push("document_number = ?"); values.push(documentNumber); }
      values.push(userId, documentType);
      await query(`UPDATE kyc_documents SET ${updates.join(", ")} WHERE user_id = ? AND document_type = ?`, values);
    } else {
      // Insert new document
      await query(
        "INSERT INTO kyc_documents (id, user_id, document_type, document_url, document_number, status) VALUES (?, ?, ?, ?, ?, ?)",
        [id, userId, documentType, publicPath, documentNumber || null, "pending"]
      );
    }

    res.status(201).json({ 
      success: true, 
      message: "Document uploaded successfully",
      documentUrl: publicPath
    });
  } catch (error: any) {
    console.error("[KYC-UPLOAD] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit KYC for review (sets profile to pending if all docs uploaded)
router.post("/kyc/submit", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const docsResults: any = await query(
      "SELECT document_type, document_url FROM kyc_documents WHERE user_id = ?",
      [userId]
    );
    const items = Array.isArray(docsResults) ? docsResults : [];
    const has = (t: string) => items.some((d: any) => d.document_type === t && !!d.document_url);
    // Required: PAN, ID Proof, Address Proof (Passport is optional)
    const required = ["panCard", "idProof", "addressProof"];
    const missing = required.filter((t) => !has(t));
    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: `Missing documents: ${missing.join(", ")}` });
    }

    await query("UPDATE user_profiles SET kyc_status = 'pending' WHERE user_id = ?", [userId]);
    return res.json({ success: true, message: "KYC submitted for review" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Remove an uploaded KYC document (before submission)
router.delete("/kyc/document", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const type = (req.query.type as string) || "";
    if (!type) {
      return res.status(400).json({ success: false, error: "Document type is required" });
    }

    const results: any = await query(
      "SELECT id, document_url FROM kyc_documents WHERE user_id = ? AND document_type = ? LIMIT 1",
      [userId, type]
    );
    const list = Array.isArray(results) ? results : [];
    const doc = list?.[0];
    if (!doc) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }

    // Try to delete physical file if exists
    if (doc.document_url) {
      const rel = doc.document_url.startsWith("/") ? doc.document_url.slice(1) : doc.document_url;
      const abs = path.resolve(__dirname, "../../", rel);
      if (fs.existsSync(abs)) {
        try { fs.unlinkSync(abs); } catch { /* ignore */ }
      }
    }

    await query("DELETE FROM kyc_documents WHERE id = ?", [doc.id]);
    return res.json({ success: true, message: "Document removed" });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 10. Get Account Limits
// ==========================================
router.get("/limits", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const profileResults = await query("SELECT account_type FROM user_profiles WHERE user_id = ?", [userId]);
    const accountType = (profileResults as any[])?.[0]?.account_type || "standard";
    const tierResults = await query("SELECT * FROM account_tiers WHERE name = ?", [accountType.charAt(0).toUpperCase() + accountType.slice(1)]);
    const tier = (tierResults as any[])?.[0];
    if (!tier) return res.status(404).json({ success: false, error: "Tier not found" });
    res.json({ success: true, limits: { dailyDepositLimit: parseFloat(tier.daily_deposit_limit), monthlyDepositLimit: parseFloat(tier.monthly_deposit_limit), maxLeverage: tier.max_leverage } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Upload Profile Picture
// ==========================================
router.post("/profile-picture", verifyToken, upload.single("profile_picture"), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID required" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const publicPath = `/uploads/profile-pictures/${file.filename}`;

    // Fetch existing profile to clean up old image if present
    const existing = await query("SELECT id, profile_picture FROM user_profiles WHERE user_id = ?", [userId]);
    if (Array.isArray(existing) && existing.length > 0) {
      const current = existing[0] as any;

      // Delete old file if it exists locally
      if (current.profile_picture) {
        const oldPath = current.profile_picture.startsWith("/") ? current.profile_picture.slice(1) : current.profile_picture;
        const absoluteOld = path.resolve(__dirname, "../../", oldPath);
        if (fs.existsSync(absoluteOld)) {
          fs.unlinkSync(absoluteOld);
        }
      }

      await query("UPDATE user_profiles SET profile_picture = ? WHERE user_id = ?", [publicPath, userId]);
    } else {
      await query("INSERT INTO user_profiles (id, user_id, profile_picture) VALUES (?, ?, ?)", [uuidv4(), userId, publicPath]);
    }

    res.json({ success: true, profilePicture: publicPath, message: "Profile picture uploaded" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Upload failed" });
  }
});

// Get user beneficiaries
router.get("/beneficiaries", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const beneficiaries = await query(
      "SELECT * FROM beneficiaries WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.json({ success: true, beneficiaries });
  } catch (error: any) {
    console.error("Get beneficiaries error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch beneficiaries" });
  }
});

// Add beneficiary
router.post("/beneficiary", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { type, fullName, walletAddress, walletType, chainType } = req.body;

    if (!type || !fullName || !walletAddress) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const beneficiaryId = uuidv4();
    await query(
      `INSERT INTO beneficiaries (id, user_id, type, full_name, wallet_address, wallet_type, chain_type, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [beneficiaryId, userId, type, fullName, walletAddress, walletType || null, chainType || null]
    );

    res.json({ success: true, message: "Beneficiary added successfully", beneficiaryId });
  } catch (error: any) {
    console.error("Add beneficiary error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to add beneficiary" });
  }
});

export default router;


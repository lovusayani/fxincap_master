import { Request, RequestHandler } from "express";
import { pool } from "../../shared/database";
import { v4 as uuidv4 } from "uuid";

export type UserAccountMetrics = {
  tradingMode: string;
  accountNumber: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
};

/** Shared loader for account summary + terminal balance (same trading-mode rules). */
export async function loadUserAccountMetrics(userId: string, req: Request): Promise<UserAccountMetrics | null> {
  const { rows: profileRows } = await pool.query(
    "SELECT selected_trading_mode FROM user_profiles WHERE user_id = $1",
    [userId]
  );
  const persistedMode =
    profileRows.length > 0 && (profileRows[0] as any).selected_trading_mode
      ? (profileRows[0] as any).selected_trading_mode
      : "demo";
  const qMode = (req.query.mode as string) || "";
  const requestedMode = ["demo", "real"].includes(qMode) ? qMode : persistedMode;

  let { rows: acctRows } = await pool.query(
    "SELECT account_number, balance, equity, margin_free, currency, trading_mode FROM user_accounts WHERE user_id = $1 AND trading_mode = $2 LIMIT 1",
    [userId, requestedMode || "demo"]
  );
  if (acctRows.length === 0) {
    ({ rows: acctRows } = await pool.query(
      "SELECT account_number, balance, equity, margin_free, currency, trading_mode FROM user_accounts WHERE user_id = $1 AND trading_mode = 'real' LIMIT 1",
      [userId]
    ));
  }
  if (acctRows.length === 0) {
    ({ rows: acctRows } = await pool.query(
      "SELECT account_number, balance, equity, margin_free, currency, trading_mode FROM user_accounts WHERE user_id = $1 LIMIT 1",
      [userId]
    ));
  }

  if (acctRows.length === 0) {
    return null;
  }

  const acct = acctRows[0] as any;
  const margin =
    typeof acct.margin_free === "number" && typeof acct.equity === "number" && typeof acct.balance === "number"
      ? Math.max(0, acct.equity - acct.margin_free)
      : 0;
  const marginLevel = margin > 0 ? Number(((acct.equity / margin) * 100).toFixed(2)) : 0;
  const { rows: levRows } = await pool.query("SELECT leverage FROM user_profiles WHERE user_id = $1 LIMIT 1", [userId]);
  const leverage = levRows.length > 0 ? (levRows[0] as any).leverage : 500;
  const currency = acct.currency != null && String(acct.currency) ? String(acct.currency) : "USD";

  return {
    tradingMode: acct.trading_mode,
    accountNumber: acct.account_number,
    balance: Number(acct.balance),
    equity: Number(acct.equity),
    margin,
    freeMargin: Number(acct.margin_free),
    marginLevel,
    currency,
    leverage,
  };
}

// ==========================================
// 1. Get User Profile
// ==========================================
export const getUserProfile: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const { rows: userResults } = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userResults.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResults[0] as any;
    const { rows: profileResults } = await pool.query("SELECT * FROM user_profiles WHERE user_id = $1", [userId]);
    const profile = profileResults.length > 0 ? profileResults[0] : {};

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        countryCode: user.country_code,
        createdAt: user.created_at,
      },
      profile: {
        kycStatus: (profile as any).kyc_status || "pending",
        accountType: (profile as any).account_type || "standard",
        leverage: (profile as any).leverage || 500,
        profile_picture: (profile as any).profile_picture || null,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// ==========================================
// 2. Update User Profile
// ==========================================
export const updateUserProfile: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { firstName, lastName, phone, address, city, state, zipCode, country } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    if (!firstName && !lastName && !phone && !address && !city && !state && !zipCode && !country) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (firstName) {
      updates.push(`first_name = $${p++}`);
      values.push(firstName);
    }
    if (lastName) {
      updates.push(`last_name = $${p++}`);
      values.push(lastName);
    }
    if (phone) {
      updates.push(`phone = $${p++}`);
      values.push(phone);
    }

    values.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${p}`, values);

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// ==========================================
// 3. Add Bank Account
// ==========================================
export const addBankAccount: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { bankName, accountHolder, accountNumber, ifscCode } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    if (!bankName || !accountHolder || !accountNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const id = uuidv4();
    await pool.query(
      "INSERT INTO bank_accounts (id, user_id, bank_name, account_holder, account_number, ifsc_code) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, userId, bankName, accountHolder, accountNumber, ifscCode || null]
    );

    res.status(201).json({
      success: true,
      message: "Bank account added successfully",
      bankAccount: { id, bankName, accountNumber, accountHolder },
    });
  } catch (error) {
    console.error("Error adding bank account:", error);
    res.status(500).json({ message: "Failed to add bank account" });
  }
};

// ==========================================
// 4. Get KYC Status
// ==========================================
export const getKYCStatus: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const { rows: profileResults } = await pool.query("SELECT * FROM user_profiles WHERE user_id = $1", [userId]);
    const profile = profileResults.length > 0 ? profileResults[0] : null;

    const { rows: docsResults } = await pool.query("SELECT * FROM kyc_documents WHERE user_id = $1", [userId]);
    const documents = docsResults.map((doc: any) => ({
      id: doc.id,
      type: doc.document_type,
      status: doc.status,
      uploadedAt: doc.created_at,
    }));

    res.json({
      success: true,
      kyc: {
        status: (profile as any)?.kyc_status || "pending",
        documents,
        completedAt: (profile as any)?.kyc_completed_at || null,
      },
    });
  } catch (error) {
    console.error("Error fetching KYC status:", error);
    res.status(500).json({ message: "Failed to fetch KYC status" });
  }
};

// ==========================================
// 5. Upload KYC Documents
// ==========================================
export const uploadKYCDocument: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { documentType, documentUrl } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    if (!documentType || !documentUrl) {
      return res.status(400).json({ message: "Document type and URL required" });
    }

    const validTypes = ["passport", "national_id", "drivers_license", "address_proof"];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ message: "Invalid document type" });
    }

    const id = uuidv4();
    await pool.query(
      "INSERT INTO kyc_documents (id, user_id, document_type, document_url, status) VALUES ($1, $2, $3, $4, $5)",
      [id, userId, documentType, documentUrl, "pending"]
    );

    await pool.query("UPDATE user_profiles SET kyc_status = $1 WHERE user_id = $2", ["pending_review", userId]);

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      document: { id, documentType, status: "pending" },
    });
  } catch (error) {
    console.error("Error uploading KYC document:", error);
    res.status(500).json({ message: "Failed to upload document" });
  }
};

// ==========================================
// 6. Get Account Summary (by selected trading mode)
// ==========================================
export const getAccountSummary: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const metrics = await loadUserAccountMetrics(userId, req);
    if (!metrics) {
      return res.status(404).json({ success: false, message: "Account not found for selected mode" });
    }

    res.json({
      success: true,
      data: {
        tradingMode: metrics.tradingMode,
        accountNumber: metrics.accountNumber,
        balance: metrics.balance,
        equity: metrics.equity,
        margin: metrics.margin,
        freeMargin: metrics.freeMargin,
        marginLevel: metrics.marginLevel,
        currency: metrics.currency,
        leverage: metrics.leverage,
      },
    });
  } catch (error) {
    console.error("Error fetching account summary:", error);
    res.status(500).json({ success: false, message: "Failed to fetch account summary" });
  }
};

/** GET /api/user/balance — Terminal + trading-store expect { success, balance: { ... } } */
export const getAuthenticatedBalance: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const metrics = await loadUserAccountMetrics(userId, req);
    if (!metrics) {
      return res.status(404).json({ success: false, message: "Account not found for selected mode" });
    }
    res.json({
      success: true,
      balance: {
        tradingMode: metrics.tradingMode,
        accountNumber: metrics.accountNumber,
        leverage: metrics.leverage,
        balance: metrics.balance,
        equity: metrics.equity,
        margin: metrics.margin,
        freeMargin: metrics.freeMargin,
        currency: metrics.currency,
      },
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ success: false, message: "Failed to fetch balance" });
  }
};

// ==========================================
// 7. Update Selected Trading Mode
// ==========================================
export const updateSelectedTradingMode: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { tradingMode: requestedTradingMode, mode } = req.body;
    const tradingMode = requestedTradingMode || mode;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!tradingMode || !["demo", "real"].includes(tradingMode)) {
      return res.status(400).json({ success: false, message: "Invalid trading mode" });
    }

    const { rows: acctRows } = await pool.query(
      "SELECT account_number, balance, equity, margin_free FROM user_accounts WHERE user_id = $1 AND trading_mode = $2 LIMIT 1",
      [userId, tradingMode]
    );

    if (acctRows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found for selected mode" });
    }

    const updateResult = await pool.query("UPDATE user_profiles SET selected_trading_mode = $1 WHERE user_id = $2", [
      tradingMode,
      userId,
    ]);

    if (!updateResult.rowCount) {
      await pool.query("INSERT INTO user_profiles (id, user_id, selected_trading_mode) VALUES ($1, $2, $3)", [
        uuidv4(),
        userId,
        tradingMode,
      ]);
    }

    const acct = acctRows[0] as any;
    const margin =
      typeof acct.margin_free === "number" && typeof acct.equity === "number" && typeof acct.balance === "number"
        ? Math.max(0, acct.equity - acct.margin_free)
        : 0;
    const marginLevel = margin > 0 ? Number(((acct.equity / margin) * 100).toFixed(2)) : 0;
    const { rows: levRows } = await pool.query("SELECT leverage FROM user_profiles WHERE user_id = $1 LIMIT 1", [userId]);
    const leverage = levRows.length > 0 ? (levRows[0] as any).leverage : 500;

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
  } catch (error) {
    console.error("Error updating trading mode:", error);
    res.status(500).json({ success: false, message: "Failed to update trading mode" });
  }
};

// Legacy endpoints (keep for backward compatibility)
export const getUserBalance: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    res.json({
      balance: 10000,
      equity: 10500,
      margin: 500,
      freeMargin: 9500,
      marginLevel: 2100,
      currency: "USD",
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
};

export const getBankAccounts: RequestHandler = async (req, res) => {
  try {
    res.json([
      {
        id: "1",
        accountNumber: "1234567890",
        bankName: "Example Bank",
        accountHolder: "John Doe",
        swift: "EXBAUS33",
      },
    ]);
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    res.status(500).json({ error: "Failed to fetch bank accounts" });
  }
};

export const createFundRequest: RequestHandler = async (req, res) => {
  try {
    const { userId, amount, type } = req.body;
    res.json({
      success: true,
      message: "Fund request created successfully",
      requestId: Math.random().toString(36).substring(7),
    });
  } catch (error) {
    console.error("Error creating fund request:", error);
    res.status(500).json({ error: "Failed to create fund request" });
  }
};

export const getUserFundRequests: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    res.json([]);
  } catch (error) {
    console.error("Error fetching fund requests:", error);
    res.status(500).json({ error: "Failed to fetch fund requests" });
  }
};

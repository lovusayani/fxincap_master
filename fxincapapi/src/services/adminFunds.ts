import { query } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";

export interface FundListOptions {
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminFundRequest {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  type: string;
  amount: number;
  method: string;
  paymentMethod?: string | null;
  paymentChain?: string | null;
  promoCode?: string | null;
  promoDiscountPercent?: number | null;
  remarks?: string | null;
  status: string;
  referenceNumber: string | null;
  cryptoChain: string | null;
  screenshotPath?: string | null;
  createdAt: string | null;
}

let cachedFundRequestColumns: Set<string> | null = null;

async function getFundRequestColumns() {
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
}

export async function fetchFundRequests(options: FundListOptions = {}): Promise<AdminFundRequest[]> {
  const columns = await getFundRequestColumns();
  const paymentMethodExpr = columns.has("payment_method") ? "fr.payment_method" : "NULL AS payment_method";
  const paymentChainExpr = columns.has("payment_chain") ? "fr.payment_chain" : "NULL AS payment_chain";
  const promoCodeExpr = columns.has("promo_code") ? "fr.promo_code" : "NULL AS promo_code";
  const promoDiscountExpr = columns.has("promo_discount_percent") ? "fr.promo_discount_percent" : "NULL AS promo_discount_percent";
  const remarksExpr = columns.has("remarks") ? "fr.remarks" : "NULL AS remarks";

  const limit = sanitizeLimit(options.limit);
  const offset = sanitizeOffset(options.offset);
  const where: string[] = [];
  const values: any[] = [];

  if (options.status) {
    where.push("fr.status = ?");
    values.push(options.status);
  }

  if (options.type) {
    where.push("fr.type = ?");
    values.push(options.type);
  }

  if (options.search) {
    const like = `%${options.search}%`;
    where.push("(fr.reference_number LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)");
    values.push(like, like, like, like);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT
      fr.id,
      fr.user_id,
      fr.type,
      fr.amount,
      fr.method,
      ${paymentMethodExpr},
      ${paymentChainExpr},
      ${promoCodeExpr},
      ${promoDiscountExpr},
      ${remarksExpr},
      fr.status,
      fr.reference_number,
      fr.crypto_chain,
      fr.screenshot_path,
      fr.created_at,
      u.email AS user_email,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS user_name
    FROM fund_requests fr
    LEFT JOIN users u ON u.id = fr.user_id
    ${whereClause}
    ORDER BY fr.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const results = await query(sql, values);
  if (!Array.isArray(results)) return [];

  return results.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email || null,
    userName: (r.user_name || '').trim() || null,
    type: r.type,
    amount: parseFloat(r.amount),
    method: r.method,
    paymentMethod: r.payment_method || null,
    paymentChain: r.payment_chain || null,
    promoCode: r.promo_code || null,
    promoDiscountPercent: r.promo_discount_percent === null || r.promo_discount_percent === undefined
      ? null
      : parseFloat(r.promo_discount_percent),
    remarks: r.remarks || null,
    status: r.status,
    referenceNumber: r.reference_number || null,
    cryptoChain: r.crypto_chain || null,
    screenshotPath: r.screenshot_path || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  }));
}

export async function fetchFundRequestById(id: string) {
  const columns = await getFundRequestColumns();
  const paymentMethodExpr = columns.has("payment_method") ? "fr.payment_method" : "NULL AS payment_method";
  const paymentChainExpr = columns.has("payment_chain") ? "fr.payment_chain" : "NULL AS payment_chain";
  const promoCodeExpr = columns.has("promo_code") ? "fr.promo_code" : "NULL AS promo_code";
  const promoDiscountExpr = columns.has("promo_discount_percent") ? "fr.promo_discount_percent" : "NULL AS promo_discount_percent";
  const remarksExpr = columns.has("remarks") ? "fr.remarks" : "NULL AS remarks";

  const sql = `
    SELECT
      fr.id,
      fr.user_id,
      fr.type,
      fr.amount,
      fr.method,
      ${paymentMethodExpr},
      ${paymentChainExpr},
      ${promoCodeExpr},
      ${promoDiscountExpr},
      ${remarksExpr},
      fr.status,
      fr.reference_number,
      fr.crypto_chain,
      fr.crypto_address,
      fr.screenshot_path,
      fr.notes,
      fr.created_at,
      fr.completed_at,
      u.email AS user_email,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS user_name,
      u.phone AS user_phone,
      u.country_code AS user_country
    FROM fund_requests fr
    LEFT JOIN users u ON u.id = fr.user_id
    WHERE fr.id = ?
    LIMIT 1
  `;

  const results = await query(sql, [id]);
  if (!Array.isArray(results) || results.length === 0) return null;

  const r: any = results[0];
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email || null,
    userName: (r.user_name || '').trim() || null,
    userPhone: r.user_phone || null,
    userCountry: r.user_country || null,
    type: r.type,
    amount: parseFloat(r.amount),
    method: r.method,
    paymentMethod: r.payment_method || null,
    paymentChain: r.payment_chain || null,
    promoCode: r.promo_code || null,
    promoDiscountPercent: r.promo_discount_percent === null || r.promo_discount_percent === undefined
      ? null
      : parseFloat(r.promo_discount_percent),
    remarks: r.remarks || null,
    status: r.status,
    referenceNumber: r.reference_number || null,
    cryptoChain: r.crypto_chain || null,
    cryptoAddress: r.crypto_address || null,
    notes: r.notes || null,
    screenshotPath: r.screenshot_path || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
  };
}

export async function updateFundRequestStatus(id: string, status: "completed" | "rejected") {
  const allowed = ["completed", "rejected"] as const;
  if (!allowed.includes(status)) return false;
  // Only transition from pending/processing for safety
  const results: any = await query(
    "UPDATE fund_requests SET status = ?, completed_at = NOW() WHERE id = ? AND status IN ('pending','processing') RETURNING id",
    [status, id]
  );
  return Array.isArray(results) && results.length > 0;
}

export async function completeDepositAndCredit(id: string) {
  // 1) Load request
  const rows: any = await query(
    "SELECT id, user_id, amount, type, status, reference_number FROM fund_requests WHERE id = ? LIMIT 1",
    [id]
  );
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, reason: "not-found" };
  const req = rows[0];
  if (req.type !== "deposit") return { success: false, reason: "not-deposit" };
  if (!["pending", "processing"].includes(req.status)) return { success: false, reason: "already-processed", status: req.status };

  const userId = req.user_id;
  const amount = parseFloat(req.amount);

  // 2) Find or create real account
  const accounts: any = await query(
    "SELECT id, balance, equity, margin_free, account_number FROM user_accounts WHERE user_id = ? AND trading_mode = 'real' LIMIT 1",
    [userId]
  );

  let accountId: string;
  let balanceBefore = 0;
  let balanceAfter = amount;

  if (Array.isArray(accounts) && accounts.length > 0) {
    const acc = accounts[0];
    accountId = acc.id;
    balanceBefore = parseFloat(acc.balance || 0);
    balanceAfter = balanceBefore + amount;
    await query(
      "UPDATE user_accounts SET balance = balance + ?, equity = equity + ?, margin_free = margin_free + ?, available_balance = available_balance + ? WHERE id = ?",
      [amount, amount, amount, amount, accountId]
    );
  } else {
    accountId = uuidv4();
    const accountNumber = `REAL-${userId.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    await query(
      "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, available_balance, trading_mode, currency) VALUES (?, ?, ?, ?, ?, ?, ?, 'real', 'USD')",
      [accountId, userId, accountNumber, amount, amount, amount, amount]
    );
  }

  // 3) Update fund request status and link account
  const updateResult: any = await query(
    "UPDATE fund_requests SET status = 'completed', account_id = ?, completed_at = NOW() WHERE id = ? AND status IN ('pending','processing') RETURNING id",
    [accountId, id]
  );
  if (!Array.isArray(updateResult) || updateResult.length === 0) {
    return { success: false, reason: "update-failed" };
  }

  // 4) Log transaction
  await query(
    "INSERT INTO transactions (id, user_id, account_id, type, amount, balance_before, balance_after, description, reference_id) VALUES (?, ?, ?, 'deposit', ?, ?, ?, ?, ?)",
    [uuidv4(), userId, accountId, amount, balanceBefore, balanceAfter, "Deposit approved by admin", req.reference_number || id]
  );

  return { success: true, accountId, balanceBefore, balanceAfter };
}

export async function rejectWithdrawalAndCredit(id: string) {
  // When withdrawal is rejected, credit the balance back to user account
  const rows: any = await query(
    "SELECT id, user_id, amount, type, status, reference_number, account_id FROM fund_requests WHERE id = ? LIMIT 1",
    [id]
  );
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, reason: "not-found" };
  const req = rows[0];
  if (req.type !== "withdrawal") return { success: false, reason: "not-withdrawal" };
  if (!["pending", "processing"].includes(req.status)) return { success: false, reason: "already-processed", status: req.status };

  const userId = req.user_id;
  const amount = parseFloat(req.amount);
  const accountId = req.account_id;

  // Find real account
  const accounts: any = await query(
    "SELECT id, balance, equity, margin_free FROM user_accounts WHERE user_id = ? AND trading_mode = 'real' LIMIT 1",
    [userId]
  );

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return { success: false, reason: "no-account" };
  }

  const acc = accounts[0];
  const balanceBefore = parseFloat(acc.balance || 0);
  const balanceAfter = balanceBefore + amount;

  // Credit the balance back
  await query(
    "UPDATE user_accounts SET balance = balance + ?, equity = equity + ?, margin_free = margin_free + ?, available_balance = available_balance + ? WHERE id = ?",
    [amount, amount, amount, amount, acc.id]
  );

  // Update fund request status to rejected
  const updateResult: any = await query(
    "UPDATE fund_requests SET status = 'rejected', completed_at = NOW() WHERE id = ? AND status IN ('pending','processing') RETURNING id",
    [id]
  );
  if (!Array.isArray(updateResult) || updateResult.length === 0) {
    return { success: false, reason: "update-failed" };
  }

  // Log transaction
  await query(
    "INSERT INTO transactions (id, user_id, account_id, type, amount, balance_before, balance_after, description, reference_id) VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, ?, ?)",
    [uuidv4(), userId, acc.id, amount, balanceBefore, balanceAfter, "Withdrawal rejected by admin - balance credited", req.reference_number || id]
  );

  return { success: true, accountId: acc.id, balanceBefore, balanceAfter };
}

function sanitizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 50;
  return Math.min(Math.max(1, limit), 100);
}

function sanitizeOffset(offset?: number) {
  if (!offset || Number.isNaN(offset) || offset < 0) return 0;
  return offset;
}

export async function completeWithdrawalAndDebit(id: string) {
  // Balance is already deducted when user submits withdrawal request
  // This function just marks the withdrawal as completed
  const rows: any = await query(
    "SELECT id, user_id, amount, type, status, reference_number, account_id FROM fund_requests WHERE id = ? LIMIT 1",
    [id]
  );
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, reason: "not-found" };
  const req = rows[0];
  if (req.type !== "withdrawal") return { success: false, reason: "not-withdrawal" };
  if (!["pending", "processing"].includes(req.status)) return { success: false, reason: "already-processed", status: req.status };

  const userId = req.user_id;
  const amount = parseFloat(req.amount);
  const accountId = req.account_id;

  // Update fund request status to completed
  const updateResult: any = await query(
    "UPDATE fund_requests SET status = 'completed', completed_at = NOW() WHERE id = ? AND status IN ('pending','processing') RETURNING id",
    [id]
  );
  if (!Array.isArray(updateResult) || updateResult.length === 0) {
    return { success: false, reason: "update-failed" };
  }

  // Log transaction
  await query(
    "INSERT INTO transactions (id, user_id, account_id, type, amount, balance_before, balance_after, description, reference_id) VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, ?, ?)",
    [uuidv4(), userId, accountId || userId, amount, 0, 0, "Withdrawal approved by admin", req.reference_number || id]
  );

  return { success: true, accountId, balanceBefore: 0, balanceAfter: 0 };
}


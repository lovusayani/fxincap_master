/**
 * Withdrawal wallet: schema, one-way transfers, fee rules and request lifecycle.
 *
 * The trader moves balance out of a real trading account into a single
 * withdrawal wallet, then withdraws from that wallet. The transfer is
 * deliberately ONE-WAY: once swept in, funds cannot go back to a trading
 * account. That is a product rule, enforced here rather than in the UI, because
 * the UI is not a security boundary.
 *
 * Ownership constraint: every core table (users, user_accounts, fund_requests,
 * transactions) is owned by the `doadmin` role, so the application role can
 * INSERT/UPDATE them but cannot ALTER them. Nothing here adds a column to an
 * existing table; withdrawal fee/destination detail lives in `withdrawal_details`,
 * keyed by fund request id, instead of extra columns on `fund_requests`.
 *
 * Money invariant: the wallet is debited when the request is submitted, so a
 * trader cannot spend the same balance twice while a request is pending. Admin
 * approval only marks it complete; rejection returns it to the wallet.
 */

import { v4 as uuidv4 } from "uuid";
import { query, getConnection } from "./database.js";

type Executor = { query: (sql: string, values?: any[]) => Promise<any> };

async function run(conn: Executor | null, sql: string, values: any[] = []): Promise<any[]> {
  if (conn) return (await conn.query(sql, values)).rows ?? [];
  return (await query(sql, values)) as any[];
}

export type WithdrawalMethod = "usdt" | "bank";
export const WITHDRAWAL_METHODS: WithdrawalMethod[] = ["usdt", "bank"];

let schemaReady = false;

/** Creates the wallet tables. Idempotent; only touches tables this role owns. */
export async function ensureWalletTables(): Promise<void> {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS withdrawal_wallets (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL UNIQUE,
      balance DECIMAL(18,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT withdrawal_wallet_non_negative CHECK (balance >= 0)
    )
  `);

  // Audit trail of every sweep from a trading account into the wallet.
  await query(`
    CREATE TABLE IF NOT EXISTS wallet_transfers (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      account_id VARCHAR(36) NOT NULL,
      account_number VARCHAR(50),
      amount DECIMAL(18,2) NOT NULL,
      account_balance_before DECIMAL(18,2),
      account_balance_after DECIMAL(18,2),
      wallet_balance_before DECIMAL(18,2),
      wallet_balance_after DECIMAL(18,2),
      direction VARCHAR(24) NOT NULL DEFAULT 'account_to_wallet',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_wallet_transfers_user ON wallet_transfers (user_id)`);

  // Admin-managed charges, one row per method.
  await query(`
    CREATE TABLE IF NOT EXISTS withdrawal_fee_settings (
      method VARCHAR(20) PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      fee_type VARCHAR(10) NOT NULL DEFAULT 'percent',
      fee_value DECIMAL(9,4) NOT NULL DEFAULT 0,
      min_fee DECIMAL(18,2) NOT NULL DEFAULT 0,
      max_fee DECIMAL(18,2),
      min_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      max_amount DECIMAL(18,2),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Seed both methods so the admin screen always has rows to edit. Zero fee by
  // default: a made-up default charge would silently take money from traders.
  for (const m of WITHDRAWAL_METHODS) {
    await query(
      `INSERT INTO withdrawal_fee_settings (method, fee_type, fee_value)
       VALUES ($1, 'percent', 0) ON CONFLICT (method) DO NOTHING`,
      [m]
    );
  }

  // Fee and destination detail for a withdrawal, keyed by fund_requests.id.
  await query(`
    CREATE TABLE IF NOT EXISTS withdrawal_details (
      fund_request_id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      method VARCHAR(20) NOT NULL,
      gross_amount DECIMAL(18,2) NOT NULL,
      fee_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      net_amount DECIMAL(18,2) NOT NULL,
      fee_type VARCHAR(10),
      fee_value DECIMAL(9,4),
      usdt_address VARCHAR(255),
      usdt_network VARCHAR(50),
      bank_name VARCHAR(255),
      bank_account_name VARCHAR(255),
      bank_account_number VARCHAR(100),
      bank_ifsc VARCHAR(50),
      bank_swift VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_withdrawal_details_user ON withdrawal_details (user_id)`);

  schemaReady = true;
}

export interface FeeRule {
  method: WithdrawalMethod;
  enabled: boolean;
  fee_type: "percent" | "fixed";
  fee_value: number;
  min_fee: number;
  max_fee: number | null;
  min_amount: number;
  max_amount: number | null;
}

function toRule(row: any): FeeRule {
  return {
    method: row.method,
    enabled: row.enabled !== false,
    fee_type: row.fee_type === "fixed" ? "fixed" : "percent",
    fee_value: Number(row.fee_value || 0),
    min_fee: Number(row.min_fee || 0),
    max_fee: row.max_fee === null || row.max_fee === undefined ? null : Number(row.max_fee),
    min_amount: Number(row.min_amount || 0),
    max_amount: row.max_amount === null || row.max_amount === undefined ? null : Number(row.max_amount),
  };
}

export async function getFeeRules(): Promise<FeeRule[]> {
  await ensureWalletTables();
  const rows = await run(null, `SELECT * FROM withdrawal_fee_settings ORDER BY method`);
  return rows.map(toRule);
}

export async function getFeeRule(method: WithdrawalMethod): Promise<FeeRule | null> {
  await ensureWalletTables();
  const rows = await run(null, `SELECT * FROM withdrawal_fee_settings WHERE method = $1`, [method]);
  return rows.length ? toRule(rows[0]) : null;
}

export async function saveFeeRule(method: WithdrawalMethod, patch: Partial<FeeRule>): Promise<FeeRule | null> {
  await ensureWalletTables();
  const feeType = patch.fee_type === "fixed" ? "fixed" : "percent";
  await run(
    null,
    `UPDATE withdrawal_fee_settings
        SET enabled = $1, fee_type = $2, fee_value = $3, min_fee = $4,
            max_fee = $5, min_amount = $6, max_amount = $7, updated_at = NOW()
      WHERE method = $8`,
    [
      patch.enabled !== false,
      feeType,
      Math.max(0, Number(patch.fee_value || 0)),
      Math.max(0, Number(patch.min_fee || 0)),
      patch.max_fee === null || patch.max_fee === undefined || patch.max_fee === ("" as any)
        ? null
        : Math.max(0, Number(patch.max_fee)),
      Math.max(0, Number(patch.min_amount || 0)),
      patch.max_amount === null || patch.max_amount === undefined || patch.max_amount === ("" as any)
        ? null
        : Math.max(0, Number(patch.max_amount)),
      method,
    ]
  );
  return getFeeRule(method);
}

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export interface FeeQuote {
  ok: boolean;
  error?: string;
  gross: number;
  fee: number;
  net: number;
  rule?: FeeRule;
}

/**
 * Prices a withdrawal.
 *
 * `gross` leaves the wallet; `fee` is retained; `net` is what the trader
 * receives. A fee that would meet or exceed the amount is rejected rather than
 * producing a zero or negative payout.
 */
export function quoteFee(rule: FeeRule, amount: number): FeeQuote {
  const gross = round2(amount);
  if (!Number.isFinite(gross) || gross <= 0) {
    return { ok: false, error: "Enter a valid amount", gross: 0, fee: 0, net: 0 };
  }
  if (!rule.enabled) {
    return { ok: false, error: `${rule.method.toUpperCase()} withdrawals are currently disabled`, gross, fee: 0, net: 0 };
  }
  if (gross < rule.min_amount) {
    return { ok: false, error: `Minimum withdrawal is ${rule.min_amount}`, gross, fee: 0, net: 0 };
  }
  if (rule.max_amount !== null && gross > rule.max_amount) {
    return { ok: false, error: `Maximum withdrawal is ${rule.max_amount}`, gross, fee: 0, net: 0 };
  }

  let fee = rule.fee_type === "fixed" ? rule.fee_value : (gross * rule.fee_value) / 100;
  if (rule.min_fee > 0) fee = Math.max(fee, rule.min_fee);
  if (rule.max_fee !== null) fee = Math.min(fee, rule.max_fee);
  fee = round2(Math.max(0, fee));

  if (fee >= gross) {
    return { ok: false, error: "Amount is too small to cover the withdrawal fee", gross, fee, net: 0 };
  }
  return { ok: true, gross, fee, net: round2(gross - fee), rule };
}

/** The trader's wallet balance, creating the wallet row on first access. */
export async function getWalletBalance(userId: string, conn: Executor | null = null): Promise<number> {
  await ensureWalletTables();
  await run(
    conn,
    `INSERT INTO withdrawal_wallets (id, user_id, balance) VALUES ($1, $2, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [uuidv4(), userId]
  );
  const rows = await run(conn, `SELECT balance FROM withdrawal_wallets WHERE user_id = $1`, [userId]);
  return Number(rows[0]?.balance || 0);
}

export interface TransferResult {
  success: boolean;
  error?: string;
  walletBalance?: number;
  accountBalance?: number;
}

/**
 * Sweeps `amount` from a real trading account into the withdrawal wallet.
 *
 * One-way by design: there is no reverse operation anywhere in this module.
 *
 * Runs in a single transaction and re-reads the account inside it FOR UPDATE,
 * so two concurrent transfers cannot both pass the balance check and overdraw
 * the account.
 *
 * Only `available_balance` may be swept - margin locked against open positions
 * is not the trader's to withdraw.
 */
export async function transferToWallet(
  userId: string,
  accountId: string,
  rawAmount: number
): Promise<TransferResult> {
  await ensureWalletTables();
  const amount = round2(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Enter a valid amount" };
  }

  const conn = await getConnection();
  try {
    await conn.query("BEGIN");

    const accRes = await conn.query(
      `SELECT id, account_number, balance, available_balance, trading_mode
         FROM user_accounts
        WHERE id = $1 AND user_id = $2
        FOR UPDATE`,
      [accountId, userId]
    );
    const acc = accRes.rows[0];
    if (!acc) {
      await conn.query("ROLLBACK");
      return { success: false, error: "Account not found" };
    }
    if (String(acc.trading_mode) !== "real") {
      await conn.query("ROLLBACK");
      return { success: false, error: "Only real accounts can be transferred to the withdrawal wallet" };
    }

    const available = Number(acc.available_balance ?? acc.balance ?? 0);
    if (amount > available) {
      await conn.query("ROLLBACK");
      return { success: false, error: `Insufficient available balance (${available.toFixed(2)})` };
    }

    const balanceBefore = Number(acc.balance || 0);

    await conn.query(
      `INSERT INTO withdrawal_wallets (id, user_id, balance) VALUES ($1, $2, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [uuidv4(), userId]
    );
    const walletRes = await conn.query(
      `SELECT balance FROM withdrawal_wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    const walletBefore = Number(walletRes.rows[0]?.balance || 0);

    // Equity and margin_free move with balance: the funds have left the account.
    await conn.query(
      `UPDATE user_accounts
          SET balance = balance - $1,
              available_balance = available_balance - $1,
              equity = equity - $1,
              margin_free = GREATEST(margin_free - $1, 0),
              updated_at = NOW()
        WHERE id = $2`,
      [amount, accountId]
    );

    await conn.query(
      `UPDATE withdrawal_wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
      [amount, userId]
    );

    await conn.query(
      `INSERT INTO wallet_transfers
         (id, user_id, account_id, account_number, amount,
          account_balance_before, account_balance_after,
          wallet_balance_before, wallet_balance_after, direction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'account_to_wallet')`,
      [
        uuidv4(), userId, accountId, acc.account_number, amount,
        balanceBefore, round2(balanceBefore - amount),
        walletBefore, round2(walletBefore + amount),
      ]
    );

    // Deliberately NOT mirrored into `transactions`. Its type CHECK allows only
    // deposit/withdrawal/commission/bonus/fee/profit/loss (and the constraint is
    // owned by `doadmin`, so it cannot be extended from here). Recording an
    // internal sweep as a 'withdrawal' would double-count it against the real
    // withdrawal in every report that sums that table. `wallet_transfers` is the
    // record of this movement.

    await conn.query("COMMIT");
    return {
      success: true,
      walletBalance: round2(walletBefore + amount),
      accountBalance: round2(balanceBefore - amount),
    };
  } catch (error: any) {
    await conn.query("ROLLBACK").catch(() => {});
    return { success: false, error: error?.message || "Transfer failed" };
  } finally {
    conn.release();
  }
}

export interface WithdrawInput {
  userId: string;
  amount: number;
  method: WithdrawalMethod;
  usdtAddress?: string;
  usdtNetwork?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankSwift?: string;
}

export interface WithdrawResult {
  success: boolean;
  error?: string;
  requestId?: string;
  reference?: string;
  gross?: number;
  fee?: number;
  net?: number;
  walletBalance?: number;
}

/**
 * Submits a withdrawal request and debits the wallet immediately.
 *
 * Debiting up-front (rather than on approval) is what stops a trader from
 * queueing several requests against the same balance. `rejectWithdrawal`
 * returns the funds.
 *
 * The caller is responsible for the KYC check; it lives in the route so the API
 * can return a specific error, but the balance rules are enforced here inside
 * the transaction.
 */
export async function submitWithdrawal(input: WithdrawInput): Promise<WithdrawResult> {
  await ensureWalletTables();

  const rule = await getFeeRule(input.method);
  if (!rule) return { success: false, error: "Unknown withdrawal method" };

  const quote = quoteFee(rule, input.amount);
  if (!quote.ok) return { success: false, error: quote.error };

  const conn = await getConnection();
  try {
    await conn.query("BEGIN");

    await conn.query(
      `INSERT INTO withdrawal_wallets (id, user_id, balance) VALUES ($1, $2, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [uuidv4(), input.userId]
    );
    const walletRes = await conn.query(
      `SELECT balance FROM withdrawal_wallets WHERE user_id = $1 FOR UPDATE`,
      [input.userId]
    );
    const walletBefore = Number(walletRes.rows[0]?.balance || 0);

    if (quote.gross > walletBefore) {
      await conn.query("ROLLBACK");
      return {
        success: false,
        error: `Insufficient withdrawal wallet balance (${walletBefore.toFixed(2)}). Transfer from a trading account first.`,
      };
    }

    await conn.query(
      `UPDATE withdrawal_wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2`,
      [quote.gross, input.userId]
    );

    const requestId = uuidv4();
    const reference = `WD-${Date.now().toString(36).toUpperCase()}`;

    // account_id is intentionally NULL: the money came from the wallet, not
    // from any single trading account.
    await conn.query(
      `INSERT INTO fund_requests
         (id, user_id, type, amount, method, status, reference_number, crypto_address, crypto_chain, notes, created_by_user, created_at)
       VALUES ($1,$2,'withdrawal',$3,$4,'pending',$5,$6,$7,$8,TRUE,NOW())`,
      [
        requestId,
        input.userId,
        quote.gross,
        input.method,
        reference,
        input.method === "usdt" ? input.usdtAddress || null : null,
        input.method === "usdt" ? input.usdtNetwork || null : null,
        `Fee ${quote.fee.toFixed(2)}, net ${quote.net.toFixed(2)}`,
      ]
    );

    await conn.query(
      `INSERT INTO withdrawal_details
         (fund_request_id, user_id, method, gross_amount, fee_amount, net_amount, fee_type, fee_value,
          usdt_address, usdt_network, bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_swift)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        requestId, input.userId, input.method, quote.gross, quote.fee, quote.net,
        rule.fee_type, rule.fee_value,
        input.method === "usdt" ? input.usdtAddress || null : null,
        input.method === "usdt" ? input.usdtNetwork || null : null,
        input.method === "bank" ? input.bankName || null : null,
        input.method === "bank" ? input.bankAccountName || null : null,
        input.method === "bank" ? input.bankAccountNumber || null : null,
        input.method === "bank" ? input.bankIfsc || null : null,
        input.method === "bank" ? input.bankSwift || null : null,
      ]
    );

    await conn.query(
      `INSERT INTO transactions (id, user_id, account_id, type, amount, balance_before, balance_after, description, reference_id)
       VALUES ($1,$2,NULL,'withdrawal',$3,$4,$5,$6,$7)`,
      [
        uuidv4(), input.userId, quote.gross, walletBefore, round2(walletBefore - quote.gross),
        `Withdrawal requested (${input.method.toUpperCase()}) - fee ${quote.fee.toFixed(2)}`, reference,
      ]
    );

    await conn.query("COMMIT");
    return {
      success: true,
      requestId,
      reference,
      gross: quote.gross,
      fee: quote.fee,
      net: quote.net,
      walletBalance: round2(walletBefore - quote.gross),
    };
  } catch (error: any) {
    await conn.query("ROLLBACK").catch(() => {});
    return { success: false, error: error?.message || "Withdrawal failed" };
  } finally {
    conn.release();
  }
}

/**
 * Returns a rejected withdrawal to the trader's wallet.
 *
 * Guarded on the current status so a double rejection cannot credit twice.
 */
export async function refundWithdrawalToWallet(
  fundRequestId: string
): Promise<{ success: boolean; error?: string; amount?: number }> {
  await ensureWalletTables();
  const conn = await getConnection();
  try {
    await conn.query("BEGIN");

    const reqRes = await conn.query(
      `SELECT id, user_id, amount, type, status, reference_number
         FROM fund_requests WHERE id = $1 FOR UPDATE`,
      [fundRequestId]
    );
    const request = reqRes.rows[0];
    if (!request) {
      await conn.query("ROLLBACK");
      return { success: false, error: "Request not found" };
    }
    if (request.type !== "withdrawal") {
      await conn.query("ROLLBACK");
      return { success: false, error: "Not a withdrawal" };
    }
    if (!["pending", "processing"].includes(String(request.status))) {
      await conn.query("ROLLBACK");
      return { success: false, error: `Already ${request.status}` };
    }

    const amount = Number(request.amount || 0);
    const userId = String(request.user_id);

    await conn.query(
      `INSERT INTO withdrawal_wallets (id, user_id, balance) VALUES ($1, $2, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [uuidv4(), userId]
    );
    const walletRes = await conn.query(
      `SELECT balance FROM withdrawal_wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    const walletBefore = Number(walletRes.rows[0]?.balance || 0);

    await conn.query(
      `UPDATE withdrawal_wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
      [amount, userId]
    );
    await conn.query(
      `UPDATE fund_requests SET status = 'rejected', failed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [fundRequestId]
    );
    await conn.query(
      `INSERT INTO transactions (id, user_id, account_id, type, amount, balance_before, balance_after, description, reference_id)
       VALUES ($1,$2,NULL,'withdrawal',$3,$4,$5,$6,$7)`,
      [
        uuidv4(), userId, amount, walletBefore, round2(walletBefore + amount),
        "Withdrawal rejected - returned to withdrawal wallet", request.reference_number || fundRequestId,
      ]
    );

    await conn.query("COMMIT");
    return { success: true, amount };
  } catch (error: any) {
    await conn.query("ROLLBACK").catch(() => {});
    return { success: false, error: error?.message || "Refund failed" };
  } finally {
    conn.release();
  }
}

/** Marks a withdrawal complete. The wallet was already debited on submission. */
export async function completeWithdrawal(
  fundRequestId: string
): Promise<{ success: boolean; error?: string }> {
  await ensureWalletTables();
  const rows = await run(
    null,
    `UPDATE fund_requests SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND type = 'withdrawal' AND status IN ('pending','processing')
      RETURNING id`,
    [fundRequestId]
  );
  if (rows.length === 0) return { success: false, error: "Request not found or already processed" };
  return { success: true };
}

/** True when the trader has passed KYC and may withdraw. */
export async function isKycApproved(userId: string): Promise<boolean> {
  const rows = await run(null, `SELECT kyc_status FROM user_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
  return String(rows[0]?.kyc_status || "").toLowerCase() === "approved";
}

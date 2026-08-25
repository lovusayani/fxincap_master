/**
 * Trader-facing withdrawal wallet API.
 *
 * Flow: sweep balance from a real account into the withdrawal wallet (one-way),
 * then withdraw from the wallet to USDT or a bank account. The wallet is
 * debited at submission; admin approval completes it and rejection returns the
 * funds to the wallet (never to a trading account).
 */

import { Router, Response } from "express";
import { AuthRequest, verifyToken } from "./auth.js";
import { query } from "../lib/database.js";
import {
  ensureWalletTables,
  getWalletBalance,
  transferToWallet,
  submitWithdrawal,
  getFeeRules,
  getFeeRule,
  quoteFee,
  isKycApproved,
  WITHDRAWAL_METHODS,
  WithdrawalMethod,
} from "../lib/wallet.js";

const router: Router = Router();

function parseMethod(raw: unknown): WithdrawalMethod | null {
  const m = String(raw ?? "").trim().toLowerCase();
  return (WITHDRAWAL_METHODS as string[]).includes(m) ? (m as WithdrawalMethod) : null;
}

/**
 * Everything the wallet page renders: wallet balance, per-account balances and
 * totals, platform-wide deposit/withdrawal totals, and recent activity.
 */
router.get("/summary", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureWalletTables();
    const userId = req.user?.id as string;

    const walletBalance = await getWalletBalance(userId);

    const accounts = await query(
      `SELECT id, account_number, balance, equity, available_balance, locked_balance,
              currency, leverage, trading_mode, account_status
         FROM user_accounts
        WHERE user_id = $1 AND trading_mode = 'real'
        ORDER BY created_at ASC`,
      [userId]
    );

    // Deposits are booked against a specific account; withdrawals now come from
    // the wallet and carry no account, so account-wise "out" is the amount
    // swept from that account into the wallet.
    const depositsByAccount = await query(
      `SELECT account_id, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM fund_requests
        WHERE user_id = $1 AND type = 'deposit' AND status = 'completed'
        GROUP BY account_id`,
      [userId]
    );
    const sweptByAccount = await query(
      `SELECT account_id, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM wallet_transfers
        WHERE user_id = $1
        GROUP BY account_id`,
      [userId]
    );

    const depMap = new Map((depositsByAccount as any[]).map((r) => [String(r.account_id), r]));
    const sweptMap = new Map((sweptByAccount as any[]).map((r) => [String(r.account_id), r]));

    const accountRows = (accounts as any[]).map((a) => ({
      id: a.id,
      accountNumber: a.account_number,
      balance: Number(a.balance || 0),
      equity: Number(a.equity || 0),
      available: Number(a.available_balance ?? a.balance ?? 0),
      locked: Number(a.locked_balance || 0),
      currency: a.currency || "USD",
      leverage: a.leverage,
      status: a.account_status,
      totalDeposited: Number(depMap.get(String(a.id))?.total || 0),
      depositCount: Number(depMap.get(String(a.id))?.count || 0),
      totalSweptToWallet: Number(sweptMap.get(String(a.id))?.total || 0),
      sweepCount: Number(sweptMap.get(String(a.id))?.count || 0),
    }));

    const [totals] = (await query(
      `SELECT
         COALESCE(SUM(CASE WHEN type='deposit'    AND status='completed' THEN amount ELSE 0 END), 0) AS deposited,
         COALESCE(SUM(CASE WHEN type='withdrawal' AND status='completed' THEN amount ELSE 0 END), 0) AS withdrawn,
         COALESCE(SUM(CASE WHEN type='withdrawal' AND status IN ('pending','processing') THEN amount ELSE 0 END), 0) AS pending_withdrawal,
         COALESCE(SUM(CASE WHEN type='deposit'    AND status IN ('pending','processing') THEN amount ELSE 0 END), 0) AS pending_deposit
       FROM fund_requests WHERE user_id = $1`,
      [userId]
    )) as any[];

    const recent = await query(
      `SELECT f.id, f.type, f.amount, f.method, f.status, f.reference_number, f.created_at, f.completed_at,
              d.fee_amount, d.net_amount, d.method AS withdraw_method
         FROM fund_requests f
         LEFT JOIN withdrawal_details d ON d.fund_request_id = f.id::text
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
        LIMIT 20`,
      [userId]
    );

    const transfers = await query(
      `SELECT id, account_number, amount, created_at
         FROM wallet_transfers WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    const tradingBalance = accountRows.reduce((s, a) => s + a.balance, 0);

    res.json({
      success: true,
      data: {
        walletBalance,
        tradingBalance,
        totalBalance: Number((tradingBalance + walletBalance).toFixed(2)),
        totals: {
          deposited: Number(totals?.deposited || 0),
          withdrawn: Number(totals?.withdrawn || 0),
          pendingWithdrawal: Number(totals?.pending_withdrawal || 0),
          pendingDeposit: Number(totals?.pending_deposit || 0),
        },
        accounts: accountRows,
        recent,
        transfers,
        kycApproved: await isKycApproved(userId),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Charge rules, so the withdraw modal can show fees before submitting. */
router.get("/fees", verifyToken, async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await getFeeRules() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Live fee preview for an amount and method. */
router.post("/quote", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const method = parseMethod(req.body?.method);
    if (!method) return res.status(400).json({ success: false, error: "Choose USDT or Bank" });
    const rule = await getFeeRule(method);
    if (!rule) return res.status(400).json({ success: false, error: "Unknown withdrawal method" });
    const quote = quoteFee(rule, Number(req.body?.amount));
    res.json({ success: quote.ok, error: quote.error, data: { gross: quote.gross, fee: quote.fee, net: quote.net } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sweep balance from a real trading account into the withdrawal wallet.
 *
 * One-way: there is no endpoint to move funds back to a trading account.
 */
router.post("/transfer", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { accountId, amount } = req.body || {};
    if (!accountId) return res.status(400).json({ success: false, error: "Choose an account" });

    const result = await transferToWallet(userId, String(accountId), Number(amount));
    if (!result.success) return res.status(400).json({ success: false, error: result.error });

    res.json({
      success: true,
      message: "Transferred to withdrawal wallet. This cannot be reversed.",
      data: { walletBalance: result.walletBalance, accountBalance: result.accountBalance },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Submit a withdrawal. Requires approved KYC. */
router.post("/withdraw", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id as string;

    // KYC is checked here (not in lib/wallet) so the API can return a specific,
    // actionable error the UI can route the trader from.
    if (!(await isKycApproved(userId))) {
      return res.status(403).json({
        success: false,
        error: "KYC verification required before withdrawing",
        code: "KYC_REQUIRED",
      });
    }

    const method = parseMethod(req.body?.method);
    if (!method) return res.status(400).json({ success: false, error: "Choose USDT or Bank" });

    if (method === "usdt") {
      if (!String(req.body?.usdtAddress || "").trim()) {
        return res.status(400).json({ success: false, error: "USDT address is required" });
      }
      if (!String(req.body?.usdtNetwork || "").trim()) {
        return res.status(400).json({ success: false, error: "USDT network is required" });
      }
    } else {
      for (const [field, label] of [
        ["bankAccountName", "Account holder name"],
        ["bankAccountNumber", "Account number"],
        ["bankName", "Bank name"],
      ] as const) {
        if (!String(req.body?.[field] || "").trim()) {
          return res.status(400).json({ success: false, error: `${label} is required` });
        }
      }
    }

    const result = await submitWithdrawal({
      userId,
      amount: Number(req.body?.amount),
      method,
      usdtAddress: req.body?.usdtAddress,
      usdtNetwork: req.body?.usdtNetwork,
      bankName: req.body?.bankName,
      bankAccountName: req.body?.bankAccountName,
      bankAccountNumber: req.body?.bankAccountNumber,
      bankIfsc: req.body?.bankIfsc,
      bankSwift: req.body?.bankSwift,
    });

    if (!result.success) return res.status(400).json({ success: false, error: result.error });

    res.json({
      success: true,
      message: "Withdrawal submitted and is now in process",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Wallet-only transaction history (sweeps in, withdrawals out). */
router.get("/transactions", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    await ensureWalletTables();
    const userId = req.user?.id as string;
    const rows = await query(
      `SELECT f.id, f.type, f.amount, f.method, f.status, f.reference_number,
              f.created_at, f.completed_at, d.fee_amount, d.net_amount
         FROM fund_requests f
         LEFT JOIN withdrawal_details d ON d.fund_request_id = f.id::text
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
        LIMIT 100`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

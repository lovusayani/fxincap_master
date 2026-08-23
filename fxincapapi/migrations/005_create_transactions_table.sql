-- Transaction audit log for deposits/withdrawals credited or debited via
-- admin approval (adminFunds.ts: completeDepositAndCredit,
-- rejectWithdrawalAndCredit, completeWithdrawalAndDebit).
--
-- Fully additive: creates a new table only, no existing data touched.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS / IF NOT EXISTS index).
--
-- Run this against the DB as a role that owns/can reference users and
-- user_accounts (on this cluster that's `doadmin`, not `amitkaka` — see
-- 001_multi_account_support.sql for the same constraint).

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'commission', 'bonus', 'fee', 'profit', 'loss')),
  amount DECIMAL(15, 2) NOT NULL,
  balance_before DECIMAL(15, 2),
  balance_after DECIMAL(15, 2),
  description VARCHAR(255),
  reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);

-- Multi-account support for traders (Settings page: browse/open/switch
-- between admin-defined account types, both demo and real).
--
-- Run this against the DB as a role that OWNS user_accounts, user_profiles,
-- and trades (on this cluster that's `doadmin`, not the app's `amitkaka`
-- role — amitkaka does not have ALTER rights on these three tables).
--
-- Fully additive: no columns dropped, no rows deleted, no data rewritten.
-- Safe to run multiple times (every statement is IF NOT EXISTS / IF EXISTS).

-- 1) Allow a trader to hold more than one account per trading_mode.
ALTER TABLE user_accounts DROP CONSTRAINT IF EXISTS user_accounts_user_id_trading_mode_key;

-- 2) Link each account to the admin-defined account type it was opened from,
--    track its own leverage, and track whether it's the one currently being
--    traded on (within its mode). Existing rows default to is_active = true,
--    so current single-account users are unaffected.
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS account_type_id VARCHAR(36) REFERENCES account_types(id) ON DELETE SET NULL;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS leverage INT DEFAULT 500;
ALTER TABLE user_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3) Enforce at the DB level: at most one active account per (user, mode).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accounts_one_active_per_mode
  ON user_accounts (user_id, trading_mode)
  WHERE is_active = true;

-- 4) Tag every trade with the exact account it was opened against, so PnL
--    settlement always lands on the right account even if the trader
--    switches accounts/modes while the trade is open. Nullable — there are
--    currently 0 open trades on this DB, so no backfill is needed; only new
--    trades opened after this migration will populate it.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL;

-- 5) Same tagging for pending orders (orders table is owned by amitkaka, but
--    referencing user_accounts still requires REFERENCES privilege on it,
--    which amitkaka doesn't have — so this one also needs to run as doadmin).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL;

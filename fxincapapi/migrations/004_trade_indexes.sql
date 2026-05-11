-- Migration: 004_trade_indexes.sql
-- Purpose: Add covering indexes for dashboard query paths
-- Safe to run multiple times (IF NOT EXISTS).
-- Run on server: psql $DATABASE_URL -f migrations/004_trade_indexes.sql

-- Most-used filter: open trades and history per user
CREATE INDEX IF NOT EXISTS idx_trades_user_status
  ON trades (user_id, status);

-- History endpoint: user + closed/cancelled + ORDER BY closed_at DESC + LIMIT
CREATE INDEX IF NOT EXISTS idx_trades_user_closed_at
  ON trades (user_id, closed_at DESC)
  WHERE status IN ('CLOSED', 'CANCELLED');

-- Open trades endpoint: user + open + ORDER BY opened_at DESC
CREATE INDEX IF NOT EXISTS idx_trades_user_opened_at
  ON trades (user_id, opened_at DESC)
  WHERE status = 'OPEN';

-- Statistics query: covering index lets PG resolve the whole stats query from index alone
CREATE INDEX IF NOT EXISTS idx_trades_stats_covering
  ON trades (user_id, status, final_pnl);

-- SL/TP scanner: partial index — only open trades that have SL or TP set
CREATE INDEX IF NOT EXISTS idx_trades_open_sltp
  ON trades (id, symbol)
  WHERE status = 'OPEN' AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL);

-- Orders: per-user pending lookup
CREATE INDEX IF NOT EXISTS idx_orders_user_status
  ON orders (user_id, status);

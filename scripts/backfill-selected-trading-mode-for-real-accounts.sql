-- One-time: users who already have a real account but still have selected_trading_mode = 'demo'
-- (schema default / pre-fix activations) should default to real. Run against production/staging once if needed.
-- After this, users who want demo while holding a real account can switch in Settings (PUT /api/user/trading-mode).

UPDATE user_profiles up
SET selected_trading_mode = 'real', updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM user_accounts ua
  WHERE ua.user_id = up.user_id AND ua.trading_mode = 'real'
)
AND up.selected_trading_mode = 'demo';

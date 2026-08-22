-- Admin-configurable trader email notifications: which categories are sent
-- (deposit / withdrawal / trade) and a per-trader daily send cap.

INSERT INTO adm_settings (key, label, category, is_secret) VALUES
  ('notif_daily_cap',      'Max Emails Per Trader Per Day', 'notifications', FALSE),
  ('notif_type_deposit',   'Deposit Emails Enabled',        'notifications', FALSE),
  ('notif_type_withdrawal','Withdrawal Emails Enabled',     'notifications', FALSE),
  ('notif_type_trade',     'Trade Emails Enabled',          'notifications', FALSE)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_notification_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  category   VARCHAR(20) NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notification_log_user_sent
  ON email_notification_log(user_id, sent_at);

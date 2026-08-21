-- Mailgun replaces SendGrid as the API-based email provider.
-- Old sendgrid_api_key / sendgrid_from rows are left in place (unused) rather
-- than dropped, in case of rollback.

INSERT INTO adm_settings (key, label, category, is_secret) VALUES
  ('mailgun_api_key', 'Mailgun API Key',      'email', TRUE),
  ('mailgun_domain',  'Mailgun Domain',       'email', FALSE),
  ('mailgun_from',    'Mailgun From Email',   'email', FALSE),
  ('mailgun_region',  'Mailgun Region',       'email', FALSE)
ON CONFLICT (key) DO NOTHING;

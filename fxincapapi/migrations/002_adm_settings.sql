-- Application-wide admin settings store
-- Stores key-value pairs for SendGrid, Firebase, and other integration credentials.

CREATE TABLE IF NOT EXISTS adm_settings (
  id        SERIAL PRIMARY KEY,
  key       VARCHAR(100)  NOT NULL UNIQUE,
  value     TEXT,
  label     VARCHAR(255),
  category  VARCHAR(100)  NOT NULL DEFAULT 'general',
  is_secret BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed default rows (values are NULL until admin configures them)
INSERT INTO adm_settings (key, label, category, is_secret) VALUES
  ('sendgrid_api_key',   'SendGrid API Key',        'email',    TRUE),
  ('sendgrid_from',      'SendGrid From Email',      'email',    FALSE),
  ('firebase_api_key',   'Firebase API Key',         'firebase', TRUE),
  ('firebase_project_id','Firebase Project ID',      'firebase', FALSE),
  ('firebase_app_id',    'Firebase App ID',          'firebase', FALSE)
ON CONFLICT (key) DO NOTHING;

-- kyc_documents was only ever declared in src/lib/schema.sql, which is MySQL
-- syntax (ENUM, inline INDEX, UUID()) and therefore never applied to this
-- PostgreSQL database — the KYC admin page failed with
-- 'relation "kyc_documents" does not exist'. This is the Postgres equivalent.

-- No FK to users(id): the application role lacks REFERENCES on that table, and
-- every other app-created table here (trade_history, user_password_resets,
-- email_notification_log) already uses a plain user_id UUID for the same reason.

CREATE TABLE IF NOT EXISTS kyc_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  document_type    VARCHAR(50),
  document_url     VARCHAR(255),
  document_number  VARCHAR(100),
  issue_date       DATE,
  expiry_date      DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status  ON kyc_documents(status);

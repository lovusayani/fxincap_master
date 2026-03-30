-- PostgreSQL-compatible schema and data for user authentication tables

DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status VARCHAR(16) DEFAULT 'pending',
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add INSERT statements for users here if needed

DROP TABLE IF EXISTS password_resets CASCADE;
CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add INSERT statements for password_resets here if needed
-- PostgreSQL-compatible schema and data for admin authentication tables

DROP TABLE IF EXISTS admin_users CASCADE;
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status VARCHAR(16) DEFAULT 'pending',
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_users (id, email, password_hash, first_name, last_name, status, email_verified, last_login_at, created_at, updated_at) VALUES
  ('8db65c65-6fee-4199-8b20-5b982bf60587','resendtest1765830241@example.com','$2a$10$yi1Kbaf68rdVjEdU0fgmLumgM.H61n24CTA8Z4TM8s9wJyMwVpvw.','Test','User','pending',FALSE,NULL,'2025-12-15 20:24:01','2025-12-15 20:24:01'),
  ('d895301a-35c0-42d7-80b5-70b6e340a1c0','sprsinfotech@gmail.com','$2a$10$vuiVGYVbxmEAdKxHix6SpugGtxHTIdPiqPde/ViRZR9sUPamnXkeu','admin',NULL,'active',TRUE,'2026-03-19 13:56:18','2025-12-15 20:18:34','2026-03-19 13:56:18'),
  ('f58c195d-a769-44a2-b0be-e990716da38b','suimfx01@gmail.com','$2a$10$ZUxxdt7u4Vjl1Lwel3DuQO2P3t.0NPQm/NcIhcFQz6oz1Ud75WSEi','Adminboss',NULL,'active',TRUE,'2026-02-09 16:51:35','2025-12-16 06:31:21','2026-02-09 16:51:35');

DROP TABLE IF EXISTS admin_sessions CASCADE;
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  device_id UUID,
  token VARCHAR(512) UNIQUE NOT NULL,
  refresh_token VARCHAR(512),
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add INSERT statements for admin_sessions here (truncated for brevity)

DROP TABLE IF EXISTS admin_password_resets CASCADE;
CREATE TABLE admin_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  temp_password VARCHAR(12) NOT NULL,
  temp_password_hash VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add INSERT statements for admin_password_resets here (truncated for brevity)

DROP TABLE IF EXISTS admin_email_verifications CASCADE;
CREATE TABLE admin_email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  verification_code VARCHAR(6) NOT NULL,
  email VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add INSERT statements for admin_email_verifications here (truncated for brevity)

DROP TABLE IF EXISTS admin_devices CASCADE;
CREATE TABLE admin_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address VARCHAR(45),
  is_trusted BOOLEAN DEFAULT FALSE,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add INSERT statements for admin_devices here (truncated for brevity)

DROP TABLE IF EXISTS admin_activity_logs CASCADE;
CREATE TABLE admin_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add INSERT statements for admin_activity_logs here (truncated for brevity)
-- PostgreSQL-compatible schema and data for account_tiers

DROP TABLE IF EXISTS account_tiers CASCADE;

CREATE TABLE account_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  min_balance NUMERIC(15,2),
  max_leverage INTEGER,
  daily_deposit_limit NUMERIC(15,2),
  monthly_deposit_limit NUMERIC(15,2),
  commission_rate NUMERIC(5,3),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO account_tiers (id, name, description, min_balance, max_leverage, daily_deposit_limit, monthly_deposit_limit, commission_rate, created_at) VALUES
  ('358e0cf8-d6b8-11f0-866d-fabefe9bbf2d','Standard','Standard trading account',100.00,500,10000.00,50000.00,0.001,'2025-12-11 17:38:30'),
  ('3595dad9-d6b8-11f0-866d-fabefe9bbf2d','Professional','Professional trading account',1000.00,1000,50000.00,200000.00,0.001,'2025-12-11 17:38:30'),
  ('3595e578-d6b8-11f0-866d-fabefe9bbf2d','VIP','VIP trading account',10000.00,1500,100000.00,500000.00,0.000,'2025-12-11 17:38:30');

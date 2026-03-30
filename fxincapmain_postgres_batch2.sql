-- PostgreSQL-compatible schema and data for api_keys

DROP TABLE IF EXISTS api_keys CASCADE;
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL UNIQUE,
  api_key TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  endpoint VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO api_keys (id, provider, api_key, enabled, endpoint, notes, created_at, updated_at) VALUES
  (1, 'finnhub', 'REPLACE_WITH_YOUR_FINNHUB_API_KEY', FALSE, 'wss://ws.finnhub.io', 'Finnhub WebSocket for stocks', '2025-12-27 16:53:14', '2025-12-27 17:09:24'),
  (2, 'twelvedata', '40298686d2194b2087b87482f786e6b8', TRUE, 'wss://ws.twelvedata.com/v1/quotes/price', 'TwelveData WebSocket for forex/metals', '2025-12-27 16:53:14', '2025-12-27 16:58:22'),
  (3, 'binance', '', FALSE, 'wss://stream.binance.com:9443/ws', 'Binance WebSocket for crypto', '2025-12-27 16:53:14', '2025-12-27 16:53:14');

-- PostgreSQL-compatible schema for audit_log

DROP TABLE IF EXISTS audit_log CASCADE;
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(255),
  resource_type VARCHAR(100),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for bank_accounts

DROP TABLE IF EXISTS bank_accounts CASCADE;
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(255) NOT NULL,
  account_holder VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  ifsc_code VARCHAR(20),
  swift_code VARCHAR(20),
  is_default BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for beneficiaries

DROP TABLE IF EXISTS beneficiaries CASCADE;
CREATE TABLE beneficiaries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(16) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  wallet_address TEXT,
  wallet_type VARCHAR(50),
  chain_type VARCHAR(50),
  bank_name VARCHAR(255),
  account_number VARCHAR(100),
  ifsc_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for fund_requests

DROP TABLE IF EXISTS fund_requests CASCADE;
CREATE TABLE fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID,
  type VARCHAR(16) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  method VARCHAR(16) NOT NULL,
  status VARCHAR(16) DEFAULT 'pending',
  reference_number VARCHAR(100),
  gateway_response JSONB,
  bank_account_id UUID,
  crypto_address VARCHAR(255),
  crypto_chain VARCHAR(50),
  transaction_hash VARCHAR(255),
  notes TEXT,
  screenshot_path VARCHAR(255),
  created_by_user BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for ib_clients

DROP TABLE IF EXISTS ib_clients CASCADE;
CREATE TABLE ib_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES ib_profiles(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(16) DEFAULT 'referred',
  lifetime_volume NUMERIC(20,2) DEFAULT 0.00,
  lifetime_commission NUMERIC(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ib_id, client_user_id)
);

-- PostgreSQL-compatible schema for ib_commissions

DROP TABLE IF EXISTS ib_commissions CASCADE;
CREATE TABLE ib_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ib_id UUID NOT NULL REFERENCES ib_profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES ib_clients(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(16) DEFAULT 'pending',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for ib_profiles

DROP TABLE IF EXISTS ib_profiles CASCADE;
CREATE TABLE ib_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ib_id VARCHAR(50) NOT NULL UNIQUE,
  company_name VARCHAR(255),
  referral_link VARCHAR(255) UNIQUE,
  status VARCHAR(16) DEFAULT 'active',
  commission_structure JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for statistics

DROP TABLE IF EXISTS statistics CASCADE;
CREATE TABLE statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(100),
  metric_value NUMERIC(20,2),
  time_period VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema and data for style_settings

DROP TABLE IF EXISTS style_settings CASCADE;
CREATE TABLE style_settings (
  id SERIAL PRIMARY KEY,
  header_color VARCHAR(50) DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  platform_font_size VARCHAR(32) DEFAULT 'medium',
  button_text_color VARCHAR(32) DEFAULT 'white',
  topbar_bg_color VARCHAR(32) DEFAULT 'default',
  theme_mode VARCHAR(16) DEFAULT 'default',
  font_color_mode VARCHAR(16) DEFAULT 'auto',
  shadow_effect VARCHAR(16) DEFAULT 'drop',
  glossy_effect VARCHAR(16) DEFAULT 'on'
);

INSERT INTO style_settings (id, header_color, created_at, updated_at, platform_font_size, button_text_color, topbar_bg_color, theme_mode, font_color_mode, shadow_effect, glossy_effect) VALUES
  (1, 'default', '2026-02-19 06:47:43', '2026-03-19 15:20:05', '14px', 'white', 'default', 'default', 'auto', 'inner', 'on');

-- PostgreSQL-compatible schema for support_tickets

DROP TABLE IF EXISTS support_tickets CASCADE;
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_number VARCHAR(50) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  priority VARCHAR(8) DEFAULT 'medium',
  status VARCHAR(16) DEFAULT 'open',
  assigned_to UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for symbols

DROP TABLE IF EXISTS symbols CASCADE;
CREATE TABLE symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  digits INTEGER DEFAULT 5,
  min_volume NUMERIC(10,4) DEFAULT 0.0100,
  max_volume NUMERIC(15,2) DEFAULT 100.00,
  bid NUMERIC(15,8),
  ask NUMERIC(15,8),
  spread NUMERIC(10,8),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for trade_history

DROP TABLE IF EXISTS trade_history CASCADE;
CREATE TABLE trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(4) NOT NULL,
  volume NUMERIC(10,4) NOT NULL,
  open_price NUMERIC(15,8) NOT NULL,
  close_price NUMERIC(15,8) NOT NULL,
  profit NUMERIC(15,2),
  profit_percentage NUMERIC(10,4),
  commission NUMERIC(10,4),
  leverage INTEGER,
  open_time TIMESTAMP,
  close_time TIMESTAMP,
  duration_seconds INTEGER,
  closed_reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema for trade_logs

DROP TABLE IF EXISTS trade_logs CASCADE;
CREATE TABLE trade_logs (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema and data for trade_settings

DROP TABLE IF EXISTS trade_settings CASCADE;
CREATE TABLE trade_settings (
  id SMALLINT PRIMARY KEY,
  auto_close_timeout_minutes INTEGER NOT NULL DEFAULT 2,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO trade_settings (id, auto_close_timeout_minutes, updated_at) VALUES
  (1, 5, '2026-03-16 17:13:31');

-- PostgreSQL-compatible schema for trades

DROP TABLE IF EXISTS trades CASCADE;
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(4) NOT NULL,
  volume NUMERIC(15,4) NOT NULL,
  entry_price NUMERIC(15,6) NOT NULL,
  current_price NUMERIC(15,6),
  take_profit NUMERIC(15,6),
  stop_loss NUMERIC(15,6),
  leverage INTEGER NOT NULL,
  locked_balance NUMERIC(15,2) DEFAULT 0.00,
  pnl NUMERIC(15,2) DEFAULT 0.00,
  pnl_percentage NUMERIC(10,4) DEFAULT 0.0000,
  status VARCHAR(10) NOT NULL DEFAULT 'OPEN',
  close_price NUMERIC(15,6),
  final_pnl NUMERIC(15,2),
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  closing_reason VARCHAR(50)
);

-- PostgreSQL-compatible schema for transactions

DROP TABLE IF EXISTS transactions CASCADE;
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  type VARCHAR(16) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  balance_before NUMERIC(15,2),
  balance_after NUMERIC(15,2),
  description VARCHAR(255),
  reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL-compatible schema and data for user_accounts

DROP TABLE IF EXISTS user_accounts CASCADE;
CREATE TABLE user_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number VARCHAR(50) NOT NULL UNIQUE,
  balance NUMERIC(15,2) DEFAULT 0.00,
  equity NUMERIC(15,2) DEFAULT 0.00,
  margin_used NUMERIC(15,2) DEFAULT 0.00,
  margin_free NUMERIC(15,2) DEFAULT 0.00,
  margin_level NUMERIC(10,2) DEFAULT 0.00,
  account_status VARCHAR(16) DEFAULT 'active',
  trading_mode VARCHAR(8) DEFAULT 'demo',
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  locked_balance NUMERIC(15,2) DEFAULT 0.00,
  available_balance NUMERIC(15,2) DEFAULT 0.00,
  UNIQUE (user_id, trading_mode)
);

INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_used, margin_free, margin_level, account_status, trading_mode, currency, created_at, updated_at, locked_balance, available_balance) VALUES
  ('6800c5e3-d747-4304-a9de-fc89e795493e','59147b2a-a269-4dda-b9d8-5ceaa6daf105','REAL-59147B2A',0.00,0.00,0.00,0.00,0.00,'active','real','USD','2026-03-19 10:27:59','2026-03-19 10:27:59',0.00,0.00),
  ('f9027bd4-51c7-475d-ad42-1e28d701cb6d','59147b2a-a269-4dda-b9d8-5ceaa6daf105','DEMO-59147B2A',10000.00,10000.00,0.00,10000.00,0.00,'active','demo','USD','2026-03-19 10:27:59','2026-03-19 10:27:59',0.00,0.00);

-- PostgreSQL-compatible schema and data for user_profiles

DROP TABLE IF EXISTS user_profiles CASCADE;
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  profile_picture VARCHAR(500),
  kyc_status VARCHAR(16) DEFAULT 'pending',
  account_type VARCHAR(16) DEFAULT 'standard',
  leverage INTEGER DEFAULT 500,
  selected_trading_mode VARCHAR(8) DEFAULT 'demo',
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  country VARCHAR(100),
  date_of_birth DATE,
  nationality VARCHAR(100),
  id_type VARCHAR(50),
  id_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO user_profiles (id, user_id, profile_picture, kyc_status, account_type, leverage, selected_trading_mode, address, city, state, zip_code, country, date_of_birth, nationality, id_type, id_number, created_at, updated_at) VALUES
  ('12b67f18-acd9-4bef-b68c-d6963586bf4d','59147b2a-a269-4dda-b9d8-5ceaa6daf105',NULL,'pending','standard',500,'real',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-03-19 10:27:59','2026-03-19 10:32:28');

-- SUIMFX Trading Platform Database Schema
-- Database: suim_fx
-- Created: 2025-12-11

-- =============================================
-- CORE TABLES
-- =============================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  country_code VARCHAR(2),
  status ENUM('active', 'suspended', 'banned', 'pending') DEFAULT 'pending',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  kyc_status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
  account_type ENUM('standard', 'professional', 'vip') DEFAULT 'standard',
  leverage INT DEFAULT 500,
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_kyc_status (kyc_status)
);

-- User Accounts (Trading Accounts)
CREATE TABLE IF NOT EXISTS user_accounts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_number VARCHAR(50) UNIQUE NOT NULL,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  equity DECIMAL(15, 2) DEFAULT 0.00,
  margin_used DECIMAL(15, 2) DEFAULT 0.00,
  margin_free DECIMAL(15, 2) DEFAULT 0.00,
  margin_level DECIMAL(10, 2) DEFAULT 0.00,
  account_status ENUM('active', 'suspended', 'closed') DEFAULT 'active',
  trading_mode ENUM('demo', 'real') DEFAULT 'demo',
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_account_number (account_number),
  UNIQUE KEY unique_user_account (user_id, trading_mode)
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
);

-- =============================================
-- TRADING TABLES
-- =============================================

-- Symbols (Tradable Instruments)
CREATE TABLE IF NOT EXISTS symbols (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  digits INT DEFAULT 5,
  min_volume DECIMAL(10, 4) DEFAULT 0.01,
  max_volume DECIMAL(15, 2) DEFAULT 100.00,
  bid DECIMAL(15, 8),
  ask DECIMAL(15, 8),
  spread DECIMAL(10, 8),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_category (category)
);

-- Positions (Open Trading Positions)
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side ENUM('BUY', 'SELL') NOT NULL,
  volume DECIMAL(10, 4) NOT NULL,
  open_price DECIMAL(15, 8) NOT NULL,
  current_price DECIMAL(15, 8),
  stop_loss DECIMAL(15, 8),
  take_profit DECIMAL(15, 8),
  profit DECIMAL(15, 2) DEFAULT 0.00,
  profit_percentage DECIMAL(10, 4) DEFAULT 0.00,
  leverage INT DEFAULT 1,
  commission DECIMAL(10, 4) DEFAULT 0.00,
  status ENUM('open', 'closed', 'pending') DEFAULT 'open',
  open_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  close_time TIMESTAMP NULL,
  closed_price DECIMAL(15, 8),
  closed_reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES user_accounts(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_symbol (symbol),
  INDEX idx_status (status),
  INDEX idx_open_time (open_time)
);

-- Orders (Pending Orders - Limit, Stop)
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side ENUM('BUY', 'SELL') NOT NULL,
  volume DECIMAL(10, 4) NOT NULL,
  order_type ENUM('Market', 'Limit', 'Stop') NOT NULL,
  price DECIMAL(15, 8),
  stop_loss DECIMAL(15, 8),
  take_profit DECIMAL(15, 8),
  status ENUM('pending', 'executed', 'cancelled', 'expired') DEFAULT 'pending',
  leverage INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES user_accounts(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_status (status),
  INDEX idx_symbol (symbol)
);

-- Trade History (Closed Trades)
CREATE TABLE IF NOT EXISTS trade_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  side ENUM('BUY', 'SELL') NOT NULL,
  volume DECIMAL(10, 4) NOT NULL,
  open_price DECIMAL(15, 8) NOT NULL,
  close_price DECIMAL(15, 8) NOT NULL,
  profit DECIMAL(15, 2),
  profit_percentage DECIMAL(10, 4),
  commission DECIMAL(10, 4),
  leverage INT,
  open_time TIMESTAMP,
  close_time TIMESTAMP,
  duration_seconds INT,
  closed_reason VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES user_accounts(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_symbol (symbol),
  INDEX idx_close_time (close_time)
);

-- =============================================
-- PAYMENT & FUND TABLES
-- =============================================

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  account_holder VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  ifsc_code VARCHAR(20),
  swift_code VARCHAR(20),
  is_default BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  UNIQUE KEY unique_account (user_id, account_number)
);

-- Fund Requests (Deposits & Withdrawals)
CREATE TABLE IF NOT EXISTS fund_requests (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36),
  type ENUM('deposit', 'withdrawal') NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  method ENUM('bank', 'card', 'crypto', 'wallet') NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'rejected') DEFAULT 'pending',
  reference_number VARCHAR(100),
  gateway_response JSON,
  bank_account_id VARCHAR(36),
  crypto_address VARCHAR(255),
  crypto_chain VARCHAR(50),
  transaction_hash VARCHAR(255),
  notes TEXT,
  created_by_user BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES user_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(36),
  type ENUM('deposit', 'withdrawal', 'commission', 'bonus', 'fee', 'profit', 'loss') NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  balance_before DECIMAL(15, 2),
  balance_after DECIMAL(15, 2),
  description VARCHAR(255),
  reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES user_accounts(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  type ENUM('bank', 'card', 'crypto', 'wallet', 'ewallet') NOT NULL,
  countries JSON,
  enabled BOOLEAN DEFAULT TRUE,
  min_amount DECIMAL(15, 2),
  max_amount DECIMAL(15, 2),
  fee_percentage DECIMAL(5, 3),
  processing_time VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_enabled (enabled)
);

-- =============================================
-- KYC TABLES
-- =============================================

-- KYC Documents
CREATE TABLE IF NOT EXISTS kyc_documents (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  document_type VARCHAR(50),
  document_url VARCHAR(255),
  document_number VARCHAR(100),
  issue_date DATE,
  expiry_date DATE,
  status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50),
  title VARCHAR(255),
  message TEXT,
  icon VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
);

-- Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  sms_notifications BOOLEAN DEFAULT FALSE,
  push_notifications BOOLEAN DEFAULT TRUE,
  trading_alerts BOOLEAN DEFAULT TRUE,
  market_news BOOLEAN DEFAULT TRUE,
  deposit_alerts BOOLEAN DEFAULT TRUE,
  withdrawal_alerts BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- SUPPORT TICKETS
-- =============================================

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'waiting', 'resolved', 'closed') DEFAULT 'open',
  assigned_to VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_ticket_number (ticket_number)
);

-- =============================================
-- MAM/PAMM TABLES
-- =============================================

-- MAM Accounts
CREATE TABLE IF NOT EXISTS mam_accounts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  manager_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  equity DECIMAL(15, 2) DEFAULT 0.00,
  status ENUM('active', 'paused', 'closed') DEFAULT 'active',
  target_balance DECIMAL(15, 2),
  risk_level ENUM('low', 'medium', 'high') DEFAULT 'medium',
  max_drawdown DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_manager_id (manager_id),
  INDEX idx_status (status)
);

-- MAM Subscriptions
CREATE TABLE IF NOT EXISTS mam_subscriptions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  investor_id VARCHAR(36) NOT NULL,
  master_account_id VARCHAR(36) NOT NULL,
  slave_account_id VARCHAR(36),
  risk_multiplier DECIMAL(5, 4) DEFAULT 1.0,
  status ENUM('active', 'paused', 'cancelled') DEFAULT 'active',
  investment_amount DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (master_account_id) REFERENCES mam_accounts(id) ON DELETE CASCADE,
  INDEX idx_investor_id (investor_id),
  INDEX idx_master_account_id (master_account_id)
);

-- PAMM Accounts
CREATE TABLE IF NOT EXISTS pamm_accounts (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  manager_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  aum DECIMAL(15, 2) DEFAULT 0.00,
  status ENUM('active', 'paused', 'closed') DEFAULT 'active',
  min_investment DECIMAL(15, 2) DEFAULT 100.00,
  management_fee DECIMAL(5, 3) DEFAULT 0.0,
  performance_fee DECIMAL(5, 3) DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_manager_id (manager_id),
  INDEX idx_status (status)
);

-- PAMM Investments
CREATE TABLE IF NOT EXISTS pamm_investments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  investor_id VARCHAR(36) NOT NULL,
  pamm_account_id VARCHAR(36) NOT NULL,
  investment_amount DECIMAL(15, 2) NOT NULL,
  units DECIMAL(15, 8),
  status ENUM('active', 'withdrawn', 'closed') DEFAULT 'active',
  current_value DECIMAL(15, 2),
  profit DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at TIMESTAMP NULL,
  FOREIGN KEY (investor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pamm_account_id) REFERENCES pamm_accounts(id) ON DELETE CASCADE,
  INDEX idx_investor_id (investor_id),
  INDEX idx_pamm_account_id (pamm_account_id)
);

-- =============================================
-- IB (INTRODUCING BROKER) TABLES
-- =============================================

-- IB Profiles
CREATE TABLE IF NOT EXISTS ib_profiles (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL UNIQUE,
  ib_id VARCHAR(50) UNIQUE NOT NULL,
  company_name VARCHAR(255),
  referral_link VARCHAR(255) UNIQUE,
  status ENUM('active', 'suspended', 'closed') DEFAULT 'active',
  commission_structure JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_ib_id (ib_id),
  INDEX idx_status (status)
);

-- IB Clients
CREATE TABLE IF NOT EXISTS ib_clients (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  ib_id VARCHAR(36) NOT NULL,
  client_user_id VARCHAR(36) NOT NULL,
  status ENUM('active', 'inactive', 'referred') DEFAULT 'referred',
  lifetime_volume DECIMAL(20, 2) DEFAULT 0.00,
  lifetime_commission DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ib_id) REFERENCES ib_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ib_id (ib_id),
  INDEX idx_client_user_id (client_user_id),
  UNIQUE KEY unique_ib_client (ib_id, client_user_id)
);

-- IB Commissions
CREATE TABLE IF NOT EXISTS ib_commissions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  ib_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36),
  amount DECIMAL(15, 2) NOT NULL,
  type VARCHAR(50),
  status ENUM('pending', 'completed', 'paid') DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ib_id) REFERENCES ib_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES ib_clients(id) ON DELETE SET NULL,
  INDEX idx_ib_id (ib_id),
  INDEX idx_status (status)
);

-- =============================================
-- PLATFORM TABLES
-- =============================================

-- Platform Settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSON,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_setting_key (setting_key)
);

-- Account Tiers
CREATE TABLE IF NOT EXISTS account_tiers (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  min_balance DECIMAL(15, 2),
  max_leverage INT,
  daily_deposit_limit DECIMAL(15, 2),
  monthly_deposit_limit DECIMAL(15, 2),
  commission_rate DECIMAL(5, 3),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36),
  action VARCHAR(255),
  resource_type VARCHAR(100),
  resource_id VARCHAR(36),
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- Statistics
CREATE TABLE IF NOT EXISTS statistics (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  metric_name VARCHAR(100),
  metric_value DECIMAL(20, 2),
  time_period VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metric_name (metric_name),
  INDEX idx_created_at (created_at)
);

-- =============================================
-- INSERT DEFAULT DATA
-- =============================================

-- Insert default account tiers
INSERT IGNORE INTO account_tiers (id, name, description, min_balance, max_leverage, daily_deposit_limit, monthly_deposit_limit, commission_rate)
VALUES
  (UUID(), 'Standard', 'Standard trading account', 100.00, 500, 10000.00, 50000.00, 0.001),
  (UUID(), 'Professional', 'Professional trading account', 1000.00, 1000, 50000.00, 200000.00, 0.0005),
  (UUID(), 'VIP', 'VIP trading account', 10000.00, 1500, 100000.00, 500000.00, 0.0002);

-- Insert default payment methods
INSERT IGNORE INTO payment_methods (id, name, type, enabled, min_amount, max_amount, fee_percentage, processing_time)
VALUES
  (UUID(), 'Bank Transfer', 'bank', TRUE, 100.00, 100000.00, 0.5, '1-3 business days'),
  (UUID(), 'Credit/Debit Card', 'card', TRUE, 10.00, 10000.00, 2.5, 'Instant'),
  (UUID(), 'USDT (ERC20)', 'crypto', TRUE, 10.00, 50000.00, 0.1, '5-30 minutes'),
  (UUID(), 'USDT (TRC20)', 'crypto', TRUE, 10.00, 50000.00, 0.05, '5-30 minutes'),
  (UUID(), 'Bitcoin', 'crypto', TRUE, 100.00, 100000.00, 0.2, '10-60 minutes');


-- Create beneficiaries table
CREATE TABLE IF NOT EXISTS beneficiaries (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type ENUM('bank', 'crypto') NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  wallet_address TEXT,
  wallet_type VARCHAR(50),
  chain_type VARCHAR(50),
  bank_name VARCHAR(255),
  account_number VARCHAR(100),
  ifsc_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

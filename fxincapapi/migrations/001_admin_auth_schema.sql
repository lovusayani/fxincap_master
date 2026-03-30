-- Admin Authentication System Database Schema
-- Created: 2025-12-15
-- Purpose: Complete admin authentication with registration, login, device tracking, email verification, and password recovery

-- ===================================================
-- 1. Admin Users Table
-- ===================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status ENUM('pending', 'active', 'suspended', 'blocked') DEFAULT 'pending',
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_email_verified (email_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- 2. Admin Devices Table (Device Registration & Tracking)
-- ===================================================
CREATE TABLE IF NOT EXISTS admin_devices (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  admin_user_id VARCHAR(36) NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address VARCHAR(45),
  is_trusted BOOLEAN DEFAULT FALSE,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_device (admin_user_id, device_fingerprint),
  INDEX idx_admin_user_device (admin_user_id),
  INDEX idx_device_fingerprint (device_fingerprint),
  INDEX idx_is_trusted (is_trusted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- 3. Admin Sessions Table (Active Sessions & Lock Screen)
-- ===================================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  admin_user_id VARCHAR(36) NOT NULL,
  device_id VARCHAR(36),
  token VARCHAR(512) NOT NULL UNIQUE,
  refresh_token VARCHAR(512),
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP NULL,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES admin_devices(id) ON DELETE SET NULL,
  INDEX idx_admin_user_session (admin_user_id),
  INDEX idx_token (token),
  INDEX idx_is_locked (is_locked),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- 4. Email Verifications Table (Email Activation Codes)
-- ===================================================
CREATE TABLE IF NOT EXISTS admin_email_verifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  admin_user_id VARCHAR(36) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  email VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  INDEX idx_admin_user_verification (admin_user_id),
  INDEX idx_verification_code (verification_code),
  INDEX idx_email (email),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- 5. Password Resets Table (Temporary Passwords & Recovery)
-- ===================================================
CREATE TABLE IF NOT EXISTS admin_password_resets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  admin_user_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  temp_password VARCHAR(12) NOT NULL,
  temp_password_hash VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  INDEX idx_admin_user_reset (admin_user_id),
  INDEX idx_email (email),
  INDEX idx_used (used),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- 6. Admin Activity Logs Table (Audit Trail)
-- ===================================================
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_user_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  INDEX idx_admin_user_activity (admin_user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- Sample Data (Optional - for testing)
-- ===================================================
-- Insert a test admin (password: Admin@123)
-- INSERT INTO admin_users (email, password_hash, first_name, last_name, status, email_verified) 
-- VALUES ('admin@suimfx.com', '$2a$10$example_hash_here', 'Admin', 'User', 'active', TRUE);

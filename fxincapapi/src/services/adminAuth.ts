/**
 * Admin Authentication Service
 * Handles admin user registration, login, email verification, password recovery, and device management
 */

import { query } from '../lib/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';
const EMAIL_VERIFICATION_EXPIRY_MINUTES = 30;
const PASSWORD_RESET_EXPIRY_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;

// ===================================================
// Utility Functions
// ===================================================

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateDeviceFingerprint(userAgent: string, ip: string): string {
  return Buffer.from(`${userAgent}-${ip}-${Date.now()}`).toString('base64').substring(0, 255);
}

// ===================================================
// Registration Flow
// ===================================================

export interface RegisterAdminInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export async function registerAdmin(input: RegisterAdminInput) {
  const { email, password, firstName, lastName } = input;

  // Check if email already exists
  const existing = await query(
    'SELECT id FROM admin_users WHERE email = ?',
    [email]
  ) as any[];

  if (existing.length > 0) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create admin user
  const adminId = uuidv4();
  await query(
    `INSERT INTO admin_users (id, email, password_hash, first_name, last_name, status, email_verified) 
     VALUES (?, ?, ?, ?, ?, 'pending', FALSE)`,
    [adminId, email, passwordHash, firstName || null, lastName || null]
  );

  // Generate verification code
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO admin_email_verifications (id, admin_user_id, verification_code, email, expires_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), adminId, verificationCode, email, expiresAt]
  );

  return {
    adminId,
    email,
    verificationCode,
    expiresAt,
  };
}

// ===================================================
// Email Verification
// ===================================================

export async function verifyEmail(email: string, code: string) {
  const verifications = await query(
    `SELECT * FROM admin_email_verifications 
     WHERE email = ? AND verification_code = ? AND verified = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code]
  ) as any[];

  if (verifications.length === 0) {
    throw new Error('Invalid or expired verification code');
  }

  const verification = verifications[0];

  // Mark as verified
  await query(
    'UPDATE admin_email_verifications SET verified = TRUE, verified_at = NOW() WHERE id = ?',
    [verification.id]
  );

  // Update admin user status
  await query(
    "UPDATE admin_users SET email_verified = TRUE, status = 'active' WHERE id = ?",
    [verification.admin_user_id]
  );

  return { success: true, adminUserId: verification.admin_user_id };
}

// ===================================================
// Resend Email Verification
// ===================================================
export async function resendVerification(email: string) {
  // Find user by email
  const users = await query(
    'SELECT id, email_verified, status FROM admin_users WHERE email = ?',
    [email]
  ) as any[];

  if (users.length === 0) {
    throw new Error('Account not found for this email');
  }

  const user = users[0];

  if (user.email_verified) {
    throw new Error('Email already verified');
  }

  if (user.status === 'blocked') {
    throw new Error('Account is blocked');
  }

  // Enforce cooldown based on last verification created_at
  const lastVer = await query(
    `SELECT created_at FROM admin_email_verifications 
     WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
    [email]
  ) as any[];
  if (lastVer.length > 0) {
    const lastCreated = new Date(lastVer[0].created_at).getTime();
    const diffSec = Math.floor((Date.now() - lastCreated) / 1000);
    if (diffSec < RESEND_COOLDOWN_SECONDS) {
      const wait = RESEND_COOLDOWN_SECONDS - diffSec;
      throw new Error(`Please wait ${wait}s before requesting another code`);
    }
  }

  // Issue a new verification code
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO admin_email_verifications (id, admin_user_id, verification_code, email, expires_at) 
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), user.id, verificationCode, email, expiresAt]
  );

  return {
    success: true,
    verificationCode,
    expiresAt,
    adminUserId: user.id,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

// ===================================================
// Login Flow
// ===================================================

export interface LoginInput {
  email: string;
  password: string;
  deviceFingerprint?: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function loginAdmin(input: LoginInput) {
  const { email, password, deviceFingerprint, deviceName, browser, os, ipAddress, userAgent } = input;

  // Get admin user
  const users = await query(
    'SELECT * FROM admin_users WHERE email = ?',
    [email]
  ) as any[];

  if (users.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = users[0];

  // Check if email is verified
  if (!user.email_verified) {
    throw new Error('Email not verified. Please check your email for verification code.');
  }

  // Check if account is active
  if (user.status !== 'active') {
    throw new Error(`Account is ${user.status}. Please contact support.`);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Handle device registration
  let deviceId = null;
  if (deviceFingerprint) {
    const devices = await query(
      'SELECT id FROM admin_devices WHERE admin_user_id = ? AND device_fingerprint = ?',
      [user.id, deviceFingerprint]
    ) as any[];

    if (devices.length > 0) {
      deviceId = devices[0].id;
      // Update last used
      await query(
        'UPDATE admin_devices SET last_used_at = NOW(), ip_address = ? WHERE id = ?',
        [ipAddress, deviceId]
      );
    } else {
      // Register new device
      deviceId = uuidv4();
      await query(
        `INSERT INTO admin_devices (id, admin_user_id, device_fingerprint, device_name, browser, os, ip_address, is_trusted) 
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [deviceId, user.id, deviceFingerprint, deviceName, browser, os, ipAddress]
      );
    }
  }

  // Generate JWT tokens
  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'admin' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  // Create session
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await query(
    `INSERT INTO admin_sessions (id, admin_user_id, device_id, token, refresh_token, expires_at, ip_address, user_agent) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, user.id, deviceId, token, refreshToken, expiresAt, ipAddress, userAgent]
  );

  // Update last login
  await query(
    'UPDATE admin_users SET last_login_at = NOW() WHERE id = ?',
    [user.id]
  );

  // Log activity
  await logActivity(user.id, 'login', 'Admin logged in successfully', ipAddress, userAgent);

  return {
    success: true,
    token,
    refreshToken,
    sessionId,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      status: user.status,
    },
    deviceId,
  };
}

// ===================================================
// Lock Screen
// ===================================================

export async function lockSession(sessionId: string) {
  await query(
    'UPDATE admin_sessions SET is_locked = TRUE, locked_at = NOW() WHERE id = ?',
    [sessionId]
  );

  return { success: true };
}

export async function unlockSession(sessionId: string, password: string) {
  const sessions = await query(
    'SELECT s.*, u.password_hash FROM admin_sessions s JOIN admin_users u ON s.admin_user_id = u.id WHERE s.id = ?',
    [sessionId]
  ) as any[];

  if (sessions.length === 0) {
    throw new Error('Session not found');
  }

  const session = sessions[0];

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, session.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid password');
  }

  // Unlock session
  await query(
    'UPDATE admin_sessions SET is_locked = FALSE, last_activity_at = NOW() WHERE id = ?',
    [sessionId]
  );

  return { success: true };
}

// ===================================================
// Password Recovery
// ===================================================

export async function initiatePasswordReset(email: string, ipAddress?: string) {
  const users = await query(
    'SELECT id FROM admin_users WHERE email = ?',
    [email]
  ) as any[];

  if (users.length === 0) {
    // Don't reveal if email exists
    return { success: true, message: 'If email exists, password reset email has been sent' };
  }

  const user = users[0];

  // Generate temporary password
  const tempPassword = generateTempPassword();
  const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO admin_password_resets (id, admin_user_id, email, temp_password, temp_password_hash, expires_at, ip_address) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), user.id, email, tempPassword, tempPasswordHash, expiresAt, ipAddress]
  );

  return {
    success: true,
    tempPassword,
    expiresAt,
    adminUserId: user.id,
  };
}

export async function verifyTempPassword(email: string, tempPassword: string) {
  const resets = await query(
    `SELECT * FROM admin_password_resets 
     WHERE email = ? AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  ) as any[];

  if (resets.length === 0) {
    throw new Error('No valid password reset request found');
  }

  const reset = resets[0];

  // Verify temp password
  const isValid = await bcrypt.compare(tempPassword, reset.temp_password_hash);
  if (!isValid) {
    throw new Error('Invalid temporary password');
  }

  return {
    success: true,
    resetId: reset.id,
    adminUserId: reset.admin_user_id,
  };
}

export async function resetPassword(resetId: string, newPassword: string) {
  const resets = await query(
    'SELECT * FROM admin_password_resets WHERE id = ? AND used = FALSE',
    [resetId]
  ) as any[];

  if (resets.length === 0) {
    throw new Error('Invalid or already used reset token');
  }

  const reset = resets[0];

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Update admin password
  await query(
    'UPDATE admin_users SET password_hash = ? WHERE id = ?',
    [newPasswordHash, reset.admin_user_id]
  );

  // Mark reset as used
  await query(
    'UPDATE admin_password_resets SET used = TRUE, used_at = NOW() WHERE id = ?',
    [resetId]
  );

  // Invalidate all sessions
  await query(
    'DELETE FROM admin_sessions WHERE admin_user_id = ?',
    [reset.admin_user_id]
  );

  return { success: true };
}

// ===================================================
// Session Management
// ===================================================

export async function updateSessionActivity(sessionId: string) {
  await query(
    'UPDATE admin_sessions SET last_activity_at = NOW() WHERE id = ?',
    [sessionId]
  );
}

export async function getSessionById(sessionId: string) {
  const sessions = await query(
    `SELECT s.*, u.email, u.first_name, u.last_name, u.status 
     FROM admin_sessions s 
     JOIN admin_users u ON s.admin_user_id = u.id 
     WHERE s.id = ? AND s.expires_at > NOW()`,
    [sessionId]
  ) as any[];

  return sessions.length > 0 ? sessions[0] : null;
}

export async function deleteSession(sessionId: string) {
  await query('DELETE FROM admin_sessions WHERE id = ?', [sessionId]);
  return { success: true };
}

// ===================================================
// Activity Logging
// ===================================================

export async function logActivity(
  adminUserId: string,
  action: string,
  description?: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: any
) {
  await query(
    `INSERT INTO admin_activity_logs (admin_user_id, action, description, ip_address, user_agent, metadata) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [adminUserId, action, description, ipAddress, userAgent, metadata ? JSON.stringify(metadata) : null]
  );
}

// ===================================================
// Device Management
// ===================================================

export async function getTrustedDevices(adminUserId: string) {
  const devices = await query(
    'SELECT * FROM admin_devices WHERE admin_user_id = ? AND is_trusted = TRUE ORDER BY last_used_at DESC',
    [adminUserId]
  ) as any[];

  return devices;
}

export async function checkDeviceRegistered(adminUserId: string, deviceFingerprint: string) {
  const devices = await query(
    'SELECT * FROM admin_devices WHERE admin_user_id = ? AND device_fingerprint = ?',
    [adminUserId, deviceFingerprint]
  ) as any[];

  return devices.length > 0 ? devices[0] : null;
}


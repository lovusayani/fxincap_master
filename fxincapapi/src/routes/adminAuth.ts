/**
 * Admin Authentication Routes
 * Handles all admin authentication endpoints
 */

import { Router, Request, Response } from 'express';
import {
  registerAdmin,
  verifyEmail,
  loginAdmin,
  lockSession,
  unlockSession,
  initiatePasswordReset,
  verifyTempPassword,
  resetPassword,
  deleteSession,
  updateSessionActivity,
  getSessionById,
  logActivity,
  resendVerification,
} from '../services/adminAuth.js';
import { safeSendEmail } from '../lib/mailer.js';
import { enqueueEmail } from '../lib/emailQueue.js';

const router: Router = Router();

// ===================================================
// 1. Register Admin
// POST /api/admin-auth/register
// ===================================================
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
      });
    }

    const result = await registerAdmin({
      email,
      password,
      firstName,
      lastName,
    });

    // Send verification email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Welcome to SUIMFX Admin Panel</h2>
        <p>Thank you for registering! Please verify your email address to activate your account.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Verification Code:</h3>
          <p style="font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 4px;">${result.verificationCode}</p>
        </div>
        <p><strong>This code will expire in 30 minutes.</strong></p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't create this account, please ignore this email.</p>
      </div>
    `;

    const emailResult = await safeSendEmail({
      to: email,
      subject: 'SUIMFX Admin - Email Verification',
      html: emailHtml,
    });

    if (!emailResult.success) {
      // Fallback: queue email for later sending
      await enqueueEmail({
        to: email,
        subject: 'SUIMFX Admin - Email Verification',
        html: emailHtml,
        createdAt: new Date().toISOString(),
      });
      console.warn('[ADMIN AUTH] Verification email queued due to error:', emailResult.error);
    }

    res.json({
      success: true,
      message:
        'Registration successful. If you did not receive the verification email, please use "Resend Code".',
      adminId: result.adminId,
      emailDelivery: emailResult?.success ? 'sent' : 'queued',
    });
  } catch (error: any) {
    console.error('[ADMIN AUTH] Register error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

// ===================================================
// 2. Verify Email
// POST /api/admin-auth/verify-email
// ===================================================
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required',
      });
    }

    const result = await verifyEmail(email, code);

    res.json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error: any) {
    console.error('[ADMIN AUTH] Verify email error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Email verification failed',
    });
  }
});

// ===================================================
// 3. Login
// POST /api/admin-auth/login
// ===================================================
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, deviceInfo } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    const ipAddress = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.get('user-agent') || '';

    const result = await loginAdmin({
      email,
      password,
      deviceFingerprint: deviceInfo?.fingerprint,
      deviceName: deviceInfo?.name,
      browser: deviceInfo?.browser,
      os: deviceInfo?.os,
      ipAddress,
      userAgent,
    });

    res.json(result);
  } catch (error: any) {
    console.error('[ADMIN AUTH] Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
});

// ===================================================
// 4. Lock Session
// POST /api/admin-auth/lock-session
// ===================================================
router.post('/lock-session', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const result = await lockSession(sessionId);

    res.json(result);
  } catch (error: any) {
    console.error('[ADMIN AUTH] Lock session error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to lock session',
    });
  }
});

// ===================================================
// 5. Unlock Session
// POST /api/admin-auth/unlock-session
// ===================================================
router.post('/unlock-session', async (req: Request, res: Response) => {
  try {
    const { sessionId, password } = req.body;

    if (!sessionId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and password are required',
      });
    }

    const result = await unlockSession(sessionId, password);

    res.json(result);
  } catch (error: any) {
    console.error('[ADMIN AUTH] Unlock session error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Failed to unlock session',
    });
  }
});

// ===================================================
// 6. Forgot Password
// POST /api/admin-auth/forgot-password
// ===================================================
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const ipAddress = req.ip || req.socket.remoteAddress || '';
    const result = await initiatePasswordReset(email, ipAddress);

    // Send email with temporary password
    if (result.tempPassword) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">Password Reset Request</h2>
          <p>We received a request to reset your SUIMFX Admin password.</p>
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h3 style="margin-top: 0;">Your Temporary Password:</h3>
            <p style="font-size: 24px; font-weight: bold; color: #ef4444; letter-spacing: 2px;">${result.tempPassword}</p>
          </div>
          <p><strong>This temporary password will expire in 15 minutes.</strong></p>
          <p>To complete the password reset:</p>
          <ol>
            <li>Go to the password reset page</li>
            <li>Enter your email and this temporary password</li>
            <li>Set your new password</li>
          </ol>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this reset, please ignore this email or contact support if you're concerned.</p>
        </div>
      `;

      const resetEmail = {
        to: email,
        subject: 'SUIMFX Admin - Password Reset',
        html: emailHtml,
      };
      const resetResult = await safeSendEmail(resetEmail);
      if (!resetResult.success) {
        await enqueueEmail({
          ...resetEmail,
          createdAt: new Date().toISOString(),
        });
        console.warn('[ADMIN AUTH] Password reset email queued due to error:', resetResult.error);
      }
    }

    res.json({
      success: true,
      message: 'If email exists, password reset email has been sent',
    });
  } catch (error: any) {
    console.error('[ADMIN AUTH] Forgot password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Password reset request failed',
    });
  }
});

// ===================================================
// 7. Verify Temporary Password
// POST /api/admin-auth/verify-temp-password
// ===================================================
router.post('/verify-temp-password', async (req: Request, res: Response) => {
  try {
    const { email, tempPassword } = req.body;

    if (!email || !tempPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email and temporary password are required',
      });
    }

    const result = await verifyTempPassword(email, tempPassword);

    res.json(result);
  } catch (error: any) {
    console.error('[ADMIN AUTH] Verify temp password error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid temporary password',
    });
  }
});

// ===================================================
// 8. Reset Password
// POST /api/admin-auth/reset-password
// ===================================================
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { resetId, newPassword } = req.body;

    if (!resetId || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Reset ID and new password are required',
      });
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
      });
    }

    const result = await resetPassword(resetId, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error: any) {
    console.error('[ADMIN AUTH] Reset password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Password reset failed',
    });
  }
});

// ===================================================
// 9. Logout
// POST /api/admin-auth/logout
// ===================================================
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    await deleteSession(sessionId);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('[ADMIN AUTH] Logout error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Logout failed',
    });
  }
});

// ===================================================
// 10. Check Session
// GET /api/admin-auth/session/:sessionId
// ===================================================
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await getSessionById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired',
      });
    }

    // Update last activity
    await updateSessionActivity(sessionId);

    res.json({
      success: true,
      session: {
        id: session.id,
        isLocked: session.is_locked,
        lastActivity: session.last_activity_at,
        user: {
          id: session.admin_user_id,
          email: session.email,
          firstName: session.first_name,
          lastName: session.last_name,
          status: session.status,
        },
      },
    });
  } catch (error: any) {
    console.error('[ADMIN AUTH] Check session error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to check session',
    });
  }
});

// ===================================================
// 11. Resend Verification Code
// POST /api/admin-auth/resend-verification
// ===================================================
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }
    const result = await resendVerification(email);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">SUIMFX Admin - Verify Your Email</h2>
        <p>Your new verification code is:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 4px;">${result.verificationCode}</p>
        </div>
        <p><strong>This code will expire in 30 minutes.</strong></p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
      </div>
    `;

    const emailResult = await safeSendEmail({
      to: email,
      subject: 'SUIMFX Admin - Email Verification (Resent)',
      html: emailHtml,
    });

    if (!emailResult.success) {
      await enqueueEmail({
        to: email,
        subject: 'SUIMFX Admin - Email Verification (Resent)',
        html: emailHtml,
        createdAt: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: 'Verification code resent. Check your email.',
      emailDelivery: emailResult.success ? 'sent' : 'queued',
      expiresAt: result.expiresAt,
    });
  } catch (error: any) {
    console.error('[ADMIN AUTH] Resend verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to resend verification',
    });
  }
});

export default router;


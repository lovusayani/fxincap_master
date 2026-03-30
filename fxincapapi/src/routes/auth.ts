import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { query } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import {
  createUserEmailVerification,
  deferUserEmailVerification,
  getUserEmailVerificationStatus,
  resendUserEmailVerification,
  ensureUserEmailVerificationSupport,
  verifyUserEmailCode,
} from "../services/userEmailVerification.js";

const router: Router = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uppercaseRegex = /[A-Z]/;
const lowercaseRegex = /[a-z]/;
const numberRegex = /[0-9]/;
const specialRegex = /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/;

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

// Middleware
export async function verifyToken(req: AuthRequest, res: Response, next: any) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as any;
    // Normalize to { id, email } even if the payload used userId
    const id = decoded.id || decoded.userId;
    if (!id) {
      return res.status(401).json({ success: false, error: "Invalid token payload" });
    }
    req.user = { id, email: decoded.email };
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

// ==========================================
// Register
// ==========================================
router.post("/register", async (req: Request, res: Response) => {
  try {
    await ensureUserEmailVerificationSupport();

    const { email, password, firstName, lastName, phone, countryCode } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedFirstName = String(firstName || "").trim();
    const normalizedLastName = String(lastName || "").trim();
    const normalizedPassword = String(password || "");

    // Validation
    if (!normalizedEmail || !normalizedPassword || !normalizedFirstName || !normalizedLastName) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (normalizedFirstName.length < 4) {
      return res.status(400).json({ success: false, error: "First name must be at least 4 characters" });
    }

    if (normalizedLastName.length < 4) {
      return res.status(400).json({ success: false, error: "Last name must be at least 4 characters" });
    }

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, error: "Enter a valid email address" });
    }

    if (normalizedPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    if (!uppercaseRegex.test(normalizedPassword)) {
      return res.status(400).json({ success: false, error: "Password must contain at least one uppercase letter" });
    }

    if (!lowercaseRegex.test(normalizedPassword)) {
      return res.status(400).json({ success: false, error: "Password must contain at least one lowercase letter" });
    }

    if (!numberRegex.test(normalizedPassword)) {
      return res.status(400).json({ success: false, error: "Password must contain at least one number" });
    }

    if (!specialRegex.test(normalizedPassword)) {
      return res.status(400).json({ success: false, error: "Password must contain at least one special character" });
    }

    const hashedPassword = await bcryptjs.hash(normalizedPassword, 10);

    const existingUsers = await query(
      "SELECT id, email_verified FROM users WHERE email = $1 LIMIT 1",
      [normalizedEmail]
    ) as any[];

    let userId = uuidv4();
    let responseMessage = 'Registration successful. Enter the activation code sent to your email.';

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.email_verified) {
        return res.status(400).json({ success: false, error: "Email already registered" });
      }

      userId = String(existingUser.id);
      await query(
        "UPDATE users SET password_hash = $1, first_name = $2, last_name = $3, phone = $4, country_code = $5, status = $6, email_verified = FALSE, updated_at = NOW() WHERE id = $7",
        [hashedPassword, normalizedFirstName, normalizedLastName, phone || null, countryCode || null, 'active', userId]
      );

      const existingProfiles = await query("SELECT id FROM user_profiles WHERE user_id = $1 LIMIT 1", [userId]) as any[];
      if (existingProfiles.length === 0) {
        await query("INSERT INTO user_profiles (id, user_id) VALUES ($1, $2)", [uuidv4(), userId]);
      }

      const existingDemoAccounts = await query(
        "SELECT id FROM user_accounts WHERE user_id = $1 AND trading_mode = 'demo' LIMIT 1",
        [userId]
      ) as any[];
      if (existingDemoAccounts.length === 0) {
        const accountId = uuidv4();
        const accountNumber = `DEMO-${userId.substring(0, 8).toUpperCase()}`;
        await query(
          "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, available_balance, trading_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [accountId, userId, accountNumber, 10000, 10000, 10000, 10000, "demo"]
        );
      }

      const existingNotifications = await query("SELECT id FROM notification_preferences WHERE user_id = $1 LIMIT 1", [userId]) as any[];
      if (existingNotifications.length === 0) {
        await query("INSERT INTO notification_preferences (id, user_id) VALUES ($1, $2)", [uuidv4(), userId]);
      }

      responseMessage = 'Your details were updated. Enter the new activation code sent to your email.';
    } else {
      await query(
        "INSERT INTO users (id, email, password_hash, first_name, last_name, phone, country_code, status, email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [userId, normalizedEmail, hashedPassword, normalizedFirstName, normalizedLastName, phone || null, countryCode || null, "active", false]
      );

      await query("INSERT INTO user_profiles (id, user_id) VALUES ($1, $2)", [uuidv4(), userId]);

      const accountId = uuidv4();
      const accountNumber = `DEMO-${userId.substring(0, 8).toUpperCase()}`;
      await query(
        "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, available_balance, trading_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [accountId, userId, accountNumber, 10000, 10000, 10000, 10000, "demo"]
      );

      await query("INSERT INTO notification_preferences (id, user_id) VALUES ($1, $2)", [uuidv4(), userId]);
    }

    const verification = await createUserEmailVerification({
      userId,
      email: normalizedEmail,
      firstName: normalizedFirstName,
    });

    res.status(201).json({
      success: true,
      message:
        verification.emailDelivery === 'sent'
          ? responseMessage
          : 'Registration successful, but email delivery failed. Please use Resend Code.',
      requiresVerification: true,
      emailDelivery: verification.emailDelivery,
      user: {
        id: userId,
        email: normalizedEmail,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/verification-status", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const status = await getUserEmailVerificationStatus(email);
    res.json({ success: true, ...status });
  } catch (error: any) {
    console.error("Verification status error:", error);
    res.status(400).json({ success: false, error: error.message || "Could not fetch verification status" });
  }
});

router.post("/verify-email", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();

    if (!email || !code) {
      return res.status(400).json({ success: false, error: "Email and activation code are required" });
    }

    await verifyUserEmailCode(email, code);
    res.json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error: any) {
    console.error("Verify email error:", error);
    res.status(400).json({ success: false, error: error.message || "Email verification failed" });
  }
});

router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const result = await resendUserEmailVerification(email);
    res.json({
      success: true,
      message:
        result.emailDelivery === 'sent'
          ? 'A new activation code has been sent to your email.'
          : 'A new code was created, but email delivery failed. Please try again shortly.',
      emailDelivery: result.emailDelivery,
    });
  } catch (error: any) {
    console.error("Resend verification error:", error);
    res.status(400).json({ success: false, error: error.message || "Could not resend activation code" });
  }
});

router.post("/verify-later", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    await deferUserEmailVerification(email);
    res.json({
      success: true,
      message: "You can verify your email later. Log in to continue.",
    });
  } catch (error: any) {
    console.error("Verify later error:", error);
    res.status(400).json({ success: false, error: error.message || "Could not defer email verification" });
  }
});

// ==========================================
// Login
// ==========================================
router.post("/login", async (req: Request, res: Response) => {
  try {
    await ensureUserEmailVerificationSupport();

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const results = await query("SELECT * FROM users WHERE email = $1", [email]);

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const user = results[0] as any;

    // Check if user is banned or suspended
    if (user.status === "banned" || user.status === "suspended") {
      return res.status(403).json({ success: false, error: "Account is " + user.status });
    }

    const passwordMatch = await bcryptjs.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const verificationStatus = await getUserEmailVerificationStatus(String(user.email || '').toLowerCase());
    if (
      (user.email_verified === false || user.email_verified == null) &&
      verificationStatus.hasPendingVerification &&
      !verificationStatus.verificationDeferred
    ) {
      return res.status(403).json({
        success: false,
        error: verificationStatus.pendingCodeExpired
          ? "Your activation code has expired. Please request a new code before logging in."
          : "Please verify your email before logging in.",
        requiresVerification: true,
        email: user.email,
        codeExpired: verificationStatus.pendingCodeExpired,
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d",
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Verify Token
// ==========================================
router.post("/verify", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      valid: true,
      user: req.user,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// Change Password
// ==========================================
router.post("/change-password", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Current and new password required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }

    const results = await query("SELECT password_hash FROM users WHERE id = $1", [req.user?.id]);

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = results[0] as any;
    const passwordMatch = await bcryptjs.compare(currentPassword, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: "Current password is incorrect" });
    }

    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPassword, req.user?.id]);

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error: any) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { pool } from "../../shared/database";
import { v4 as uuidv4 } from "uuid";
import {
  createUserEmailVerification,
  deferUserEmailVerification,
  getUserVerificationStatus,
  resendUserEmailVerification,
  ensureUserEmailVerificationSupport,
  verifyUserEmail,
} from "../lib/userEmailVerification";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export const register: RequestHandler = async (req, res) => {
  try {
    await ensureUserEmailVerificationSupport();

    const { firstName, lastName, email, password, phone, countryCode, ibReferralCode } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedFirstName = String(firstName || "").trim();
    const normalizedLastName = String(lastName || "").trim();

    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const { rows: existingUsers } = await pool.query("SELECT id, email_verified FROM users WHERE email = $1 LIMIT 1", [normalizedEmail]);

    const hashedPassword = await bcryptjs.hash(password, 10);

    let userId = uuidv4();
    let responseMessage = "Registration successful. Enter the activation code sent to your email.";

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0] as any;
      if (existingUser.email_verified) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      userId = String(existingUser.id);
      await pool.query(
        "UPDATE users SET password_hash = $1, first_name = $2, last_name = $3, phone = $4, country_code = $5, status = $6, email_verified = FALSE, updated_at = NOW() WHERE id = $7",
        [hashedPassword, normalizedFirstName, normalizedLastName, phone || null, countryCode || null, 'active', userId]
      );

      const { rows: existingProfiles } = await pool.query("SELECT id FROM user_profiles WHERE user_id = $1 LIMIT 1", [userId]);
      if (existingProfiles.length === 0) {
        await pool.query("INSERT INTO user_profiles (id, user_id) VALUES ($1, $2)", [uuidv4(), userId]);
      }

      const { rows: existingDemoAccounts } = await pool.query(
        "SELECT id FROM user_accounts WHERE user_id = $1 AND trading_mode = 'demo' LIMIT 1",
        [userId]
      );
      if (existingDemoAccounts.length === 0) {
        const demoAccountId = uuidv4();
        const demoAccountNumber = `DEMO-${userId.substring(0, 8).toUpperCase()}`;
        await pool.query(
          "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, trading_mode) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [demoAccountId, userId, demoAccountNumber, 10000, 10000, 10000, "demo"]
        );
      }

      const { rows: existingRealAccounts } = await pool.query(
        "SELECT id FROM user_accounts WHERE user_id = $1 AND trading_mode = 'real' LIMIT 1",
        [userId]
      );
      if (existingRealAccounts.length === 0) {
        const realAccountId = uuidv4();
        const realAccountNumber = `REAL-${userId.substring(0, 8).toUpperCase()}`;
        await pool.query(
          "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, trading_mode) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [realAccountId, userId, realAccountNumber, 0, 0, 0, "real"]
        );
      }

      responseMessage = "Your details were updated. Enter the new activation code sent to your email.";
    } else {
      await pool.query(
        "INSERT INTO users (id, email, password_hash, first_name, last_name, phone, country_code, status, email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [userId, normalizedEmail, hashedPassword, normalizedFirstName, normalizedLastName, phone || null, countryCode || null, "active", false]
      );

      await pool.query("INSERT INTO user_profiles (id, user_id) VALUES ($1, $2)", [uuidv4(), userId]);

      const demoAccountId = uuidv4();
      const demoAccountNumber = `DEMO-${userId.substring(0, 8).toUpperCase()}`;
      await pool.query(
        "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, trading_mode) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [demoAccountId, userId, demoAccountNumber, 10000, 10000, 10000, "demo"]
      );

      const realAccountId = uuidv4();
      const realAccountNumber = `REAL-${userId.substring(0, 8).toUpperCase()}`;
      await pool.query(
        "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, trading_mode) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [realAccountId, userId, realAccountNumber, 0, 0, 0, "real"]
      );
    }

    const verification = await createUserEmailVerification({
      userId,
      email: normalizedEmail,
      firstName: normalizedFirstName,
    });

    res.status(201).json({
      success: true,
      message:
        verification.emailDelivery === "sent"
          ? responseMessage
          : "Registration successful, but email delivery failed. Please use Resend Code.",
      requiresVerification: true,
      emailDelivery: verification.emailDelivery,
      user: { id: userId, email: normalizedEmail, firstName: normalizedFirstName, lastName: normalizedLastName },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed" });
  }
};

export const getVerificationStatus: RequestHandler = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const status = await getUserVerificationStatus(email);
    res.json({ success: true, ...status });
  } catch (error: any) {
    console.error("Verification status error:", error);
    res.status(400).json({ message: error?.message || "Could not fetch verification status" });
  }
};

export const verifyEmailCode: RequestHandler = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();

    if (!email || !code) {
      return res.status(400).json({ message: "Email and activation code are required" });
    }

    await verifyUserEmail(email, code);
    res.json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error: any) {
    console.error("Verify email error:", error);
    res.status(400).json({ message: error?.message || "Email verification failed" });
  }
};

export const resendVerificationCode: RequestHandler = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const result = await resendUserEmailVerification(email);
    res.json({
      success: true,
      message:
        result.emailDelivery === "sent"
          ? "A new activation code has been sent to your email."
          : "A new code was created, but email delivery failed. Please try again shortly.",
      emailDelivery: result.emailDelivery,
    });
  } catch (error: any) {
    console.error("Resend verification error:", error);
    res.status(400).json({ message: error?.message || "Could not resend activation code" });
  }
};

export const verifyLater: RequestHandler = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    await deferUserEmailVerification(email);
    res.json({
      success: true,
      message: "You can verify your email later. Log in to continue.",
    });
  } catch (error: any) {
    console.error("Verify later error:", error);
    res.status(400).json({ message: error?.message || "Could not defer email verification" });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    await ensureUserEmailVerificationSupport();

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Find user by email
    const { rows: results } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = results[0] as any;

    // Check if user is banned or suspended
    if (user.status === "banned" || user.status === "suspended") {
      return res.status(403).json({ message: `Account is ${user.status}` });
    }

    // Verify password
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const verificationStatus = await getUserVerificationStatus(String(user.email || "").toLowerCase());
    if (
      (user.email_verified === false || user.email_verified == null) &&
      verificationStatus.hasPendingVerification &&
      !verificationStatus.verificationDeferred
    ) {
      return res.status(403).json({
        message: verificationStatus.pendingCodeExpired
          ? "Your activation code has expired. Please request a new code before logging in."
          : "Please verify your email before logging in.",
        requiresVerification: true,
        email: user.email,
        codeExpired: verificationStatus.pendingCodeExpired,
      });
    }

    // Backward compatibility: ensure required profile/account rows exist for older users.
    const { rows: profileRows } = await pool.query(
      "SELECT id FROM user_profiles WHERE user_id = $1 LIMIT 1",
      [user.id]
    );
    if (!Array.isArray(profileRows) || profileRows.length === 0) {
      await pool.query(
        "INSERT INTO user_profiles (id, user_id, selected_trading_mode) VALUES ($1, $2, $3)",
        [uuidv4(), user.id, "demo"]
      );
    }

    const { rows: demoRows } = await pool.query(
      "SELECT id FROM user_accounts WHERE user_id = $1 AND trading_mode = 'demo' LIMIT 1",
      [user.id]
    );
    if (!Array.isArray(demoRows) || demoRows.length === 0) {
      const demoAccountId = uuidv4();
      const demoAccountNumber = `DEMO-${String(user.id).substring(0, 8).toUpperCase()}`;
      await pool.query(
        "INSERT INTO user_accounts (id, user_id, account_number, balance, equity, margin_free, trading_mode) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [demoAccountId, user.id, demoAccountNumber, 10000, 10000, 10000, "demo"]
      );
    }

    // Update last login
    await pool.query("UPDATE users SET updated_at = NOW() WHERE id = $1", [user.id]);

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
};
export const refreshToken: RequestHandler = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token required" });
    }

    // Verify the old token (even if expired, we want the decoded data)
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        // Decode even if expired to get userId
        decoded = jwt.decode(token) as any;
        if (!decoded) {
          return res.status(401).json({ message: "Invalid token" });
        }
      } else {
        return res.status(401).json({ message: "Invalid token" });
      }
    }

    // Generate new token
    const newToken = jwt.sign({ userId: decoded.userId, email: decoded.email }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      message: "Token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ message: "Token refresh failed" });
  }
};

export const logout: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({ message: "No token provided" });
    }

    // In a real application, you would:
    // 1. Add token to a blacklist (in Redis or database)
    // 2. Invalidate refresh tokens
    // 3. Clear session data
    
    // For now, we'll just return success
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed" });
  }
};
export const verifyToken: RequestHandler = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

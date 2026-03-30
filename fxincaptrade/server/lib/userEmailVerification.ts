import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../shared/database";

const EMAIL_VERIFICATION_EXPIRY_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ensureTablePromise: Promise<void> | null = null;

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function resolveActivationTemplatePath(): string {
  const candidates = [
    path.resolve(process.cwd(), "uploads", "mails", "templates", "activation", "24032026.html"),
    path.resolve(process.cwd(), "..", "fxincapapi", "uploads", "mails", "templates", "activation", "24032026.html"),
    path.resolve(__dirname, "..", "..", "..", "fxincapapi", "uploads", "mails", "templates", "activation", "24032026.html"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Activation email template not found. Checked: ${candidates.join(", ")}`);
}

function buildActivationLink(email: string, code: string): string {
  const appUrl = (process.env.VITE_APP_URL || "https://trade.fxincap.com").replace(/\/$/, "");
  return `${appUrl}/?step=verify&email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
}

export async function ensureUserEmailVerificationSupport(): Promise<void> {
  await ensureUserEmailVerificationTable();
}

async function getStoredSmtpSettings() {
  const keys = ["smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_password", "smtp_from"];
  const result = await pool.query(
    "SELECT key, value FROM adm_settings WHERE key = ANY($1::text[])",
    [keys]
  );

  const settings = new Map<string, string>();
  for (const row of result.rows) {
    settings.set(String(row.key), String(row.value ?? ""));
  }

  return {
    smtpHost: settings.get("smtp_host") || "",
    smtpPort: Number.parseInt(settings.get("smtp_port") || "465", 10) || 465,
    smtpSecure: (settings.get("smtp_secure") || "true").toLowerCase() !== "false",
    smtpUser: settings.get("smtp_user") || "",
    smtpPassword: settings.get("smtp_password") || "",
    smtpFrom: settings.get("smtp_from") || settings.get("smtp_user") || "",
  };
}

async function sendVerificationEmail(params: {
  email: string;
  firstName: string;
  verificationCode: string;
}): Promise<void> {
  const smtp = await getStoredSmtpSettings();
  if (!smtp.smtpHost || !smtp.smtpUser || !smtp.smtpPassword) {
    throw new Error("SMTP is not fully configured for verification emails");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost,
    port: smtp.smtpPort,
    secure: smtp.smtpSecure,
    auth: {
      user: smtp.smtpUser,
      pass: smtp.smtpPassword,
    },
  });

  const templatePath = resolveActivationTemplatePath();
  let html = fs.readFileSync(templatePath, "utf8");
  html = html.replace(/123456/g, params.verificationCode);
  html = html.replace(/href="https:\/\/www\.google\.com"/g, `href="${buildActivationLink(params.email, params.verificationCode)}"`);
  html = html.replace(/\bfirstname\b/g, params.firstName || "Trader");

  await transporter.sendMail({
    from: smtp.smtpFrom || smtp.smtpUser,
    to: params.email,
    subject: "Verify your email address",
    html,
  });
}

export async function ensureUserEmailVerificationTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_email_verifications (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          email TEXT NOT NULL,
          verification_code VARCHAR(6) NOT NULL,
          verified BOOLEAN NOT NULL DEFAULT FALSE,
          verification_deferred BOOLEAN NOT NULL DEFAULT FALSE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          verified_at TIMESTAMP NULL
        )
      `);
      await pool.query(`
        ALTER TABLE user_email_verifications
        ADD COLUMN IF NOT EXISTS verification_deferred BOOLEAN NOT NULL DEFAULT FALSE
      `);
      await pool.query("CREATE INDEX IF NOT EXISTS idx_user_email_verifications_email ON user_email_verifications(email)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_user_email_verifications_user_id ON user_email_verifications(user_id)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_user_email_verifications_expires_at ON user_email_verifications(expires_at)");
    })();
  }

  await ensureTablePromise;
}

export async function createUserEmailVerification(params: {
  userId: string;
  email: string;
  firstName: string;
}): Promise<{ verificationCode: string; expiresAt: Date; emailDelivery: "sent" | "failed" }> {
  await ensureUserEmailVerificationSupport();

  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO user_email_verifications (id, user_id, email, verification_code, verification_deferred, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [uuidv4(), params.userId, params.email, verificationCode, false, expiresAt]
  );

  try {
    await sendVerificationEmail({
      email: params.email,
      firstName: params.firstName,
      verificationCode,
    });
    return { verificationCode, expiresAt, emailDelivery: "sent" };
  } catch (error) {
    console.warn("[TRADE AUTH] Verification email send failed:", error);
    return { verificationCode, expiresAt, emailDelivery: "failed" };
  }
}

export async function verifyUserEmail(email: string, code: string): Promise<void> {
  await ensureUserEmailVerificationSupport();

  const result = await pool.query(
    `SELECT *
     FROM user_email_verifications
     WHERE email = $1 AND verification_code = $2 AND verified = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, code]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid or expired verification code");
  }

  const verification = result.rows[0] as { id: string; user_id: string };

  await pool.query(
    "UPDATE user_email_verifications SET verified = TRUE, verification_deferred = FALSE, verified_at = NOW() WHERE id = $1",
    [verification.id]
  );
  await pool.query(
    "UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1",
    [verification.user_id]
  );
}

export async function resendUserEmailVerification(email: string): Promise<{ emailDelivery: "sent" | "failed" }> {
  await ensureUserEmailVerificationSupport();

  const userResult = await pool.query(
    "SELECT id, first_name, email_verified, status FROM users WHERE email = $1 LIMIT 1",
    [email]
  );

  if (userResult.rows.length === 0) {
    throw new Error("Account not found for this email");
  }

  const user = userResult.rows[0] as {
    id: string;
    first_name: string | null;
    email_verified: boolean | null;
    status: string | null;
  };

  if (user.email_verified) {
    throw new Error("Email already verified");
  }

  if (user.status === "banned" || user.status === "suspended") {
    throw new Error(`Account is ${user.status}`);
  }

  const lastVerification = await pool.query(
    `SELECT created_at
     FROM user_email_verifications
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );

  if (lastVerification.rows.length > 0) {
    const lastCreatedAt = new Date(String(lastVerification.rows[0].created_at)).getTime();
    const elapsedSeconds = Math.floor((Date.now() - lastCreatedAt) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw new Error(`Please wait ${RESEND_COOLDOWN_SECONDS - elapsedSeconds}s before requesting another code`);
    }
  }

  const result = await createUserEmailVerification({
    userId: user.id,
    email,
    firstName: user.first_name || "Trader",
  });

  return { emailDelivery: result.emailDelivery };
}

export async function getUserVerificationStatus(email: string): Promise<{
  emailVerified: boolean;
  hasPendingVerification: boolean;
  pendingCodeExpired: boolean;
  verificationDeferred: boolean;
}> {
  await ensureUserEmailVerificationSupport();

  const userResult = await pool.query(
    `SELECT email_verified
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  const user = userResult.rows[0] as {
    email_verified?: boolean | null;
  } | undefined;
  const emailVerified = user?.email_verified === true;
  const defaultVerificationDeferred = false;

  const result = await pool.query(
    `SELECT verified, verification_deferred, expires_at
     FROM user_email_verifications
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );

  if (result.rows.length === 0) {
    return {
      emailVerified,
      hasPendingVerification: false,
      pendingCodeExpired: false,
      verificationDeferred: defaultVerificationDeferred,
    };
  }

  const latest = result.rows[0] as { verified: boolean; verification_deferred: boolean; expires_at: string };
  const isExpired = new Date(latest.expires_at).getTime() <= Date.now();
  return {
    emailVerified,
    hasPendingVerification: latest.verified === false,
    pendingCodeExpired: latest.verified === false && isExpired,
    verificationDeferred: latest.verification_deferred === true,
  };
}

export async function deferUserEmailVerification(email: string): Promise<void> {
  await ensureUserEmailVerificationSupport();

  const userResult = await pool.query(
    `SELECT id, email_verified, status
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  if (userResult.rows.length === 0) {
    throw new Error("Account not found for this email");
  }

  const user = userResult.rows[0] as {
    id: string;
    email_verified: boolean | null;
    status: string | null;
  };

  if (user.email_verified) {
    return;
  }

  if (user.status === "banned" || user.status === "suspended") {
    throw new Error(`Account is ${user.status}`);
  }

  await pool.query(
    `UPDATE user_email_verifications
     SET verification_deferred = TRUE
     WHERE user_id = $1 AND verified = FALSE`,
    [user.id]
  );
}

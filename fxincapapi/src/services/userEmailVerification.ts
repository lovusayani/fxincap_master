import { v4 as uuidv4 } from 'uuid';
import { query } from '../lib/database.js';
import { sendActivationEmail } from '../lib/mailer.js';

const EMAIL_VERIFICATION_EXPIRY_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;

let ensureTablePromise: Promise<void> | null = null;

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildActivationLink(email: string, code: string): string {
  const appUrl = String(process.env.TRADE_APP_URL || process.env.VITE_APP_URL || 'https://trade.fxincap.com').replace(/\/$/, '');
  return `${appUrl}/?step=verify&email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
}

export async function ensureUserEmailVerificationSupport(): Promise<void> {
  await ensureUserEmailVerificationTable();
}

export async function ensureUserEmailVerificationTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS user_email_verifications (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          email TEXT NOT NULL,
          verification_code VARCHAR(6) NOT NULL,
          verified BOOLEAN NOT NULL DEFAULT FALSE,
          verification_deferred BOOLEAN NOT NULL DEFAULT FALSE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          verified_at TIMESTAMP NULL
        )`
      );
      await query(
        `ALTER TABLE user_email_verifications
         ADD COLUMN IF NOT EXISTS verification_deferred BOOLEAN NOT NULL DEFAULT FALSE`
      );
      await query('CREATE INDEX IF NOT EXISTS idx_user_email_verifications_email ON user_email_verifications(email)');
      await query('CREATE INDEX IF NOT EXISTS idx_user_email_verifications_user_id ON user_email_verifications(user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_user_email_verifications_expires_at ON user_email_verifications(expires_at)');
    })();
  }

  await ensureTablePromise;
}

export async function createUserEmailVerification(input: {
  userId: string;
  email: string;
  firstName: string;
}): Promise<{ emailDelivery: 'sent' | 'failed'; verificationCode: string; expiresAt: Date }> {
  await ensureUserEmailVerificationSupport();

  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO user_email_verifications (id, user_id, email, verification_code, verification_deferred, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), input.userId, input.email, verificationCode, false, expiresAt]
  );

  try {
    await sendActivationEmail({
      to: input.email,
      firstName: input.firstName,
      activationCode: verificationCode,
      activationLink: buildActivationLink(input.email, verificationCode),
    });
    return { emailDelivery: 'sent', verificationCode, expiresAt };
  } catch (error) {
    console.warn('[USER EMAIL VERIFY] Activation email send failed:', error);
    return { emailDelivery: 'failed', verificationCode, expiresAt };
  }
}

export async function verifyUserEmailCode(email: string, code: string): Promise<void> {
  await ensureUserEmailVerificationSupport();

  const rows = await query(
    `SELECT * FROM user_email_verifications
     WHERE email = ? AND verification_code = ? AND verified = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code]
  ) as any[];

  if (rows.length === 0) {
    throw new Error('Invalid or expired verification code');
  }

  const verification = rows[0];

  await query(
    'UPDATE user_email_verifications SET verified = TRUE, verification_deferred = FALSE, verified_at = NOW() WHERE id = ?',
    [verification.id]
  );
  await query(
    'UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = ?',
    [verification.user_id]
  );
}

export async function resendUserEmailVerification(email: string): Promise<{ emailDelivery: 'sent' | 'failed' }> {
  await ensureUserEmailVerificationSupport();

  const users = await query(
    'SELECT id, first_name, email_verified, status FROM users WHERE email = ? LIMIT 1',
    [email]
  ) as any[];

  if (users.length === 0) {
    throw new Error('Account not found for this email');
  }

  const user = users[0];

  if (user.email_verified) {
    throw new Error('Email already verified');
  }

  if (user.status === 'banned' || user.status === 'suspended') {
    throw new Error(`Account is ${user.status}`);
  }

  const lastRows = await query(
    `SELECT created_at FROM user_email_verifications
     WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
    [email]
  ) as any[];

  if (lastRows.length > 0) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(lastRows[0].created_at).getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      throw new Error(`Please wait ${RESEND_COOLDOWN_SECONDS - elapsedSeconds}s before requesting another code`);
    }
  }

  const result = await createUserEmailVerification({
    userId: user.id,
    email,
    firstName: String(user.first_name || 'Trader'),
  });

  return { emailDelivery: result.emailDelivery };
}

export async function getUserEmailVerificationStatus(email: string): Promise<{
  emailVerified: boolean;
  hasPendingVerification: boolean;
  pendingCodeExpired: boolean;
  verificationDeferred: boolean;
}> {
  await ensureUserEmailVerificationSupport();

  const userRows = await query(
    `SELECT email_verified
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  ) as any[];

  const user = userRows[0];
  const emailVerified = user?.email_verified === true;
  const defaultVerificationDeferred = false;

  const rows = await query(
    `SELECT verified, verification_deferred, expires_at FROM user_email_verifications
     WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
    [email]
  ) as any[];

  if (rows.length === 0) {
    return {
      emailVerified,
      hasPendingVerification: false,
      pendingCodeExpired: false,
      verificationDeferred: defaultVerificationDeferred,
    };
  }

  const latest = rows[0];
  const pending = latest.verified === false;
  const expired = pending && new Date(latest.expires_at).getTime() <= Date.now();
  const verificationDeferred = latest.verification_deferred === true;

  return {
    emailVerified,
    hasPendingVerification: pending,
    pendingCodeExpired: expired,
    verificationDeferred,
  };
}

export async function deferUserEmailVerification(email: string): Promise<void> {
  await ensureUserEmailVerificationSupport();

  const users = await query(
    `SELECT id, email_verified, status
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  ) as any[];

  if (users.length === 0) {
    throw new Error('Account not found for this email');
  }

  const user = users[0];
  if (user.email_verified) {
    return;
  }

  if (user.status === 'banned' || user.status === 'suspended') {
    throw new Error(`Account is ${user.status}`);
  }

  await query(
    `UPDATE user_email_verifications
     SET verification_deferred = TRUE
     WHERE user_id = ? AND verified = FALSE`,
    [user.id]
  );
}

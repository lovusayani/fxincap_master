import { v4 as uuidv4 } from 'uuid';
import bcryptjs from 'bcryptjs';
import { query } from '../lib/database.js';
import { sendEmail } from '../lib/mailer.js';

const RESET_CODE_EXPIRY_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;

let ensureTablePromise: Promise<void> | null = null;

function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildResetLink(email: string, code: string): string {
  const appUrl = String(process.env.TRADE_APP_URL || process.env.VITE_APP_URL || 'https://trade.ncapfx.com').replace(/\/$/, '');
  return `${appUrl}/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
}

export async function ensureUserPasswordResetTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS user_password_resets (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          email TEXT NOT NULL,
          reset_code VARCHAR(6) NOT NULL,
          used BOOLEAN NOT NULL DEFAULT FALSE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`
      );
      await query('CREATE INDEX IF NOT EXISTS idx_user_password_resets_email ON user_password_resets(email)');
    })();
  }
  await ensureTablePromise;
}

/** Always returns a generic success — never reveals whether the email exists. */
export async function requestPasswordReset(email: string): Promise<{ emailDelivery: 'sent' | 'skipped' | 'failed' }> {
  await ensureUserPasswordResetTable();

  const users = await query(
    'SELECT id, first_name FROM users WHERE email = ? LIMIT 1',
    [email]
  ) as any[];

  if (users.length === 0) {
    return { emailDelivery: 'skipped' };
  }
  const user = users[0];

  const lastRows = await query(
    `SELECT created_at FROM user_password_resets WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
    [email]
  ) as any[];
  if (lastRows.length > 0) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(lastRows[0].created_at).getTime()) / 1000);
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      return { emailDelivery: 'skipped' };
    }
  }

  const resetCode = generateResetCode();
  const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO user_password_resets (id, user_id, email, reset_code, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), user.id, email, resetCode, expiresAt]
  );

  const firstName = String(user.first_name || 'there');
  const resetLink = buildResetLink(email, resetCode);

  try {
    // Branded shell + admin-editable login body copy, same as the other mails.
    const { getEmailBranding, renderBrandedEmail, escapeEmailHtmlWithBreaks } = await import('../lib/emailBranding.js');
    const branding = await getEmailBranding();

    await sendEmail({
      to: email,
      subject: 'Reset your password',
      html: renderBrandedEmail({
        branding,
        title: 'Reset Your Password',
        accentColor: '#38bdf8',
        bodyHtml: `
          <p style="margin:0 0 12px">Hi ${firstName},</p>
          <p style="margin:0 0 18px;color:#cbd5e1;line-height:1.6">${escapeEmailHtmlWithBreaks(branding.bodyLogin)}</p>
          <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#f8fafc;margin:20px 0;text-align:center">${resetCode}</p>
          <p style="margin:22px 0;text-align:center">
            <a href="${resetLink}" style="background:#0ea5e9;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Reset Password</a>
          </p>
          <p style="color:#94a3b8;font-size:13px">This code expires in ${RESET_CODE_EXPIRY_MINUTES} minutes. If you didn't request this, you can safely ignore this email.</p>
        `,
      }),
    });
    return { emailDelivery: 'sent' };
  } catch (error) {
    console.warn('[PASSWORD RESET] Email send failed:', error);
    return { emailDelivery: 'failed' };
  }
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  await ensureUserPasswordResetTable();

  const rows = await query(
    `SELECT * FROM user_password_resets
     WHERE email = ? AND reset_code = ? AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code]
  ) as any[];

  if (rows.length === 0) {
    throw new Error('Invalid or expired reset code');
  }
  const reset = rows[0];

  const hashedPassword = await bcryptjs.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, reset.user_id]);
  await query('UPDATE user_password_resets SET used = TRUE WHERE id = ?', [reset.id]);
}

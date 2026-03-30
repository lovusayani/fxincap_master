import fs from "fs";
import path from "path";
import sgMail, { MailDataRequired } from "@sendgrid/mail";
import nodemailer from "nodemailer";
import { getStoredEmailSettings } from "./email-settings.js";
import { getEmailProvider, getStoredSmtpSettings } from "./smtp-settings.js";

const getMailerConfig = async () => {
  const settings = await getStoredEmailSettings();
  const sendgridApiKey = String(settings.sendgridApiKey || "").trim();
  const sendgridFrom = String(settings.sendgridFrom || "noreply@suimfx.com").trim() || "noreply@suimfx.com";
  if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
  }
  return { sendgridApiKey, sendgridFrom };
};

type DepositEmailPayload = {
  to: string;
  amount: number;
  currency: string;
  cryptoSymbol?: string;
  chain?: string;
  walletOwnerName?: string;
  reference: string;
  userId: number;
  userEmail?: string | null;
  notes?: string;
  screenshotPath?: string;
  verificationUrl?: string;
};

const buildAttachment = (filePath?: string) => {
  if (!filePath) return undefined;

  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) return undefined;

  const fileBuffer = fs.readFileSync(absolutePath);
  return {
    content: fileBuffer.toString("base64"),
    filename: path.basename(absolutePath),
    type: "application/octet-stream",
    disposition: "attachment",
  };
};

export const sendDepositEmail = async (payload: DepositEmailPayload) => {
  const { sendgridApiKey, sendgridFrom } = await getMailerConfig();
  if (!sendgridApiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  const {
    to,
    amount,
    currency,
    cryptoSymbol,
    chain,
    walletOwnerName,
    reference,
    userId,
    userEmail,
    notes,
    screenshotPath,
    verificationUrl,
  } = payload;

  const attachment = buildAttachment(screenshotPath);

  const htmlBody = `
    <h3>New Deposit Request</h3>
    <p><strong>Amount:</strong> ${amount} ${currency}</p>
    ${cryptoSymbol ? `<p><strong>Crypto:</strong> ${cryptoSymbol}</p>` : ""}
    ${chain ? `<p><strong>Network:</strong> ${chain}</p>` : ""}
    ${walletOwnerName ? `<p><strong>Wallet Owner:</strong> ${walletOwnerName}</p>` : ""}
    <p><strong>Reference:</strong> ${reference}</p>
    <p><strong>User ID:</strong> ${userId}</p>
    ${userEmail ? `<p><strong>User Email:</strong> ${userEmail}</p>` : ""}
    ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
    ${verificationUrl ? `<p><a href="${verificationUrl}">Open verification dashboard</a></p>` : ""}
  `;

  const msg: MailDataRequired = {
    to,
    from: sendgridFrom,
    subject: `New deposit request - Ref ${reference}`,
    html: htmlBody,
  };

  if (attachment) {
    msg.attachments = [attachment];
  }

  try {
    console.log(`[MAILER] Sending deposit email to ${to} (ref ${reference})`);
    await sgMail.send(msg);
    console.log(`[MAILER] Deposit email sent to ${to} (ref ${reference})`);
  } catch (err: any) {
    console.error("[MAILER] Deposit email send error:", err?.response?.body || err);
    throw err;
  }
};

type GenericEmailPayload = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: string;
  }>;
};

// ——— SMTP via nodemailer ———
const sendViaSmtp = async (payload: GenericEmailPayload & { fromOverride?: string }): Promise<void> => {
  const smtp = await getStoredSmtpSettings();
  if (!smtp.smtpHost || !smtp.smtpUser || !smtp.smtpPassword) {
    throw new Error("SMTP is not fully configured (host/user/password required)");
  }
  const fromAddress = payload.fromOverride || smtp.smtpFrom || smtp.smtpUser;
  const transporter = nodemailer.createTransport({
    host: smtp.smtpHost,
    port: smtp.smtpPort,
    secure: smtp.smtpSecure,
    auth: { user: smtp.smtpUser, pass: smtp.smtpPassword },
  });
  const mailOptions: nodemailer.SendMailOptions = {
    from: fromAddress,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  };
  if (payload.attachments && payload.attachments.length > 0) {
    mailOptions.attachments = payload.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, "base64"),
      contentType: a.type,
    }));
  }
  await transporter.sendMail(mailOptions);
};

// ——— SendGrid single send ———
const sendViaSendGrid = async (payload: GenericEmailPayload & { fromOverride?: string }): Promise<void> => {
  const { sendgridApiKey, sendgridFrom } = await getMailerConfig();
  if (!sendgridApiKey) throw new Error("SENDGRID_API_KEY is not configured");
  const fromAddress = payload.fromOverride || sendgridFrom;
  const msg: MailDataRequired = {
    to: payload.to,
    from: fromAddress,
    subject: payload.subject,
    html: payload.html,
  };
  if (payload.attachments && payload.attachments.length > 0) {
    msg.attachments = payload.attachments;
  }
  await sgMail.send(msg);
};

export const sendEmail = async (payload: GenericEmailPayload) => {
  const { to, subject } = payload;
  const provider = await getEmailProvider();

  if (provider === "smtp") {
    try {
      console.log(`[MAILER] Sending email via SMTP to ${to} (subject: ${subject})`);
      await sendViaSmtp(payload);
      console.log(`[MAILER] SMTP email sent to ${to}`);
    } catch (primaryErr: any) {
      console.warn(`[MAILER] SMTP failed, falling back to SendGrid: ${primaryErr?.message}`);
      try {
        await sendViaSendGrid(payload);
        console.log(`[MAILER] SendGrid fallback email sent to ${to}`);
      } catch (fallbackErr: any) {
        console.error("[MAILER] Both SMTP and SendGrid failed", fallbackErr?.response?.body || fallbackErr);
        throw fallbackErr;
      }
    }
  } else {
    // provider === 'sendgrid' (default)
    try {
      console.log(`[MAILER] Sending email via SendGrid to ${to} (subject: ${subject})`);
      await sendViaSendGrid(payload);
      console.log(`[MAILER] SendGrid email sent to ${to}`);
    } catch (primaryErr: any) {
      console.warn(`[MAILER] SendGrid failed, falling back to SMTP: ${primaryErr?.message}`);
      try {
        await sendViaSmtp(payload);
        console.log(`[MAILER] SMTP fallback email sent to ${to}`);
      } catch (fallbackErr: any) {
        console.error("[MAILER] Both SendGrid and SMTP failed", fallbackErr);
        throw fallbackErr;
      }
    }
  }
};

const ACTIVATION_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "uploads/mails/templates/activation/24032026.html"
);

export type ActivationEmailPayload = {
  to: string;
  firstName: string;
  activationCode: string;
  activationLink: string;
};

/**
 * Send the branded activation/verification email using the
 * SendGrid-designed HTML template stored in uploads/mails/templates/.
 * Replaces '123456' with the real code and the placeholder href with the real link.
 */
export const sendActivationEmail = async (
  payload: ActivationEmailPayload
): Promise<void> => {
  let html: string;
  try {
    html = fs.readFileSync(ACTIVATION_TEMPLATE_PATH, "utf8");
  } catch {
    throw new Error(`Activation email template not found at ${ACTIVATION_TEMPLATE_PATH}`);
  }

  // Replace placeholder values injected in the SendGrid template design
  html = html.replace(/123456/g, payload.activationCode);
  html = html.replace(
    /href="https:\/\/www\.google\.com"/g,
    `href="${payload.activationLink}"`
  );
  html = html.replace(/\bfirstname\b/g, payload.firstName);

  await sendEmail({
    to: payload.to,
    subject: "Verify your email address",
    html,
  });
};

// Safe wrapper that does not throw; returns whether send succeeded.
export const safeSendEmail = async (
  payload: GenericEmailPayload
): Promise<{ success: boolean; error?: string }> => {
  try {
    await sendEmail(payload);
    return { success: true };
  } catch (err: any) {
    const body = err?.response?.body;
    const msg: string = body?.errors?.[0]?.message || err?.message || 'Email send failed';
    // Common SendGrid quota/auth errors: treat as non-fatal
    if (
      /Maximum credits exceeded/i.test(msg) ||
      /Unauthorized/i.test(msg) ||
      /invalid api key/i.test(msg)
    ) {
      console.warn(`[MAILER] Non-fatal email error: ${msg}`);
      return { success: false, error: msg };
    }
    console.warn(`[MAILER] Email error: ${msg}`);
    return { success: false, error: msg };
  }
};


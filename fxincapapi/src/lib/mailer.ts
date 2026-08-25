import fs from "fs";
import path from "path";
import Mailgun from "mailgun.js";
import FormData from "form-data";
import nodemailer from "nodemailer";
import { getStoredEmailSettings } from "./email-settings.js";
import { getEmailProvider, getStoredSmtpSettings } from "./smtp-settings.js";

const mailgun = new Mailgun(FormData);

const getMailerConfig = async () => {
  const settings = await getStoredEmailSettings();
  const mailgunApiKey = String(settings.mailgunApiKey || "").trim();
  const mailgunDomain = String(settings.mailgunDomain || "").trim();
  const mailgunFrom = String(settings.mailgunFrom || "noreply@support.ncapfx.com").trim() || "noreply@support.ncapfx.com";
  const mailgunRegion = settings.mailgunRegion === "eu" ? "eu" : "us";
  const client = mailgunApiKey
    ? mailgun.client({
        username: "api",
        key: mailgunApiKey,
        url: mailgunRegion === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net",
      })
    : null;
  return { mailgunApiKey, mailgunDomain, mailgunFrom, client };
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
    data: fileBuffer,
    filename: path.basename(absolutePath),
  };
};

export const sendDepositEmail = async (payload: DepositEmailPayload) => {
  const { client, mailgunDomain, mailgunFrom } = await getMailerConfig();
  if (!client || !mailgunDomain) {
    throw new Error("MAILGUN_API_KEY / MAILGUN_DOMAIN is not configured");
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

  try {
    console.log(`[MAILER] Sending deposit email to ${to} (ref ${reference})`);
    await client.messages.create(mailgunDomain, {
      to,
      from: mailgunFrom,
      subject: `New deposit request - Ref ${reference}`,
      html: htmlBody,
      ...(attachment ? { attachment: [attachment] } : {}),
    });
    console.log(`[MAILER] Deposit email sent to ${to} (ref ${reference})`);
  } catch (err: any) {
    console.error("[MAILER] Deposit email send error:", err?.message || err);
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

// ——— Mailgun single send ———
const sendViaMailgun = async (payload: GenericEmailPayload & { fromOverride?: string }): Promise<void> => {
  const { client, mailgunDomain, mailgunFrom } = await getMailerConfig();
  if (!client || !mailgunDomain) throw new Error("MAILGUN_API_KEY / MAILGUN_DOMAIN is not configured");
  const fromAddress = payload.fromOverride || mailgunFrom;
  const attachment = payload.attachments && payload.attachments.length > 0
    ? payload.attachments.map((a) => ({ data: Buffer.from(a.content, "base64"), filename: a.filename }))
    : undefined;
  await client.messages.create(mailgunDomain, {
    to: payload.to,
    from: fromAddress,
    subject: payload.subject,
    html: payload.html,
    ...(attachment ? { attachment } : {}),
  });
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
      console.warn(`[MAILER] SMTP failed, falling back to Mailgun: ${primaryErr?.message}`);
      try {
        await sendViaMailgun(payload);
        console.log(`[MAILER] Mailgun fallback email sent to ${to}`);
      } catch (fallbackErr: any) {
        console.error("[MAILER] Both SMTP and Mailgun failed", fallbackErr?.message || fallbackErr);
        throw fallbackErr;
      }
    }
  } else {
    // provider === 'mailgun' (default)
    try {
      console.log(`[MAILER] Sending email via Mailgun to ${to} (subject: ${subject})`);
      await sendViaMailgun(payload);
      console.log(`[MAILER] Mailgun email sent to ${to}`);
    } catch (primaryErr: any) {
      console.warn(`[MAILER] Mailgun failed, falling back to SMTP: ${primaryErr?.message}`);
      try {
        await sendViaSmtp(payload);
        console.log(`[MAILER] SMTP fallback email sent to ${to}`);
      } catch (fallbackErr: any) {
        console.error("[MAILER] Both Mailgun and SMTP failed", fallbackErr);
        throw fallbackErr;
      }
    }
  }
};

const ACTIVATION_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "src/emailTemplates/activation.html"
);

export type ActivationEmailPayload = {
  to: string;
  firstName: string;
  activationCode: string;
  activationLink: string;
};

/**
 * Send the activation/verification email.
 *
 * Rendered through the shared branded shell so the admin-configured logo,
 * header, footer and registration body copy apply here exactly as they do to
 * the deposit/withdrawal/trade notifications. The legacy SendGrid-exported
 * template is still used as a fallback if branding cannot be loaded.
 */
export const sendActivationEmail = async (
  payload: ActivationEmailPayload
): Promise<void> => {
  let html: string;

  try {
    const { getEmailBranding, renderBrandedEmail, escapeEmailHtmlWithBreaks } = await import("./emailBranding.js");
    const branding = await getEmailBranding();
    html = renderBrandedEmail({
      branding,
      title: "Verify your email address",
      accentColor: "#f6d505",
      bodyHtml: `
        <p style="margin:0 0 12px">Hi ${payload.firstName || "there"},</p>
        <p style="margin:0 0 18px;color:#cbd5e1;line-height:1.6">${escapeEmailHtmlWithBreaks(branding.bodyRegistration)}</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#f8fafc;margin:20px 0;text-align:center">${payload.activationCode}</p>
        <p style="margin:22px 0;text-align:center">
          <a href="${payload.activationLink}" style="background:#ffe300;color:#000;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Verify Email</a>
        </p>
      `,
    });
  } catch (error) {
    console.warn("[MAILER] Branded activation render failed, falling back to template file:", error);
    try {
      html = fs.readFileSync(ACTIVATION_TEMPLATE_PATH, "utf8");
    } catch {
      throw new Error(`Activation email template not found at ${ACTIVATION_TEMPLATE_PATH}`);
    }
    html = html.replace(/123456/g, payload.activationCode);
    html = html.replace(/href="https:\/\/www\.google\.com"/g, `href="${payload.activationLink}"`);
    html = html.replace(/\bfirstname\b/g, payload.firstName);
  }

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
    const body = err?.details || err?.response?.body;
    const msg: string = body?.errors?.[0]?.message || err?.message || 'Email send failed';
    // Common provider quota/auth errors: treat as non-fatal
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


import { getAdmSettings, setAdmSetting } from "./adm-settings.js";

/**
 * Admin-editable branding shared by every transactional email (registration,
 * deposit, withdrawal, trade execution) plus the body copy for the two
 * account-lifecycle mails the admin is allowed to reword.
 */
export type EmailBranding = {
  logoUrl: string;
  header: string;
  footer: string;
  bodyRegistration: string;
  bodyLogin: string;
};

const KEYS = {
  logoUrl: "email_logo_url",
  header: "email_header",
  footer: "email_footer",
  bodyRegistration: "email_body_registration",
  bodyLogin: "email_body_login",
} as const;

export const EMAIL_BRANDING_DEFAULTS: EmailBranding = {
  logoUrl: "",
  header: "Curreex",
  footer: "This is an automated message — please do not reply directly to this email.",
  bodyRegistration:
    "Welcome aboard! Use the verification code below to activate your account and start trading.",
  bodyLogin:
    "We received a request to reset your password. Use the code below to choose a new one.",
};

export async function getEmailBranding(): Promise<EmailBranding> {
  const db = await getAdmSettings(Object.values(KEYS) as string[]);
  const pick = (key: string, fallback: string) => {
    const value = db[key];
    return value === undefined || value === null || String(value).trim() === "" ? fallback : String(value);
  };
  return {
    logoUrl: pick(KEYS.logoUrl, EMAIL_BRANDING_DEFAULTS.logoUrl),
    header: pick(KEYS.header, EMAIL_BRANDING_DEFAULTS.header),
    footer: pick(KEYS.footer, EMAIL_BRANDING_DEFAULTS.footer),
    bodyRegistration: pick(KEYS.bodyRegistration, EMAIL_BRANDING_DEFAULTS.bodyRegistration),
    bodyLogin: pick(KEYS.bodyLogin, EMAIL_BRANDING_DEFAULTS.bodyLogin),
  };
}

export async function saveEmailBranding(input: Partial<EmailBranding>): Promise<EmailBranding> {
  const current = await getEmailBranding();
  const next: EmailBranding = {
    logoUrl: (input.logoUrl ?? current.logoUrl).trim(),
    header: (input.header ?? current.header).trim(),
    footer: (input.footer ?? current.footer).trim(),
    bodyRegistration: (input.bodyRegistration ?? current.bodyRegistration).trim(),
    bodyLogin: (input.bodyLogin ?? current.bodyLogin).trim(),
  };

  await Promise.all([
    setAdmSetting(KEYS.logoUrl, next.logoUrl),
    setAdmSetting(KEYS.header, next.header),
    setAdmSetting(KEYS.footer, next.footer),
    setAdmSetting(KEYS.bodyRegistration, next.bodyRegistration),
    setAdmSetting(KEYS.bodyLogin, next.bodyLogin),
  ]);

  return next;
}

/** Escape admin-supplied text before it lands in an HTML email. */
const escapeHtml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Preserve intentional line breaks from the admin textarea. */
const escapeWithBreaks = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

/**
 * Wrap body content in the branded shell. Used by every transactional email so
 * a branding change in the admin panel takes effect everywhere at once.
 */
export function renderBrandedEmail(input: {
  branding: EmailBranding;
  title: string;
  accentColor?: string;
  bodyHtml: string;
}): string {
  const { branding, title, bodyHtml } = input;
  const accent = input.accentColor || "#38bdf8";

  const logoBlock = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.header)}"
           style="max-height:44px;max-width:200px;display:block;margin:0 auto 12px" />`
    : "";

  return `
  <div style="background:#05070b;padding:24px 12px;font-family:Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#0b0f1a;border-radius:12px;overflow:hidden;border:1px solid #1e293b">
      <div style="padding:24px 24px 8px;text-align:center;border-bottom:1px solid #1e293b">
        ${logoBlock}
        <p style="margin:0;color:#e2e8f0;font-size:18px;font-weight:bold;letter-spacing:0.5px">
          ${escapeHtml(branding.header)}
        </p>
      </div>
      <div style="padding:24px;color:#e2e8f0">
        <h2 style="margin:0 0 16px;color:${accent};font-size:20px">${escapeHtml(title)}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #1e293b;background:#080c14">
        <p style="margin:0;color:#64748b;font-size:11px;line-height:1.6;text-align:center">
          ${escapeWithBreaks(branding.footer)}
        </p>
      </div>
    </div>
  </div>`;
}

export { escapeHtml as escapeEmailHtml, escapeWithBreaks as escapeEmailHtmlWithBreaks };

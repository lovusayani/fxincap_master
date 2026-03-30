import { getAdmSettings, setAdmSetting } from "./adm-settings.js";

export type SmtpSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
};

export type EmailProvider = "sendgrid" | "smtp";

const DB_KEY_PROVIDER  = "email_provider";
const DB_KEY_HOST      = "smtp_host";
const DB_KEY_PORT      = "smtp_port";
const DB_KEY_SECURE    = "smtp_secure";
const DB_KEY_USER      = "smtp_user";
const DB_KEY_PASSWORD  = "smtp_password";
const DB_KEY_FROM      = "smtp_from";

const SMTP_DEFAULTS: SmtpSettings = {
  smtpHost:     "smtpout.secureserver.net",
  smtpPort:     465,
  smtpSecure:   true,
  smtpUser:     "",
  smtpPassword: "",
  smtpFrom:     "",
};

export const getStoredSmtpSettings = async (): Promise<SmtpSettings> => {
  const db = await getAdmSettings([
    DB_KEY_HOST, DB_KEY_PORT, DB_KEY_SECURE,
    DB_KEY_USER, DB_KEY_PASSWORD, DB_KEY_FROM,
  ]);

  return {
    smtpHost:     String(db[DB_KEY_HOST]     ?? SMTP_DEFAULTS.smtpHost).trim(),
    smtpPort:     parseInt(String(db[DB_KEY_PORT] ?? SMTP_DEFAULTS.smtpPort), 10) || 465,
    smtpSecure:   db[DB_KEY_SECURE] !== undefined
                    ? String(db[DB_KEY_SECURE]).toLowerCase() !== "false"
                    : SMTP_DEFAULTS.smtpSecure,
    smtpUser:     String(db[DB_KEY_USER]     ?? SMTP_DEFAULTS.smtpUser).trim(),
    smtpPassword: String(db[DB_KEY_PASSWORD] ?? SMTP_DEFAULTS.smtpPassword),
    smtpFrom:     String(db[DB_KEY_FROM]     ?? SMTP_DEFAULTS.smtpFrom).trim(),
  };
};

export const saveStoredSmtpSettings = async (
  settings: Partial<SmtpSettings>
): Promise<SmtpSettings> => {
  const current = await getStoredSmtpSettings();
  const next: SmtpSettings = {
    smtpHost:     String(settings.smtpHost     ?? current.smtpHost).trim()     || SMTP_DEFAULTS.smtpHost,
    smtpPort:     parseInt(String(settings.smtpPort ?? current.smtpPort), 10)  || 465,
    smtpSecure:   typeof settings.smtpSecure === "boolean" ? settings.smtpSecure : current.smtpSecure,
    smtpUser:     String(settings.smtpUser     ?? current.smtpUser).trim(),
    smtpPassword: typeof settings.smtpPassword === "string" && settings.smtpPassword.trim()
                    ? settings.smtpPassword.trim()
                    : current.smtpPassword,
    smtpFrom:     String(settings.smtpFrom     ?? current.smtpFrom).trim(),
  };

  await Promise.all([
    setAdmSetting(DB_KEY_HOST,     next.smtpHost),
    setAdmSetting(DB_KEY_PORT,     String(next.smtpPort)),
    setAdmSetting(DB_KEY_SECURE,   String(next.smtpSecure)),
    setAdmSetting(DB_KEY_USER,     next.smtpUser),
    setAdmSetting(DB_KEY_PASSWORD, next.smtpPassword),
    setAdmSetting(DB_KEY_FROM,     next.smtpFrom),
  ]);

  return next;
};

export const getEmailProvider = async (): Promise<EmailProvider> => {
  const db = await getAdmSettings([DB_KEY_PROVIDER]);
  const val = String(db[DB_KEY_PROVIDER] ?? "sendgrid").trim().toLowerCase();
  return val === "smtp" ? "smtp" : "sendgrid";
};

export const setEmailProvider = async (provider: EmailProvider): Promise<void> => {
  await setAdmSetting(DB_KEY_PROVIDER, provider);
};

export const maskSmtpPassword = (value: string): string => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 8) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 2)}${"*".repeat(Math.max(4, normalized.length - 4))}${normalized.slice(-2)}`;
};

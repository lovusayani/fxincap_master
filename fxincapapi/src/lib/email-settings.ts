import { getAdmSettings, setAdmSetting } from "./adm-settings.js";

export type EmailSettings = {
  sendgridApiKey: string;
  sendgridFrom: string;
};

const DB_KEY_API_KEY = "sendgrid_api_key";
const DB_KEY_FROM    = "sendgrid_from";

const envDefaults = (): EmailSettings => ({
  sendgridApiKey: String(process.env.SENDGRID_API_KEY || "").trim(),
  sendgridFrom:   String(process.env.SENDGRID_FROM    || "noreply@suimfx.com").trim(),
});

export const getStoredEmailSettings = async (): Promise<EmailSettings> => {
  const db  = await getAdmSettings([DB_KEY_API_KEY, DB_KEY_FROM]);
  const env = envDefaults();
  return {
    sendgridApiKey: db[DB_KEY_API_KEY] ?? env.sendgridApiKey,
    sendgridFrom:   db[DB_KEY_FROM] ?? (env.sendgridFrom || "noreply@suimfx.com"),
  };
};

export const saveStoredEmailSettings = async (
  settings: Partial<EmailSettings>
): Promise<EmailSettings> => {
  const current = await getStoredEmailSettings();
  const next: EmailSettings = {
    sendgridApiKey: String(settings.sendgridApiKey ?? current.sendgridApiKey ?? "").trim(),
    sendgridFrom:   String(settings.sendgridFrom   ?? current.sendgridFrom   ?? "noreply@suimfx.com").trim(),
  };
  await Promise.all([
    setAdmSetting(DB_KEY_API_KEY, next.sendgridApiKey),
    setAdmSetting(DB_KEY_FROM,    next.sendgridFrom),
  ]);
  return next;
};

export const maskEmailApiKey = (value: string): string => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 8) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 4)}${"*".repeat(Math.max(4, normalized.length - 8))}${normalized.slice(-4)}`;
};
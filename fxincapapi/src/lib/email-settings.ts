import { getAdmSettings, setAdmSetting } from "./adm-settings.js";

export type EmailSettings = {
  mailgunApiKey: string;
  mailgunDomain: string;
  mailgunFrom: string;
  mailgunRegion: "us" | "eu";
};

const DB_KEY_API_KEY = "mailgun_api_key";
const DB_KEY_DOMAIN  = "mailgun_domain";
const DB_KEY_FROM    = "mailgun_from";
const DB_KEY_REGION  = "mailgun_region";

const envDefaults = (): EmailSettings => ({
  mailgunApiKey: String(process.env.MAILGUN_API_KEY || "").trim(),
  mailgunDomain: String(process.env.MAILGUN_DOMAIN  || "").trim(),
  mailgunFrom:   String(process.env.MAILGUN_FROM     || "noreply@support.ncapfx.com").trim(),
  mailgunRegion: (String(process.env.MAILGUN_REGION || "us").trim().toLowerCase() === "eu" ? "eu" : "us"),
});

export const getStoredEmailSettings = async (): Promise<EmailSettings> => {
  const db  = await getAdmSettings([DB_KEY_API_KEY, DB_KEY_DOMAIN, DB_KEY_FROM, DB_KEY_REGION]);
  const env = envDefaults();
  return {
    mailgunApiKey: db[DB_KEY_API_KEY] ?? env.mailgunApiKey,
    mailgunDomain: db[DB_KEY_DOMAIN] ?? env.mailgunDomain,
    mailgunFrom:   db[DB_KEY_FROM] ?? (env.mailgunFrom || "noreply@support.ncapfx.com"),
    mailgunRegion: (db[DB_KEY_REGION] ?? env.mailgunRegion) === "eu" ? "eu" : "us",
  };
};

export const saveStoredEmailSettings = async (
  settings: Partial<EmailSettings>
): Promise<EmailSettings> => {
  const current = await getStoredEmailSettings();
  const next: EmailSettings = {
    mailgunApiKey: String(settings.mailgunApiKey ?? current.mailgunApiKey ?? "").trim(),
    mailgunDomain: String(settings.mailgunDomain ?? current.mailgunDomain ?? "").trim(),
    mailgunFrom:   String(settings.mailgunFrom   ?? current.mailgunFrom   ?? "noreply@support.ncapfx.com").trim(),
    mailgunRegion: settings.mailgunRegion === "eu" || settings.mailgunRegion === "us"
      ? settings.mailgunRegion
      : current.mailgunRegion,
  };
  await Promise.all([
    setAdmSetting(DB_KEY_API_KEY, next.mailgunApiKey),
    setAdmSetting(DB_KEY_DOMAIN,  next.mailgunDomain),
    setAdmSetting(DB_KEY_FROM,    next.mailgunFrom),
    setAdmSetting(DB_KEY_REGION,  next.mailgunRegion),
  ]);
  return next;
};

export const maskEmailApiKey = (value: string): string => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.length <= 8) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 4)}${"*".repeat(Math.max(4, normalized.length - 8))}${normalized.slice(-4)}`;
};

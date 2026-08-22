import { getAdmSettings, setAdmSetting } from "./adm-settings.js";
import { query } from "./database.js";

export type NotificationCategory = "deposit" | "withdrawal" | "trade";

export type NotificationSettings = {
  dailyCap: number;
  typesEnabled: Record<NotificationCategory, boolean>;
};

const DB_KEY_CAP = "notif_daily_cap";
const DB_KEY_TYPE: Record<NotificationCategory, string> = {
  deposit: "notif_type_deposit",
  withdrawal: "notif_type_withdrawal",
  trade: "notif_type_trade",
};

const DEFAULTS: NotificationSettings = {
  dailyCap: 20,
  typesEnabled: { deposit: true, withdrawal: true, trade: true },
};

const parseBool = (value: string | null | undefined, fallback: boolean): boolean =>
  value === undefined || value === null || value === "" ? fallback : value !== "false";

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const db = await getAdmSettings([
    DB_KEY_CAP,
    DB_KEY_TYPE.deposit,
    DB_KEY_TYPE.withdrawal,
    DB_KEY_TYPE.trade,
  ]);

  return {
    dailyCap: parseInt(String(db[DB_KEY_CAP] ?? DEFAULTS.dailyCap), 10) || DEFAULTS.dailyCap,
    typesEnabled: {
      deposit: parseBool(db[DB_KEY_TYPE.deposit], DEFAULTS.typesEnabled.deposit),
      withdrawal: parseBool(db[DB_KEY_TYPE.withdrawal], DEFAULTS.typesEnabled.withdrawal),
      trade: parseBool(db[DB_KEY_TYPE.trade], DEFAULTS.typesEnabled.trade),
    },
  };
}

export async function saveNotificationSettings(
  input: Partial<{ dailyCap: number; typesEnabled: Partial<Record<NotificationCategory, boolean>> }>
): Promise<NotificationSettings> {
  const current = await getNotificationSettings();
  const next: NotificationSettings = {
    dailyCap:
      input.dailyCap !== undefined && Number.isFinite(input.dailyCap) && input.dailyCap > 0
        ? Math.floor(input.dailyCap)
        : current.dailyCap,
    typesEnabled: {
      deposit: input.typesEnabled?.deposit ?? current.typesEnabled.deposit,
      withdrawal: input.typesEnabled?.withdrawal ?? current.typesEnabled.withdrawal,
      trade: input.typesEnabled?.trade ?? current.typesEnabled.trade,
    },
  };

  await Promise.all([
    setAdmSetting(DB_KEY_CAP, String(next.dailyCap)),
    setAdmSetting(DB_KEY_TYPE.deposit, String(next.typesEnabled.deposit)),
    setAdmSetting(DB_KEY_TYPE.withdrawal, String(next.typesEnabled.withdrawal)),
    setAdmSetting(DB_KEY_TYPE.trade, String(next.typesEnabled.trade)),
  ]);

  return next;
}

let logTableEnsured = false;
async function ensureLogTable(): Promise<void> {
  if (logTableEnsured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS email_notification_log (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL,
       category VARCHAR(20) NOT NULL,
       sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
  logTableEnsured = true;
}

/** Whether a notification of this category may still be sent to this trader today. */
export async function canSendNotification(userId: string, category: NotificationCategory): Promise<boolean> {
  const settings = await getNotificationSettings();
  if (!settings.typesEnabled[category]) return false;

  await ensureLogTable();
  const rows = (await query(
    `SELECT COUNT(*) AS c FROM email_notification_log WHERE user_id = ? AND sent_at >= NOW() - INTERVAL '24 hours'`,
    [userId]
  )) as any[];
  const count = parseInt(rows[0]?.c ?? "0", 10) || 0;
  return count < settings.dailyCap;
}

export async function recordNotificationSent(userId: string, category: NotificationCategory): Promise<void> {
  await ensureLogTable();
  await query(`INSERT INTO email_notification_log (user_id, category) VALUES (?, ?)`, [userId, category]);
}

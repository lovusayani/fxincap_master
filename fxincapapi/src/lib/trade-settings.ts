import { query } from "./database.js";

const DEFAULT_TIMEOUT_MINUTES = 5;

async function ensureTradeSettingsTable(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS trade_settings (
      id SMALLINT NOT NULL PRIMARY KEY,
      auto_close_timeout_minutes INT NOT NULL DEFAULT 5,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await query(
    `INSERT INTO trade_settings (id, auto_close_timeout_minutes)
     VALUES (1, ?)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_TIMEOUT_MINUTES]
  );
}

export async function getAutoCloseTimeoutMinutes(): Promise<number> {
  await ensureTradeSettingsTable();

  const rows = await query(
    `SELECT auto_close_timeout_minutes FROM trade_settings WHERE id = 1 LIMIT 1`
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return DEFAULT_TIMEOUT_MINUTES;
  }

  const timeout = Number((rows[0] as any).auto_close_timeout_minutes);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return DEFAULT_TIMEOUT_MINUTES;
  }

  return timeout;
}

export async function setAutoCloseTimeoutMinutes(timeoutMinutes: number): Promise<number> {
  await ensureTradeSettingsTable();

  await query(
    `UPDATE trade_settings SET auto_close_timeout_minutes = ? WHERE id = 1`,
    [timeoutMinutes]
  );

  return timeoutMinutes;
}


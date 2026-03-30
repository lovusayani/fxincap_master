import { query } from "./database.js";

/**
 * Generic key-value store backed by the `adm_settings` PostgreSQL table.
 * Used for storing integration credentials (SendGrid, Firebase, etc.)
 * that admins can update at runtime without restarting the API.
 */

export async function getAdmSetting(key: string): Promise<string | null> {
  try {
    const rows = await query(
      `SELECT value FROM adm_settings WHERE key = $1`,
      [key]
    );
    return rows.length > 0 ? (rows[0].value ?? null) : null;
  } catch {
    return null;
  }
}

export async function setAdmSetting(key: string, value: string): Promise<void> {
  await query(
    `UPDATE adm_settings SET value = $1, updated_at = NOW() WHERE key = $2`,
    [value, key]
  );
}

/**
 * Fetch multiple settings in a single query.
 * Returns a map of { key → value | null } for every requested key.
 */
export async function getAdmSettings(
  keys: string[]
): Promise<Record<string, string | null>> {
  const map: Record<string, string | null> = {};
  for (const k of keys) map[k] = null;

  try {
    const rows = await query(
      `SELECT key, value FROM adm_settings WHERE key = ANY($1)`,
      [keys]
    );
    for (const row of rows) {
      map[row.key] = row.value ?? null;
    }
  } catch {
    // Return nulls on DB failure — callers fall back to env vars
  }

  return map;
}

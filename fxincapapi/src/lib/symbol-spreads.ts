/**
 * Admin-configurable spread markup.
 *
 * The provider's raw bid/ask is the market. This adds a broker markup on top,
 * widening the quote symmetrically so the mid price is unchanged: half the
 * configured pips comes off the bid, half goes onto the ask.
 *
 * Storage only lives here — the markup is *applied* in fxincap-ws at the quote
 * boundary, so every consumer (chart, order ticket, settlement) sees the same
 * number and they cannot drift apart. Applying it in the browser would let a
 * client bypass it.
 *
 * See migrations/006_create_symbol_spreads_table.sql.
 */

import { query } from "./database.js";

/** Reserved symbol used as the fallback for anything without its own row. */
export const ALL_SYMBOLS_KEY = "ALL";

export interface SymbolSpread {
  id: number;
  symbol: string;
  spreadPips: number;
  enabled: boolean;
  updatedAt: string | null;
}

/** Mirrors the boot-time table creation used by account-types.ts. */
export async function ensureSymbolSpreadsTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS symbol_spreads (
        id           SERIAL PRIMARY KEY,
        symbol       VARCHAR(32)    NOT NULL,
        spread_pips  NUMERIC(10, 2) NOT NULL DEFAULT 0,
        enabled      BOOLEAN        NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
      )
    `);
  } catch (error: any) {
    if (!String(error?.message ?? "").includes("already exists")) {
      console.error("[symbol-spreads] create table:", error?.message);
    }
  }

  try {
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_spreads_symbol ON symbol_spreads (symbol)`);
  } catch {
    // Index may already exist.
  }

  try {
    // Disabled with a zero markup: installing this must never change live
    // pricing on its own.
    await query(
      `INSERT INTO symbol_spreads (symbol, spread_pips, enabled)
       VALUES ($1, 0, FALSE)
       ON CONFLICT (symbol) DO NOTHING`,
      [ALL_SYMBOLS_KEY],
    );
  } catch (error: any) {
    console.error("[symbol-spreads] seed ALL row:", error?.message);
  }
}

function mapRow(row: any): SymbolSpread {
  return {
    id: Number(row.id),
    symbol: String(row.symbol).toUpperCase(),
    spreadPips: Number(row.spread_pips),
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function listSymbolSpreads(): Promise<SymbolSpread[]> {
  // 'ALL' first, then symbols alphabetically — the fallback reads as the
  // heading it effectively is.
  // NOTE: lib/database.ts `query()` resolves to `result.rows` — a plain array,
  // not the pg result object. Only `getConnection()` clients expose `.rows`.
  const rows = await query(
    `SELECT id, symbol, spread_pips, enabled, updated_at
       FROM symbol_spreads
      ORDER BY (symbol = $1) DESC, symbol ASC`,
    [ALL_SYMBOLS_KEY],
  );
  return (rows ?? []).map(mapRow);
}

/** Creates or updates the row for a symbol. */
export async function upsertSymbolSpread(
  symbol: string,
  spreadPips: number,
  enabled: boolean,
): Promise<SymbolSpread> {
  const key = String(symbol).trim().toUpperCase();
  const rows = await query(
    `INSERT INTO symbol_spreads (symbol, spread_pips, enabled)
     VALUES ($1, $2, $3)
     ON CONFLICT (symbol) DO UPDATE
       SET spread_pips = EXCLUDED.spread_pips,
           enabled     = EXCLUDED.enabled,
           updated_at  = NOW()
     RETURNING id, symbol, spread_pips, enabled, updated_at`,
    [key, spreadPips, enabled],
  );
  return mapRow(rows[0]);
}

export async function deleteSymbolSpread(symbol: string): Promise<boolean> {
  const key = String(symbol).trim().toUpperCase();
  if (key === ALL_SYMBOLS_KEY) {
    // The fallback is structural. Removing it would leave per-symbol rows with
    // no default behind them; disable it instead.
    throw new Error("The ALL fallback cannot be deleted — disable it instead.");
  }
  // RETURNING rather than rowCount: `query()` hands back only the row array, so
  // rowCount is not available here.
  const rows = await query(`DELETE FROM symbol_spreads WHERE symbol = $1 RETURNING id`, [key]);
  return (rows?.length ?? 0) > 0;
}

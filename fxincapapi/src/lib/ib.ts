/**
 * Introducing Broker (IB) program: schema, referral attribution and commission
 * accrual.
 *
 * Before this module the IB feature stored applications and partners but never
 * recorded a single referral: `ib_partners.referrals` and
 * `ib_partners.commission_earned` were written once as 0 and only ever read,
 * `users` had no column linking a signup to an IB, and the tables meant to hold
 * the relationship (`ib_clients`) and the ledger (`ib_commissions`) existed only
 * in the MySQL-syntax `schema.sql`, which cannot run on PostgreSQL.
 *
 * The ledger (`ib_commissions`) is the source of truth for money. The
 * denormalised counters on `ib_partners` are a cache kept in step with it so the
 * existing admin list queries stay cheap; every reported total is recomputed
 * from the ledger.
 */

import { v4 as uuidv4 } from "uuid";
import { query } from "./database.js";

/** A database handle: either the pool wrapper or an open transaction client. */
type Executor = { query: (sql: string, values?: any[]) => Promise<any> };

/** Runs `sql` on an explicit connection when given, else on the pool. */
async function run(conn: Executor | null, sql: string, values: any[] = []): Promise<any[]> {
  if (conn) {
    const result = await conn.query(sql, values);
    return result.rows ?? [];
  }
  return (await query(sql, values)) as any[];
}

/** How `ib_levels.commission_rate` is interpreted when accruing commission. */
export type CommissionModel = "per_lot" | "percent_notional";

export const DEFAULT_COMMISSION_MODEL: CommissionModel = "per_lot";

let schemaReady = false;

/**
 * Creates and upgrades every IB table.
 *
 * Idempotent, and cached after the first success so it is safe to call at the
 * top of each route. All statements are additive: no column is dropped and no
 * existing row is rewritten, so running this against the live database cannot
 * lose data.
 */
export async function ensureIBTables(): Promise<void> {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS ib_partners (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      ib_code VARCHAR(50) UNIQUE,
      level_id VARCHAR(36),
      status VARCHAR(20) DEFAULT 'active',
      commission_earned DECIMAL(18,2) DEFAULT 0,
      commission_pending DECIMAL(18,2) DEFAULT 0,
      referrals INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ib_applications (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36),
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      experience TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ib_levels (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      commission_rate DECIMAL(5,2) NOT NULL,
      min_referrals INT DEFAULT 0,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ib_settings (
      id INT PRIMARY KEY DEFAULT 1,
      min_deposit DECIMAL(18,2) DEFAULT 0,
      commission_delay_days INT DEFAULT 0,
      auto_approve BOOLEAN DEFAULT false,
      ib_registration_open BOOLEAN DEFAULT true
    )
  `);
  await query(`INSERT INTO ib_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);

  // How commission_rate is read, and where referral links point.
  await query(
    `ALTER TABLE ib_settings ADD COLUMN IF NOT EXISTS commission_model VARCHAR(20) DEFAULT '${DEFAULT_COMMISSION_MODEL}'`
  );
  await query(`ALTER TABLE ib_settings ADD COLUMN IF NOT EXISTS referral_base_url VARCHAR(255)`);

  // The IB <-> referred client relationship, and the sole record of referral
  // attribution.
  //
  // Attribution deliberately does NOT live on `users`: the application's
  // database role does not own that table ("must be owner of table users" on
  // ALTER), so a migration that extends it cannot run. `ib_clients` carries the
  // same information and is owned by this application.
  //
  // client_user_id is UNIQUE so a client belongs to exactly one IB - without it
  // a second referral link would silently create a rival claim on the same
  // trader's commission.
  await query(`
    CREATE TABLE IF NOT EXISTS ib_clients (
      id VARCHAR(36) PRIMARY KEY,
      ib_id VARCHAR(36) NOT NULL,
      client_user_id VARCHAR(36) NOT NULL UNIQUE,
      referred_code VARCHAR(50),
      status VARCHAR(20) DEFAULT 'referred',
      lifetime_volume DECIMAL(20,2) DEFAULT 0,
      lifetime_commission DECIMAL(18,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uniq_ib_client UNIQUE (ib_id, client_user_id)
    )
  `);
  await query(`ALTER TABLE ib_clients ADD COLUMN IF NOT EXISTS referred_code VARCHAR(50)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ib_clients_ib ON ib_clients (ib_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ib_clients_user ON ib_clients (client_user_id)`);

  // The commission ledger: the source of truth for money.
  //
  // trade_id is UNIQUE so a retry after a mid-flight crash cannot pay the same
  // closed trade twice; accrual relies on ON CONFLICT DO NOTHING for that.
  await query(`
    CREATE TABLE IF NOT EXISTS ib_commissions (
      id VARCHAR(36) PRIMARY KEY,
      ib_id VARCHAR(36) NOT NULL,
      client_id VARCHAR(36),
      client_user_id VARCHAR(36),
      trade_id BIGINT UNIQUE,
      symbol VARCHAR(50),
      volume DECIMAL(18,4),
      notional DECIMAL(20,2),
      rate DECIMAL(9,4),
      model VARCHAR(20),
      amount DECIMAL(18,2) NOT NULL,
      type VARCHAR(50) DEFAULT 'trade',
      status VARCHAR(20) DEFAULT 'pending',
      matures_at TIMESTAMP,
      paid_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ib_commissions_ib ON ib_commissions (ib_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ib_commissions_status ON ib_commissions (status)`);

  schemaReady = true;
}

export interface IBSettings {
  min_deposit: number;
  commission_delay_days: number;
  auto_approve: boolean;
  ib_registration_open: boolean;
  commission_model: CommissionModel;
  referral_base_url: string | null;
}

export async function getIBSettings(conn: Executor | null = null): Promise<IBSettings> {
  const rows = await run(conn, `SELECT * FROM ib_settings WHERE id = 1`);
  const row: any = rows[0] || {};
  const model = row.commission_model === "percent_notional" ? "percent_notional" : DEFAULT_COMMISSION_MODEL;
  return {
    min_deposit: Number(row.min_deposit || 0),
    commission_delay_days: Number(row.commission_delay_days || 0),
    auto_approve: Boolean(row.auto_approve),
    ib_registration_open: row.ib_registration_open !== false,
    commission_model: model,
    referral_base_url: row.referral_base_url || null,
  };
}

/**
 * The commission rate for a partner.
 *
 * An explicitly assigned level wins. Otherwise the partner earns the best level
 * their referral count qualifies for, which is what `ib_levels.min_referrals`
 * is for. A partner matching no level earns nothing rather than defaulting to
 * some arbitrary rate.
 */
export async function resolveCommissionRate(
  partner: { level_id?: string | null; referrals?: number | null },
  conn: Executor | null = null
): Promise<number> {
  if (partner.level_id) {
    const rows = await run(conn, `SELECT commission_rate FROM ib_levels WHERE id = $1`, [partner.level_id]);
    if (rows.length > 0) return Number(rows[0].commission_rate) || 0;
  }
  const referrals = Number(partner.referrals || 0);
  const rows = await run(
    conn,
    `SELECT commission_rate FROM ib_levels
      WHERE min_referrals <= $1
      ORDER BY commission_rate DESC
      LIMIT 1`,
    [referrals]
  );
  return rows.length > 0 ? Number(rows[0].commission_rate) || 0 : 0;
}

/** Normalises a referral code as typed by a user (trimmed, upper-cased). */
export function normalizeReferralCode(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

/**
 * Attaches a newly registered user to the IB whose code they signed up with.
 *
 * Returns the partner id when attribution succeeded. An unknown or inactive
 * code is not an error: the signup proceeds unattributed, because a bad
 * referral code must never block someone from registering.
 *
 * Self-referral is rejected so a partner cannot farm their own commission.
 */
export async function attachReferral(
  userId: string,
  rawCode: unknown,
  conn: Executor | null = null
): Promise<string | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;

  const partners = await run(
    conn,
    `SELECT id, user_id FROM ib_partners WHERE UPPER(ib_code) = $1 AND status = 'active' LIMIT 1`,
    [code]
  );
  if (partners.length === 0) return null;

  const partner: any = partners[0];
  if (String(partner.user_id) === String(userId)) return null;

  // ON CONFLICT keeps re-registration of an unverified email idempotent, and
  // means the first partner to refer a trader keeps them: a later link cannot
  // reassign an existing client.
  await run(
    conn,
    `INSERT INTO ib_clients (id, ib_id, client_user_id, referred_code, status)
     VALUES ($1, $2, $3, $4, 'referred')
     ON CONFLICT (client_user_id) DO NOTHING`,
    [uuidv4(), partner.id, userId, code]
  );

  await syncPartnerCounters(partner.id, conn);
  return partner.id;
}

/**
 * Recomputes a partner's cached counters from the ledger and client table.
 *
 * Commission is "pending" until it matures (see `commission_delay_days`) and
 * "earned" once it has, which is what the admin dashboard reports.
 */
export async function syncPartnerCounters(ibId: string, conn: Executor | null = null): Promise<void> {
  await run(
    conn,
    `UPDATE ib_partners p SET
       referrals = COALESCE((SELECT COUNT(*) FROM ib_clients c WHERE c.ib_id = p.id), 0),
       commission_earned = COALESCE((
         SELECT SUM(amount) FROM ib_commissions m
          WHERE m.ib_id = p.id AND m.status IN ('matured', 'paid')
       ), 0),
       commission_pending = COALESCE((
         SELECT SUM(amount) FROM ib_commissions m
          WHERE m.ib_id = p.id AND m.status = 'pending'
       ), 0)
     WHERE p.id = $1`,
    [ibId]
  );
}

/**
 * Flips pending commissions to matured once their delay has elapsed, then
 * refreshes the affected partners' counters.
 *
 * Called on read from the admin and partner dashboards, so no background worker
 * is required - which matters because trade workers are disabled outside
 * production (see lib/env.ts).
 */
export async function matureCommissions(conn: Executor | null = null): Promise<number> {
  const rows = await run(
    conn,
    `UPDATE ib_commissions
        SET status = 'matured'
      WHERE status = 'pending'
        AND matures_at IS NOT NULL
        AND matures_at <= NOW()
      RETURNING ib_id`
  );
  const ibIds = Array.from(new Set(rows.map((r: any) => String(r.ib_id))));
  for (const ibId of ibIds) await syncPartnerCounters(ibId, conn);
  return rows.length;
}

export interface AccrualInput {
  tradeId: number;
  userId: string;
  symbol: string;
  volume: number;
  notional: number;
}

/**
 * Records IB commission for one closed trade.
 *
 * Deliberately called AFTER the trade-closing transaction commits: settling a
 * client's trade must never fail or roll back because of IB bookkeeping. The
 * UNIQUE constraint on `trade_id` makes the insert idempotent, so a retry after
 * a crash cannot pay twice.
 *
 * Returns the amount accrued (0 when the trader was not referred, the partner
 * is inactive, or the resolved rate is 0).
 */
export async function accrueTradeCommission(input: AccrualInput): Promise<number> {
  const { tradeId, userId, symbol, volume, notional } = input;

  await ensureIBTables();

  const links = await run(
    null,
    `SELECT c.id AS client_id, c.ib_id, p.level_id, p.referrals, p.status
       FROM ib_clients c
       JOIN ib_partners p ON p.id = c.ib_id
      WHERE c.client_user_id = $1
      LIMIT 1`,
    [userId]
  );
  if (links.length === 0) return 0;

  const link: any = links[0];
  if (String(link.status) !== "active") return 0;

  const settings = await getIBSettings();
  const rate = await resolveCommissionRate({ level_id: link.level_id, referrals: link.referrals });
  if (!(rate > 0)) return 0;

  const lots = Number(volume) || 0;
  const notionalValue = Number(notional) || 0;
  const amount =
    settings.commission_model === "percent_notional"
      ? (notionalValue * rate) / 100
      : lots * rate;

  const rounded = Math.round(amount * 100) / 100;
  if (!(rounded > 0)) return 0;

  const delayDays = Math.max(0, Number(settings.commission_delay_days) || 0);

  const inserted = await run(
    null,
    `INSERT INTO ib_commissions
       (id, ib_id, client_id, client_user_id, trade_id, symbol, volume, notional, rate, model, amount, type, status, matures_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'trade', $12, NOW() + ($13 || ' days')::interval)
     ON CONFLICT (trade_id) DO NOTHING
     RETURNING id`,
    [
      uuidv4(),
      link.ib_id,
      link.client_id,
      userId,
      tradeId,
      symbol,
      lots,
      notionalValue,
      rate,
      settings.commission_model,
      rounded,
      delayDays > 0 ? "pending" : "matured",
      String(delayDays),
    ]
  );

  // Already accrued for this trade - nothing further to do.
  if (inserted.length === 0) return 0;

  await run(
    null,
    `UPDATE ib_clients
        SET lifetime_volume = lifetime_volume + $1,
            lifetime_commission = lifetime_commission + $2,
            status = 'active'
      WHERE id = $3`,
    [lots, rounded, link.client_id]
  );

  await syncPartnerCounters(link.ib_id);
  return rounded;
}

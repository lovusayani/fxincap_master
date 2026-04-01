import pkg from 'pg';
const { Pool } = pkg;
import { DB, FINNHUB_API_KEY } from './config.js';

let pool;
const PROVIDER_ORDER = ['finnhub', 'twelvedata', 'binance'];

function providerOrderSql(column = 'provider') {
  return `CASE ${column}
    WHEN 'finnhub' THEN 0
    WHEN 'twelvedata' THEN 1
    WHEN 'binance' THEN 2
    ELSE 99
  END`;
}

export function getPool() {
  if (!pool) {
    try {
      pool = new Pool({
        host: DB.host,
        port: DB.port,
        user: DB.user,
        password: DB.password,
        database: DB.database,
        ssl: DB.ssl ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      pool.on('error', (err) => {
        console.warn('[fxincap-ws] PG pool error:', err.message);
      });
    } catch (e) {
      console.warn('[fxincap-ws] PG pool init failed:', e.message);
      pool = null;
    }
  }
  return pool;
}

export async function initSettingsTable() {
  const p = getPool();
  if (!p) {
    console.warn('[fxincap-ws] Skipping DB table init (no pool)');
    return;
  }
  try {
    // Create multi-provider API keys table (PostgreSQL)
    await p.query(`
      CREATE TABLE IF NOT EXISTS ws_api_keys (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL UNIQUE,
        api_key TEXT,
        enabled BOOLEAN DEFAULT FALSE,
        endpoint VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await p.query(`CREATE INDEX IF NOT EXISTS idx_ws_provider ON ws_api_keys (provider)`);
    await p.query(`CREATE INDEX IF NOT EXISTS idx_ws_enabled ON ws_api_keys (enabled)`);

    // Seed default providers
    const providers = [
      { provider: 'finnhub',    endpoint: 'wss://ws.finnhub.io',                    notes: 'Finnhub WebSocket for stocks',          api_key: FINNHUB_API_KEY || '', enabled: true },
      { provider: 'twelvedata', endpoint: 'wss://ws.twelvedata.com/v1/quotes/price', notes: 'TwelveData WebSocket for forex/metals', api_key: '',                   enabled: false },
      { provider: 'binance',    endpoint: 'wss://stream.binance.com:9443/ws',        notes: 'Binance WebSocket for crypto',          api_key: '',                   enabled: false },
    ];

    for (const prov of providers) {
      try {
        await p.query(
          `INSERT INTO ws_api_keys (provider, api_key, endpoint, notes, enabled)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (provider) DO NOTHING`,
          [prov.provider, prov.api_key, prov.endpoint, prov.notes, prov.enabled]
        );
      } catch (e) {
        console.warn(`[fxincap-ws] Failed to seed provider ${prov.provider}:`, e.message);
      }
    }

    try {
      const cnt = await p.query('SELECT COUNT(*)::int AS c FROM ws_api_keys');
      const n = cnt.rows?.[0]?.c ?? 0;
      if (n === 0) {
        console.error(
          '[fxincap-ws] ws_api_keys has zero rows after seed. Run fxincapws/sql/seed_ws_api_keys.sql against the same DB as fxincapapi, or fix PG* credentials.'
        );
      }
    } catch (e) {
      console.warn('[fxincap-ws] post-seed row count check failed:', e.message);
    }

    try {
      const enabledProviders = await p.query(`
        SELECT provider
        FROM ws_api_keys
        WHERE enabled = TRUE
        ORDER BY updated_at DESC, ${providerOrderSql('provider')}
      `);

      if ((enabledProviders.rows || []).length > 1) {
        const primary = enabledProviders.rows[0]?.provider;
        await p.query('UPDATE ws_api_keys SET enabled = FALSE, updated_at = NOW() WHERE provider <> $1', [primary]);
        await p.query('UPDATE ws_api_keys SET enabled = TRUE, updated_at = NOW() WHERE provider = $1', [primary]);
        console.log(`[fxincap-ws] Normalized enabled providers; primary=${primary}`);
      }
    } catch (e) {
      console.warn('[fxincap-ws] Failed to normalize enabled providers:', e.message);
    }

    console.log('[fxincap-ws] DB table ws_api_keys ready.');
  } catch (e) {
    console.warn('[fxincap-ws] initSettingsTable failed, continuing without DB table sync:', e.message);
  }
}

/**
 * Get all API providers with their keys and enabled status
 * Throws if the DB pool is missing or the query fails (so /admin/providers can return 503/500 instead of a misleading empty list).
 */
export async function getAllProviders() {
  const p = getPool();
  if (!p) throw new Error('PostgreSQL pool unavailable — set PGHOST, PGUSER, PGPASSWORD, PGDATABASE (same as fxincapapi)');
  const result = await p.query(`
      SELECT id, provider, api_key, enabled, endpoint, notes, updated_at
      FROM ws_api_keys
      ORDER BY ${providerOrderSql('provider')}, provider
    `);
  return result.rows || [];
}

/**
 * Get single provider by name
 */
export async function getProviderByName(provider) {
  try {
    const p = getPool();
    if (!p) throw new Error('no-pool');
    const result = await p.query('SELECT * FROM ws_api_keys WHERE provider = $1 LIMIT 1', [provider]);
    return result.rows.length ? result.rows[0] : null;
  } catch (e) {
    console.warn('[fxincap-ws] getProviderByName failed:', e.message);
    return null;
  }
}

/**
 * Get the first enabled provider, or fallback to finnhub
 */
export async function getActiveProvider() {
  try {
    const p = getPool();
    if (!p) throw new Error('no-pool');
    const result = await p.query(`
      SELECT *
      FROM ws_api_keys
      WHERE enabled = TRUE
      ORDER BY updated_at DESC, ${providerOrderSql('provider')}
      LIMIT 1
    `);
    if (result.rows.length) return result.rows[0];
    // Fallback: try finnhub row
    const fallback = await p.query('SELECT * FROM ws_api_keys WHERE provider = $1 LIMIT 1', ['finnhub']);
    return fallback.rows.length ? fallback.rows[0] : { provider: 'finnhub', api_key: FINNHUB_API_KEY || '' };
  } catch (e) {
    console.warn('[fxincap-ws] getActiveProvider fallback:', e.message);
    return { provider: 'finnhub', api_key: FINNHUB_API_KEY || '' };
  }
}

export async function getProviderFailoverChain(preferredProvider = null) {
  try {
    const p = getPool();
    if (!p) throw new Error('no-pool');

    const params = [];
    const preferredOrderSql = preferredProvider
      ? `(CASE WHEN provider = $1 THEN 0 ELSE 1 END), `
      : '';

    if (preferredProvider) params.push(preferredProvider);

    const result = await p.query(
      `SELECT *
       FROM ws_api_keys
       WHERE enabled = TRUE OR COALESCE(api_key, '') <> ''
       ORDER BY ${preferredOrderSql}${providerOrderSql('provider')}, updated_at DESC`,
      params
    );

    if (result.rows.length) return result.rows;
    return [{ provider: 'finnhub', api_key: FINNHUB_API_KEY || '', enabled: true }];
  } catch (e) {
    console.warn('[fxincap-ws] getProviderFailoverChain fallback:', e.message);
    return [{ provider: 'finnhub', api_key: FINNHUB_API_KEY || '', enabled: true }];
  }
}

/**
 * Update provider API key and enable status
 */
export async function updateProvider({ provider, api_key, enabled }) {
  try {
    const p = getPool();
    if (!p) throw new Error('no-pool');
    await p.query('BEGIN');
    if (enabled === true) {
      await p.query('UPDATE ws_api_keys SET enabled = FALSE, updated_at = NOW() WHERE provider <> $1', [provider]);
    }
    const result = await p.query(
      'UPDATE ws_api_keys SET api_key = $1, enabled = $2, updated_at = NOW() WHERE provider = $3',
      [api_key || '', enabled === true, provider]
    );
    await p.query('COMMIT');
    console.log(`[fxincap-ws] updateProvider ${provider}:`, result.rowCount, 'rows updated');
    return true;
  } catch (e) {
    try {
      await getPool()?.query('ROLLBACK');
    } catch {}
    console.error('[fxincap-ws] updateProvider failed:', e.message);
    return false;
  }
}

export async function getSettings() {
  // Legacy: return first enabled provider
  const active = await getActiveProvider();
  return { provider: active.provider, api_key: active.api_key };
}

export async function updateSettings({ provider, api_key }) {
  // Legacy: update provider and enable it
  return updateProvider({ provider, api_key, enabled: true });
}

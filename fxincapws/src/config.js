import dotenv from 'dotenv';
dotenv.config();

/**
 * Configuration with fail-fast validation.
 *
 * This file previously carried a real managed-PostgreSQL hostname, port, user
 * and database name as `||` fallbacks, and an ADMIN_TOKEN default of
 * 'changeme-admin-token'. A process started without a .env therefore dialled
 * production with a well-known admin credential. Both are now required.
 *
 * See docs/SECURITY.md §3 and §4, and docs/ENVIRONMENT.md §5.
 */

const missing = [];

function required(name, hint, aliases = []) {
  for (const key of [name, ...aliases]) {
    const raw = process.env[key];
    const value = raw == null ? '' : String(raw).trim();
    if (value) return value;
  }
  const names = aliases.length ? `${name} (or ${aliases.join(', ')})` : name;
  missing.push(`  - ${names}: ${hint}`);
  return '';
}

function optional(name, fallback, aliases = []) {
  for (const key of [name, ...aliases]) {
    const raw = process.env[key];
    const value = raw == null ? '' : String(raw).trim();
    if (value) return value;
  }
  return fallback;
}

export const PORT = parseInt(optional('WS_PORT', '4040'), 10);

/** Trimmed so .env values with trailing spaces do not break admin UI auth. */
export const ADMIN_TOKEN = required(
  'ADMIN_TOKEN',
  'admin API token; must equal WS_ADMIN_TOKEN on the admin server. Generate with: openssl rand -hex 32'
);

export const FINNHUB_API_KEY = optional('FINNHUB_API_KEY', '');
export const FINNHUB_WEBHOOK_SECRET = optional('FINNHUB_WEBHOOK_SECRET', '');

// Prefer PG* (same as fxincapapi); DB_* accepted because several deployments
// only set those. No production coordinate is defaulted here.
const pgHost = required('PGHOST', 'PostgreSQL host (same database as fxincapapi)', ['DB_HOST']);
const pgUser = required('PGUSER', 'PostgreSQL user', ['DB_USER']);
const pgPassword = required('PGPASSWORD', 'PostgreSQL password', ['DB_PASSWORD', 'DB_PASS']);
const pgDatabase = required('PGDATABASE', 'PostgreSQL database name', ['DB_NAME']);
const pgPort = optional('PGPORT', '25060', ['DB_PORT']);
const pgSslMode = optional('PGSSLMODE', 'require', ['DB_SSLMODE']);

if (missing.length > 0) {
  console.error(
    `\nFATAL: fxincap-ws cannot start — ${missing.length} required environment variable(s) missing:\n\n` +
      missing.join('\n') +
      `\n\nSet them in fxincapws/.env (see docs/ENVIRONMENT.md §5).\n` +
      `These previously had insecure defaults in source — a hard-coded production\n` +
      `database host and a shared 'changeme' admin token — and are now mandatory.\n`
  );
  process.exit(1);
}

export const DB = {
  host: pgHost,
  port: parseInt(pgPort, 10),
  user: pgUser,
  password: pgPassword,
  database: pgDatabase,
  ssl: pgSslMode.toLowerCase() !== 'disable',
};

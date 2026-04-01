import dotenv from 'dotenv';
dotenv.config();

export const PORT = parseInt(process.env.WS_PORT || '4040', 10);
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-admin-token';
export const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
export const FINNHUB_WEBHOOK_SECRET = process.env.FINNHUB_WEBHOOK_SECRET || '';

// Prefer PG* (same as fxincapapi). Fall back to DB_* — many deployments only set DB_HOST/DB_USER/DB_PASSWORD in fxincapws/.env.
const pgHost =
  process.env.PGHOST ||
  process.env.DB_HOST ||
  'kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com';
const pgPort = process.env.PGPORT || process.env.DB_PORT || '25060';
const pgUser = process.env.PGUSER || process.env.DB_USER || 'amitkaka';
const pgPassword = process.env.PGPASSWORD || process.env.DB_PASSWORD || '';
const pgDatabase = process.env.PGDATABASE || process.env.DB_NAME || 'fxincapmain';
const pgSslMode = process.env.PGSSLMODE || process.env.DB_SSLMODE || 'require';

export const DB = {
  host: pgHost,
  port: parseInt(pgPort, 10),
  user: pgUser,
  password: pgPassword,
  database: pgDatabase,
  ssl: pgSslMode.toLowerCase() !== 'disable',
};

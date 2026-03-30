import dotenv from 'dotenv';
dotenv.config();

export const PORT = parseInt(process.env.WS_PORT || '4040', 10);
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-admin-token';
export const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
export const FINNHUB_WEBHOOK_SECRET = process.env.FINNHUB_WEBHOOK_SECRET || '';

// Match fxincapapi discrete Pool settings: PG* only for host (ignore legacy DB_HOST if PGHOST unset).
// A stale DB_HOST (dead DNS) must not win over the bundled default — that left ws_api_keys empty.
// Same discrete fields as fxincapapi/src/lib/database.ts (do not chain DB_USER/DB_PASSWORD — .env often has stale placeholders).
export const DB = {
  host: process.env.PGHOST || 'kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com',
  port: parseInt(process.env.PGPORT || '25060', 10),
  user: process.env.PGUSER || 'amitkaka',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'fxincapmain',
  ssl: (process.env.PGSSLMODE || 'require').toLowerCase() !== 'disable',
};

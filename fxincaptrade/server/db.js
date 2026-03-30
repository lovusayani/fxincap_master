// PostgreSQL connection using 'pg' for fxincaptrade
const { Pool } = require('pg');
const fs = require('fs');

function shouldUseSsl() {
  const mode = (process.env.PGSSLMODE || 'require').toLowerCase();
  return mode !== 'disable';
}

function getSslConfig() {
  if (!shouldUseSsl()) {
    return false;
  }

  const certPath = process.env.PGSSL_CA || process.env.SSL_CERT_PATH || 'ca-certificate.crt';
  const rejectUnauthorized = (process.env.PGSSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';

  if (fs.existsSync(certPath)) {
    return {
      rejectUnauthorized,
      ca: fs.readFileSync(certPath).toString(),
    };
  }

  return {
    rejectUnauthorized,
  };
}

const pool = new Pool({
  host: process.env.PGHOST || 'kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com',
  port: parseInt(process.env.PGPORT || '25060', 10),
  database: process.env.PGDATABASE || 'fxincapmain',
  user: process.env.PGUSER || 'amitkaka',
  password: process.env.PGPASSWORD || '',
  ssl: getSslConfig(),
});

module.exports = pool;

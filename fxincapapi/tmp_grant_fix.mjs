import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
  host: process.env.PGHOST || 'kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com',
  port: Number(process.env.PGPORT || 25060),
  user: process.env.PGUSER || 'amitkaka',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'fxincapmain',
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('F:/app/fxfx/ca-certificate.crt').toString(),
  },
});

try {
  await pool.query("GRANT USAGE ON SCHEMA public TO amitkaka");
  await pool.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO amitkaka");
  await pool.query("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO amitkaka");
  console.log('GRANT commands executed successfully');
} catch (error) {
  console.error('GRANT failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

const { Pool } = require('pg');
const fs = require('fs');

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

(async () => {
  const role = await pool.query(
    "select current_user as user, r.rolsuper, r.rolcreaterole, r.rolcreatedb from pg_roles r where r.rolname=current_user"
  );
  console.log('ROLE', role.rows[0]);

  const grants = await pool.query(
    "select has_table_privilege(current_user,'public.users','select') as users_select, has_table_privilege(current_user,'public.users','insert') as users_insert, has_table_privilege(current_user,'public.users','update') as users_update"
  );
  console.log('USERS_TABLE_PRIVS', grants.rows[0]);

  await pool.end();
})().catch(async (e) => {
  console.error(e.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});

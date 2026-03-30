const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  host: 'kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com',
  port: 25060,
  user: 'amitkaka',
  password: process.env.PGPASSWORD || '',
  database: 'fxincapmain',
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('F:/app/fxfx/ca-certificate.crt').toString(),
  },
});

(async () => {
  const sql = "select has_table_privilege(current_user, 'public.users', 'select') as can_select, has_table_privilege(current_user, 'public.users', 'insert') as can_insert, has_table_privilege(current_user, 'public.users', 'update') as can_update";
  const result = await pool.query(sql);
  console.log(result.rows[0]);
  await pool.end();
})().catch(async (err) => {
  console.error(err.message);
  try { await pool.end(); } catch {}
  process.exit(1);
});

const mysql = require("mysql2/promise");

async function checkBalance() {
  const pool = mysql.createPool({
    host: "forex-final-db-do-user-23389554-0.m.db.ondigitalocean.com",
    port: 25060,
    user: "suimfx1",
    password: process.env.DB_PASS || "",
    database: "suim_fx",
    ssl: { rejectUnauthorized: false },
  });

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      "SELECT id, user_id, balance, equity, margin_used, margin_free, currency FROM user_accounts WHERE user_id = ?",
      ["bcb62b7d-bdaf-4ec7-92ed-ae0ad7d5d93c"]
    );
    console.log("User Account Data:");
    console.log(JSON.stringify(rows, null, 2));
    conn.release();
  } catch (err) {
    console.error("Error:", err.message);
  }
  await pool.end();
}

checkBalance();

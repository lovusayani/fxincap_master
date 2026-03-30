
import { Pool } from "pg";
import fs from "fs";

function shouldUseSsl(): boolean {
  const mode = (process.env.PGSSLMODE || "require").toLowerCase();
  return mode !== "disable";
}

function getSslConfig() {
  if (!shouldUseSsl()) {
    return false;
  }

  const certPath = process.env.PGSSL_CA || process.env.SSL_CERT_PATH || "ca-certificate.crt";
  const rejectUnauthorized = (process.env.PGSSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false";

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

// PostgreSQL Database Configuration
const dbConfig = {
  host: process.env.PGHOST || "kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com",
  port: parseInt(process.env.PGPORT || "25060"),
  user: process.env.PGUSER || "amitkaka",
  password: process.env.PGPASSWORD || "",
  database: process.env.PGDATABASE || "fxincapmain",
  ssl: getSslConfig(),
};

export const pool = new Pool(dbConfig);

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log(`✅ PostgreSQL Database connected successfully to ${dbConfig.database}`);
    console.log("   Host:", dbConfig.host);
    console.log("   Port:", dbConfig.port);
    client.release();
    return true;
  } catch (error: any) {
    console.warn("⚠️  PostgreSQL connection failed:", error.message);
    return false;
  }
}

// Execute query with error handling
export async function executeQuery(query: string, params: any[] = []) {
  try {
    const result = await pool.query(query, params);
    return { success: true, data: result.rows };
  } catch (error) {
    console.error("Database query error:", error);
    return { success: false, error: error };
  }
}

// Get user by email
export async function getUserByEmail(email: string) {
  const query = `
    SELECT u.*, au.role as admin_role, au.permissions 
    FROM users u 
    LEFT JOIN admin_users au ON u.id = au.user_id 
    WHERE u.email = $1 AND u.is_active = TRUE
  `;
  const result = await executeQuery(query, [email]);
  return result.success ? result.data[0] : null;
}

// Get user by ID
export async function getUserById(id: string) {
  const query = `
    SELECT u.*, au.role as admin_role, au.permissions 
    FROM users u 
    LEFT JOIN admin_users au ON u.id = au.user_id 
    WHERE u.id = $1 AND u.is_active = TRUE
  `;
  const result = await executeQuery(query, [id]);
  return result.success ? result.data[0] : null;
}

// Create new user
export async function createUser(userData: {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType?: "admin" | "user";
  ibReferralCode?: string | null;
}) {
  const query = `
    INSERT INTO users (id, email, password, first_name, last_name, user_type, ib_referral_code) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const result = await executeQuery(query, [
    userData.id,
    userData.email,
    userData.password,
    userData.firstName,
    userData.lastName,
    userData.userType || "user",
    userData.ibReferralCode || null,
  ]);

  if (result.success && userData.userType === "admin") {
    const adminQuery = `
      INSERT INTO admin_users (user_id, role, permissions) 
      VALUES (?, 'admin', ?)
    `;
    await executeQuery(adminQuery, [userData.id, JSON.stringify({ users: true, trading: true })]);
  }

  return result;
}

// Get user's trading account
export async function getUserTradingAccount(userId: string) {
  const query = `
    SELECT * FROM trading_accounts 
    WHERE user_id = ? AND is_active = TRUE 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  const result = await executeQuery(query, [userId]);
  return result.success ? result.data[0] : null;
}

// Get user positions
export async function getUserPositions(userId: string) {
  const query = `
    SELECT p.*, ta.account_number 
    FROM positions p 
    JOIN trading_accounts ta ON p.account_id = ta.id 
    WHERE p.user_id = ? AND p.status = 'OPEN' 
    ORDER BY p.open_time DESC
  `;
  const result = await executeQuery(query, [userId]);
  return result.success ? result.data : [];
}

// Update user last login
export async function updateUserLastLogin(userId: string) {
  const query = `UPDATE users SET last_login = NOW() WHERE id = ?`;
  return await executeQuery(query, [userId]);
}

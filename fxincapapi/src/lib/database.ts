import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const envPath of [path.join(process.cwd(), ".env"), path.resolve(__dirname, "../../.env")]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

function shouldUseSsl(): boolean {
  const mode = (process.env.PGSSLMODE || "require").toLowerCase();
  return mode !== "disable";
}

function getSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!shouldUseSsl()) {
    return false;
  }

  const defaultCa = path.join(process.cwd(), "ca-certificate.crt");
  const certPath = process.env.PGSSL_CA || process.env.SSL_CERT_PATH || defaultCa;
  const hasCa = fs.existsSync(certPath);
  // Without DO/managed-Postgres CA file, strict verification fails ("self-signed certificate in chain").
  // Set PGSSL_REJECT_UNAUTHORIZED=true only when PGSSL_CA points to a real CA bundle.
  const rejectUnauthorized =
    (process.env.PGSSL_REJECT_UNAUTHORIZED || (hasCa ? "true" : "false")).toLowerCase() === "true";

  if (hasCa) {
    return {
      rejectUnauthorized,
      ca: fs.readFileSync(certPath).toString(),
    };
  }

  return { rejectUnauthorized };
}

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: getSslConfig(),
    })
  : new Pool({
      host: process.env.PGHOST || "kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com",
      port: parseInt(process.env.PGPORT || "25060"),
      user: process.env.PGUSER || "amitkaka",
      password: process.env.PGPASSWORD || "",
      database: process.env.PGDATABASE || "fxincapmain",
      ssl: getSslConfig(),
    });


export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✅ PostgreSQL database connection successful");
    return true;
  } catch (error) {
    console.error("❌ PostgreSQL database connection failed:", error);
    return false;
  }
}


export async function query(sql: string, values?: any[]) {
  const client = await pool.connect();
  try {
    const hasPostgresParams = /\$\d+/.test(sql);
    const usesQuestionMarkParams = sql.includes("?");

    // Temporary compatibility layer to run legacy MySQL-style SQL on PostgreSQL.
    const normalizedSql = !hasPostgresParams && usesQuestionMarkParams
      ? sql.replace(/\?/g, (_match, offset) => {
          const prefix = sql.slice(0, offset);
          const count = (prefix.match(/\?/g) || []).length + 1;
          return `$${count}`;
        })
      : sql;

    const result = await client.query(normalizedSql, values);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getConnection() {
  return await pool.connect();
}

export default pool;

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { parse as parseConnectionString } from "pg-connection-string";
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

/**
 * `pg` parses sslmode / sslrootcert from DATABASE_URL and can enforce verification even when the
 * Pool `ssl` option says rejectUnauthorized: false. Strip the query string unless strict TLS is on.
 */
function normalizeConnectionString(url: string | undefined): string | undefined {
  if (!url) return url;
  if ((process.env.PGSSL_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true") {
    return url;
  }
  const q = url.indexOf("?");
  if (q === -1) return url;
  return url.slice(0, q);
}

/**
 * Discrete Pool config from DATABASE_URL. Do not pass `connectionString` into `pg` with `ssl`:
 * ConnectionParameters merges parsed URL last and can overwrite `ssl` (e.g. verify-full from sslmode).
 */
function poolConfigFromDatabaseUrl(url: string): Record<string, unknown> {
  const base = normalizeConnectionString(url) || url;
  const parsed = parseConnectionString(base) as Record<string, unknown>;
  // pg-connection-string sets ssl / sslmode from the URL; leaving them overrides our ssl object.
  delete parsed.ssl;
  delete parsed.sslmode;
  delete parsed.sslrootcert;
  delete parsed.sslcert;
  delete parsed.sslkey;
  delete parsed.connectionString;
  return {
    ...parsed,
    ssl: getSslConfig(),
  };
}

function getSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!shouldUseSsl()) {
    return false;
  }

  // Strict verification only when explicitly requested (and optional CA file).
  // Default: encrypted connection without verifying the chain — fixes local Windows "self-signed
  // certificate in certificate chain" against DigitalOcean/managed Postgres. Do not attach `ca`
  // in permissive mode; pairing ca + rejectUnauthorized:false still errors in some Node/pg builds.
  const rejectUnauthorized =
    (process.env.PGSSL_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true";

  if (!rejectUnauthorized) {
    return { rejectUnauthorized: false };
  }

  const defaultCa = path.join(process.cwd(), "ca-certificate.crt");
  const certPath = process.env.PGSSL_CA || process.env.SSL_CERT_PATH || defaultCa;
  const hasCa = fs.existsSync(certPath);
  if (hasCa) {
    return {
      rejectUnauthorized: true,
      ca: fs.readFileSync(certPath).toString(),
    };
  }

  return { rejectUnauthorized: true };
}

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString
  ? poolConfigFromDatabaseUrl(connectionString)
  : {
      host: process.env.PGHOST || "kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com",
      port: parseInt(process.env.PGPORT || "25060"),
      user: process.env.PGUSER || "amitkaka",
      password: process.env.PGPASSWORD || "",
      database: process.env.PGDATABASE || "fxincapmain",
      ssl: getSslConfig(),
    };

const pool = new Pool(poolConfig as ConstructorParameters<typeof Pool>[0]);


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

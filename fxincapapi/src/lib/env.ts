/**
 * Centralised environment access with fail-fast validation.
 *
 * Security requirement: this application must never fall back to a hard-coded
 * secret or to production infrastructure coordinates. A missing variable is a
 * configuration error and must stop the process at boot rather than silently
 * downgrade to an insecure or wrong-target default.
 *
 * See docs/ENVIRONMENT.md and docs/SECURITY.md.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load .env before reading anything. Mirrors the resolution order used by
// lib/database.ts so both agree on which file is authoritative. This module is
// evaluated before database.ts in the import graph, so the Pool is never built
// from an unvalidated configuration.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const envPath of [path.join(process.cwd(), ".env"), path.resolve(__dirname, "../../.env")]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const missing: string[] = [];

function record(name: string, hint: string): void {
  missing.push(`  - ${name}: ${hint}`);
}

/** Required string. Records a startup error instead of returning a default. */
function required(name: string, hint: string): string {
  const raw = process.env[name];
  const value = raw == null ? "" : String(raw).trim();
  if (!value) {
    record(name, hint);
    return "";
  }
  return value;
}

/** Optional string with an explicitly safe (non-secret, non-production) default. */
function optional(name: string, fallback: string): string {
  const raw = process.env[name];
  const value = raw == null ? "" : String(raw).trim();
  return value || fallback;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Secrets that previously had insecure literal fallbacks in source
 * (`"secret"`, `'your-super-secret-jwt-key-change-in-production'`).
 */
export const JWT_SECRET = required(
  "JWT_SECRET",
  "signing key for user and admin JWTs. Generate with: openssl rand -hex 32"
);

/**
 * Shared secret for internal service-to-service calls (price/SL-TP maintenance
 * endpoints). Required because those endpoints mutate trade state.
 */
export const INTERNAL_SERVICE_TOKEN = required(
  "INTERNAL_SERVICE_TOKEN",
  "shared secret for internal maintenance endpoints. Generate with: openssl rand -hex 32"
);

/** Database: no production host/user/database may be defaulted in source. */
export const DATABASE_URL = process.env.DATABASE_URL?.trim() || "";
export const PGHOST = DATABASE_URL ? "" : required("PGHOST", "PostgreSQL host (or set DATABASE_URL)");
export const PGUSER = DATABASE_URL ? "" : required("PGUSER", "PostgreSQL user (or set DATABASE_URL)");
export const PGDATABASE = DATABASE_URL
  ? ""
  : required("PGDATABASE", "PostgreSQL database name (or set DATABASE_URL)");
export const PGPASSWORD = DATABASE_URL ? "" : required("PGPASSWORD", "PostgreSQL password (or set DATABASE_URL)");
export const PGPORT = optionalNumber("PGPORT", 25060);

/** Market data: fxincapws base URL used for authoritative server-side prices. */
export const WS_QUOTE_BASE_URL = optional("WS_QUOTE_BASE_URL", "http://127.0.0.1:4040").replace(/\/$/, "");

/**
 * Trade workers (auto-close, price sync, SL/TP) mutate live financial state:
 * they close positions and rewrite balances and equity. A developer machine
 * pointed at the production database would run them alongside the real server,
 * double-processing the same rows on real customer accounts.
 *
 * They are therefore OFF by default outside production. Set
 * ENABLE_TRADE_WORKERS=true to force them on (production pm2 sets
 * NODE_ENV=production, so nothing changes there).
 *
 * Do not rely on large *_POLL_MS values to disable them: those live in .env,
 * which is untracked, and regenerating it from .env.example silently restores
 * 4s/15s/5s polling. See docs/SECURITY.md and docs/PNL_ENGINE.md.
 */
export const TRADE_WORKERS_ENABLED = (() => {
  const override = optional("ENABLE_TRADE_WORKERS", "").toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  return process.env.NODE_ENV === "production";
})();

/** Worker intervals. */
export const SL_TP_POLL_MS = optionalNumber("SL_TP_POLL_MS", 4000);
export const TRADE_AUTO_CLOSE_POLL_MS = optionalNumber("TRADE_AUTO_CLOSE_POLL_MS", 15000);
export const PRICE_SYNC_POLL_MS = optionalNumber("PRICE_SYNC_POLL_MS", 5000);

/** Max age (ms) of a server-side quote before it is considered unusable for settlement. */
export const PRICE_MAX_AGE_MS = optionalNumber("PRICE_MAX_AGE_MS", 30000);

function buildMessage(): string {
  return (
    `\nFATAL: fxincapapi cannot start — ${missing.length} required environment variable(s) missing:\n\n` +
    missing.join("\n") +
    `\n\nSet them in fxincapapi/.env (see docs/ENVIRONMENT.md).\n` +
    `These previously had insecure defaults in source and are now mandatory:\n` +
    `a service must never fall back to a shared secret or to a hard-coded\n` +
    `production database. See docs/SECURITY.md §3 and §4.\n`
  );
}

/**
 * Explicit re-check, callable from tests or a health probe.
 * Throws rather than exiting so a caller can handle it.
 */
export function assertEnv(): void {
  if (missing.length > 0) throw new ConfigError(buildMessage());
}

/**
 * Fail fast at module evaluation — before lib/database.ts builds its Pool and
 * before any route module reads a secret. ESM hoists imports, so a check placed
 * in index.ts would run too late to prevent a misconfigured Pool being created.
 *
 * Skipped under a test runner so unit tests can import pure helpers without a
 * full production environment.
 */
if (missing.length > 0 && !process.env.VITEST && process.env.NODE_ENV !== "test") {
  console.error(buildMessage());
  process.exit(1);
}

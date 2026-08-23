import { query } from "../lib/database.js";

/**
 * kyc_documents only ever existed in src/lib/schema.sql, which is MySQL syntax
 * and was never applied to this PostgreSQL database. Created lazily here (as
 * trade_history and friends already are) so a fresh install works out of the
 * box; migrations/010_kyc_documents.sql is the canonical definition.
 */
let ensureKycTablePromise: Promise<void> | null = null;

export async function ensureKycDocumentsTable(): Promise<void> {
  if (!ensureKycTablePromise) {
    ensureKycTablePromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS kyc_documents (
          id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id          UUID NOT NULL,
          document_type    VARCHAR(50),
          document_url     VARCHAR(255),
          document_number  VARCHAR(100),
          issue_date       DATE,
          expiry_date      DATE,
          status           VARCHAR(20) NOT NULL DEFAULT 'pending',
          rejection_reason TEXT,
          created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(`CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(status)`);
    })().catch((error) => {
      // Let a later call retry rather than caching the failure forever.
      ensureKycTablePromise = null;
      throw error;
    });
  }
  await ensureKycTablePromise;
}

export interface KycDocument {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  documentType: string | null;
  fileUrl: string | null;
  status: "pending" | "approved" | "rejected";
  notes?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ListOptions {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}

function sanitizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 50;
  return Math.min(Math.max(1, limit), 100);
}

function sanitizeOffset(offset?: number) {
  if (!offset || Number.isNaN(offset) || offset < 0) return 0;
  return offset;
}

export async function fetchKycDocuments(options: ListOptions = {}): Promise<KycDocument[]> {
  await ensureKycDocumentsTable();
  const limit = sanitizeLimit(options.limit);
  const offset = sanitizeOffset(options.offset);
  const where: string[] = [];
  const values: any[] = [];

  if (options.status) {
    where.push("kd.status = ?");
    values.push(options.status);
  }

  if (options.search) {
    const like = `%${options.search}%`;
    where.push("(kd.document_type LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)");
    values.push(like, like, like, like);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT
      kd.*,
      u.email AS user_email,
      CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS user_name
    FROM kyc_documents kd
    LEFT JOIN users u ON u.id = kd.user_id
    ${whereClause}
    ORDER BY kd.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const results = await query(sql, values);
  if (!Array.isArray(results)) return [];

  return results.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email || null,
    userName: (r.user_name || '').trim() || null,
    documentType: r.document_type || null,
    fileUrl: r.file_url || r.file_path || r.file || r.document_path || r.document_url || null,
    status: r.status,
    notes: r.notes || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }));
}

export async function fetchKycDocumentById(id: string): Promise<KycDocument | null> {
  await ensureKycDocumentsTable();
  const rows: any = await query(
    `SELECT kd.*, u.email AS user_email,
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS user_name
     FROM kyc_documents kd
     LEFT JOIN users u ON u.id = kd.user_id
     WHERE kd.id = ?
     LIMIT 1`,
    [id]
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email || null,
    userName: (r.user_name || '').trim() || null,
    documentType: r.document_type || null,
    fileUrl: r.file_url || r.file_path || r.file || r.document_path || r.document_url || null,
    status: r.status,
    notes: r.notes || null,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

const REQUIRED_KYC_DOCUMENT_TYPES = ["aadhaar", "panCard", "passport", "bankPassbook"];

async function recomputeUserKycStatus(userId: string) {
  const rows: any = await query(
    "SELECT document_type, status FROM kyc_documents WHERE user_id = ?",
    [userId]
  );
  const byType = new Map((Array.isArray(rows) ? rows : []).map((r: any) => [r.document_type, r.status]));

  let overall: "pending" | "approved" | "rejected" = "pending";
  if (REQUIRED_KYC_DOCUMENT_TYPES.some((t) => byType.get(t) === "rejected")) {
    overall = "rejected";
  } else if (REQUIRED_KYC_DOCUMENT_TYPES.every((t) => byType.get(t) === "approved")) {
    overall = "approved";
  }

  await query("UPDATE user_profiles SET kyc_status = ? WHERE user_id = ?", [overall, userId]);
}

export async function updateKycStatus(id: string, status: "approved" | "rejected") {
  await ensureKycDocumentsTable();
  const rows: any = await query("SELECT user_id FROM kyc_documents WHERE id = ? LIMIT 1", [id]);
  const userId = Array.isArray(rows) && rows.length > 0 ? rows[0].user_id : null;
  if (!userId) return false;

  const result: any = await query(
    "UPDATE kyc_documents SET status = ?, updated_at = NOW() WHERE id = ? RETURNING id",
    [status, id]
  );
  const ok = Array.isArray(result) && result.length > 0;

  await recomputeUserKycStatus(userId);
  return ok;
}


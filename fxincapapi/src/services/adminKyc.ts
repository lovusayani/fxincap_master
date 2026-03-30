import { query } from "../lib/database.js";

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

export async function updateKycStatus(id: string, status: "approved" | "rejected") {
  const result: any = await query(
    "UPDATE kyc_documents SET status = ?, updated_at = NOW() WHERE id = ?",
    [status, id]
  );
  return (result?.affectedRows || 0) > 0;
}


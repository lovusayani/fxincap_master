/**
 * Support tickets.
 *
 * `support_tickets` already exists and is owned by `doadmin`, so this role can
 * read and write it but cannot ALTER it. Categories and replies therefore live
 * in their own tables that this role owns, rather than as new columns.
 */
import { query } from "./database.js";
import { v4 as uuidv4 } from "uuid";

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

let schemaReady = false;

export async function ensureSupportTables(): Promise<void> {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS support_categories (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       VARCHAR(80) NOT NULL UNIQUE,
      enabled    BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Threaded conversation on a ticket. author_type says who wrote it so the
  // trader UI can style their own messages differently from staff replies.
  await query(`
    CREATE TABLE IF NOT EXISTS support_replies (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id   UUID NOT NULL,
      author_type VARCHAR(10) NOT NULL,
      author_id   UUID,
      author_name VARCHAR(120),
      message     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_support_replies_ticket ON support_replies (ticket_id, created_at)`);

  // Seed a starting set so the trader form is usable before an admin edits it.
  const existing = (await query(`SELECT COUNT(*)::int AS c FROM support_categories`)) as any[];
  if (!existing?.[0]?.c) {
    const seed = ["Deposit", "Withdrawal", "KYC / Verification", "Trading", "Account", "Other"];
    for (let i = 0; i < seed.length; i++) {
      await query(
        `INSERT INTO support_categories (name, sort_order) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [seed[i], i]
      );
    }
  }

  schemaReady = true;
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function listCategories(onlyEnabled = false) {
  await ensureSupportTables();
  const rows = (await query(
    `SELECT id, name, enabled, sort_order FROM support_categories
      ${onlyEnabled ? "WHERE enabled = TRUE" : ""}
      ORDER BY sort_order, name`
  )) as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled !== false,
    sortOrder: Number(r.sort_order || 0),
  }));
}

export async function createCategory(name: string, sortOrder = 0) {
  await ensureSupportTables();
  const rows = (await query(
    `INSERT INTO support_categories (name, sort_order) VALUES ($1, $2)
     ON CONFLICT (name) DO NOTHING
     RETURNING id, name, enabled, sort_order`,
    [name.trim(), sortOrder]
  )) as any[];
  if (!rows.length) throw new Error("A category with that name already exists");
  return rows[0];
}

export async function updateCategory(id: string, patch: { name?: string; enabled?: boolean; sortOrder?: number }) {
  await ensureSupportTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (typeof patch.name === "string" && patch.name.trim()) {
    params.push(patch.name.trim());
    sets.push(`name = $${params.length}`);
  }
  if (typeof patch.enabled === "boolean") {
    params.push(patch.enabled);
    sets.push(`enabled = $${params.length}`);
  }
  if (Number.isFinite(patch.sortOrder as number)) {
    params.push(Math.trunc(patch.sortOrder as number));
    sets.push(`sort_order = $${params.length}`);
  }
  if (!sets.length) throw new Error("Nothing to update");
  params.push(id);
  const rows = (await query(
    `UPDATE support_categories SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $${params.length} RETURNING id, name, enabled, sort_order`,
    params
  )) as any[];
  if (!rows.length) throw new Error("Category not found");
  return rows[0];
}

/**
 * Categories are referenced by name on tickets, so removing one must not
 * rewrite history — existing tickets keep the name they were filed under.
 */
export async function deleteCategory(id: string) {
  await ensureSupportTables();
  const rows = (await query(`DELETE FROM support_categories WHERE id = $1 RETURNING id`, [id])) as any[];
  if (!rows.length) throw new Error("Category not found");
  return true;
}

// ── Tickets ─────────────────────────────────────────────────────────────────

const mapTicket = (r: any) => ({
  id: r.id,
  ticketNumber: r.ticket_number,
  subject: r.subject,
  description: r.description,
  category: r.category || null,
  priority: r.priority || "medium",
  status: r.status || "open",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  resolvedAt: r.resolved_at,
  replyCount: r.reply_count === undefined ? undefined : Number(r.reply_count || 0),
  traderName: r.first_name || r.last_name ? [r.first_name, r.last_name].filter(Boolean).join(" ") : null,
  traderEmail: r.email || null,
  userId: r.user_id,
});

export async function createTicket(input: {
  userId: string;
  subject: string;
  description: string;
  category?: string | null;
  priority?: string | null;
}) {
  await ensureSupportTables();
  const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;
  const rows = (await query(
    `INSERT INTO support_tickets (user_id, ticket_number, subject, description, category, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'open')
     RETURNING *`,
    [
      input.userId,
      ticketNumber,
      input.subject.trim(),
      input.description.trim(),
      input.category?.trim() || null,
      ["low", "medium", "high"].includes(String(input.priority)) ? input.priority : "medium",
    ]
  )) as any[];
  return mapTicket(rows[0]);
}

export async function listTicketsForUser(userId: string) {
  await ensureSupportTables();
  const rows = (await query(
    `SELECT t.*, (SELECT COUNT(*) FROM support_replies r WHERE r.ticket_id = t.id) AS reply_count
       FROM support_tickets t
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 100`,
    [userId]
  )) as any[];
  return rows.map(mapTicket);
}

export async function listTicketsForAdmin(opts: { status?: string; category?: string; search?: string; limit?: number } = {}) {
  await ensureSupportTables();
  const where: string[] = [];
  const params: any[] = [];
  if (opts.status) {
    params.push(opts.status);
    where.push(`t.status = $${params.length}`);
  }
  if (opts.category) {
    params.push(opts.category);
    where.push(`t.category = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    const i = params.length;
    where.push(`(t.subject ILIKE $${i} OR t.ticket_number ILIKE $${i} OR u.email ILIKE $${i})`);
  }
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  const rows = (await query(
    `SELECT t.*, u.email, u.first_name, u.last_name,
            (SELECT COUNT(*) FROM support_replies r WHERE r.ticket_id = t.id) AS reply_count
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
        t.created_at DESC
      LIMIT ${limit}`,
    params
  )) as any[];
  return rows.map(mapTicket);
}

/** A ticket plus its thread. `userId` scopes the lookup for trader access. */
export async function getTicket(id: string, userId?: string) {
  await ensureSupportTables();
  const params: any[] = [id];
  let scope = "";
  if (userId) {
    params.push(userId);
    scope = ` AND t.user_id = $2`;
  }
  const rows = (await query(
    `SELECT t.*, u.email, u.first_name, u.last_name
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
      WHERE t.id = $1${scope} LIMIT 1`,
    params
  )) as any[];
  if (!rows.length) return null;

  const replies = (await query(
    `SELECT id, author_type, author_name, message, created_at
       FROM support_replies WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [id]
  )) as any[];

  return {
    ...mapTicket(rows[0]),
    replies: replies.map((r) => ({
      id: r.id,
      authorType: r.author_type,
      authorName: r.author_name || (r.author_type === "admin" ? "Support" : "You"),
      message: r.message,
      createdAt: r.created_at,
    })),
  };
}

export async function addReply(input: {
  ticketId: string;
  authorType: "admin" | "trader";
  authorId?: string | null;
  authorName?: string | null;
  message: string;
  newStatus?: string | null;
}) {
  await ensureSupportTables();
  const exists = (await query(`SELECT id FROM support_tickets WHERE id = $1`, [input.ticketId])) as any[];
  if (!exists.length) throw new Error("Ticket not found");

  await query(
    `INSERT INTO support_replies (ticket_id, author_type, author_id, author_name, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.ticketId, input.authorType, input.authorId || null, input.authorName || null, input.message.trim()]
  );

  // An admin reply moves an untouched ticket forward; a trader reply reopens a
  // resolved one so it does not sit unnoticed.
  const status =
    input.newStatus && (TICKET_STATUSES as readonly string[]).includes(input.newStatus)
      ? input.newStatus
      : input.authorType === "admin"
      ? "in_progress"
      : "open";

  await query(
    `UPDATE support_tickets
        SET status = $1::varchar,
            updated_at = NOW(),
            resolved_at = CASE WHEN $1::text IN ('resolved','closed') THEN NOW() ELSE resolved_at END
      WHERE id = $2`,
    [status, input.ticketId]
  );

  return getTicket(input.ticketId);
}

export async function setTicketStatus(id: string, status: string) {
  await ensureSupportTables();
  if (!(TICKET_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");
  const rows = (await query(
    `UPDATE support_tickets
        SET status = $1::varchar, updated_at = NOW(),
            resolved_at = CASE WHEN $1::text IN ('resolved','closed') THEN NOW() ELSE resolved_at END
      WHERE id = $2 RETURNING id`,
    [status, id]
  )) as any[];
  if (!rows.length) throw new Error("Ticket not found");
  return getTicket(id);
}

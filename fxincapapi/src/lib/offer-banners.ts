/**
 * Promotional hero banners for the trader dashboard.
 *
 * Admins manage them in the admin portal; the trading client reads the enabled
 * ones through a public endpoint. Images live under /uploads/offers/, which
 * index.ts already serves statically.
 *
 * See migrations/007_create_offer_banners_table.sql.
 */

import { query } from "./database.js";

export interface OfferBanner {
  id: number;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string | null;
}

/** Boot-time creation, mirroring lib/account-types.ts. */
export async function ensureOfferBannersTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS offer_banners (
        id          SERIAL PRIMARY KEY,
        image_url   TEXT         NOT NULL,
        title       VARCHAR(160),
        subtitle    VARCHAR(240),
        link_url    TEXT,
        sort_order  INT          NOT NULL DEFAULT 0,
        enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  } catch (error: any) {
    if (!String(error?.message ?? "").includes("already exists")) {
      console.error("[offer-banners] create table:", error?.message);
    }
  }

  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_offer_banners_enabled ON offer_banners (enabled, sort_order)`);
  } catch {
    // Index may already exist.
  }
}

// NOTE: lib/database.ts `query()` resolves to result.rows — a plain array, not
// the pg result object. Only getConnection() clients expose `.rows`.
function mapRow(row: any): OfferBanner {
  return {
    id: Number(row.id),
    imageUrl: String(row.image_url),
    title: row.title ?? null,
    subtitle: row.subtitle ?? null,
    linkUrl: row.link_url ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

/** All banners, for the admin list. */
export async function listOfferBanners(): Promise<OfferBanner[]> {
  const rows = await query(
    `SELECT id, image_url, title, subtitle, link_url, sort_order, enabled, updated_at
       FROM offer_banners
      ORDER BY sort_order ASC, id DESC`,
  );
  return (rows ?? []).map(mapRow);
}

/** Enabled banners only, for the trading client. */
export async function listActiveOfferBanners(): Promise<OfferBanner[]> {
  const rows = await query(
    `SELECT id, image_url, title, subtitle, link_url, sort_order, enabled, updated_at
       FROM offer_banners
      WHERE enabled = TRUE
      ORDER BY sort_order ASC, id DESC`,
  );
  return (rows ?? []).map(mapRow);
}

export async function createOfferBanner(input: {
  imageUrl: string;
  title?: string | null;
  subtitle?: string | null;
  linkUrl?: string | null;
  sortOrder?: number;
  enabled?: boolean;
}): Promise<OfferBanner> {
  const rows = await query(
    `INSERT INTO offer_banners (image_url, title, subtitle, link_url, sort_order, enabled)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, image_url, title, subtitle, link_url, sort_order, enabled, updated_at`,
    [
      input.imageUrl,
      input.title ?? null,
      input.subtitle ?? null,
      input.linkUrl ?? null,
      input.sortOrder ?? 0,
      input.enabled ?? true,
    ],
  );
  return mapRow(rows[0]);
}

export async function updateOfferBanner(
  id: number,
  patch: { title?: string | null; subtitle?: string | null; linkUrl?: string | null; sortOrder?: number; enabled?: boolean },
): Promise<OfferBanner | null> {
  const sets: string[] = [];
  const params: any[] = [];

  const push = (column: string, value: any) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (patch.title !== undefined) push("title", patch.title);
  if (patch.subtitle !== undefined) push("subtitle", patch.subtitle);
  if (patch.linkUrl !== undefined) push("link_url", patch.linkUrl);
  if (patch.sortOrder !== undefined) push("sort_order", patch.sortOrder);
  if (patch.enabled !== undefined) push("enabled", patch.enabled);

  if (sets.length === 0) return null;

  sets.push(`updated_at = NOW()`);
  params.push(id);

  const rows = await query(
    `UPDATE offer_banners SET ${sets.join(", ")} WHERE id = $${params.length}
     RETURNING id, image_url, title, subtitle, link_url, sort_order, enabled, updated_at`,
    params,
  );
  return rows?.length ? mapRow(rows[0]) : null;
}

/** Returns the removed row so the caller can delete the image from disk. */
export async function deleteOfferBanner(id: number): Promise<OfferBanner | null> {
  const rows = await query(
    `DELETE FROM offer_banners WHERE id = $1
     RETURNING id, image_url, title, subtitle, link_url, sort_order, enabled, updated_at`,
    [id],
  );
  return rows?.length ? mapRow(rows[0]) : null;
}

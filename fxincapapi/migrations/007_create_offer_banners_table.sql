-- Promotional hero banners shown on the trader dashboard, managed from the
-- admin portal.
--
-- Additive only: safe to run against a live database. No banner rows are
-- seeded, so installing this shows nothing until an admin adds one.

CREATE TABLE IF NOT EXISTS offer_banners (
  id          SERIAL PRIMARY KEY,
  -- Path under /uploads/offers/, served statically by the API.
  image_url   TEXT         NOT NULL,
  -- Optional caption drawn over the image.
  title       VARCHAR(160),
  subtitle    VARCHAR(240),
  -- Optional click target. Relative ("/deposit") or absolute.
  link_url    TEXT,
  -- Lower sorts first; ties break on newest.
  sort_order  INT          NOT NULL DEFAULT 0,
  enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_banners_enabled
  ON offer_banners (enabled, sort_order);

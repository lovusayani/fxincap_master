-- CMS-style content for static marketing/legal pages (About Us to start).
-- Keyed by slug so more pages can be added without a schema change.

CREATE TABLE IF NOT EXISTS page_content (
  slug       VARCHAR(64) PRIMARY KEY,
  title      VARCHAR(255) NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  published  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO page_content (slug, title, content)
VALUES ('about-us', 'About Us', '')
ON CONFLICT (slug) DO NOTHING;

-- Admin-configurable spread markup, applied server-side on top of the
-- provider's raw bid/ask before any client sees a price.
--
-- One row per symbol. The reserved symbol 'ALL' is the fallback applied to any
-- symbol without its own row, so a broker can set a house-wide default and
-- override individual pairs.
--
-- Additive only: safe to run against a live database.

CREATE TABLE IF NOT EXISTS symbol_spreads (
  id           SERIAL PRIMARY KEY,
  -- 'EURUSD', 'XAUUSD', … or the reserved 'ALL' fallback. Stored uppercase.
  symbol       VARCHAR(32)    NOT NULL,
  -- Total markup in pips, split evenly across bid and ask so the mid is
  -- unchanged. 0 means "quote the provider price as-is".
  spread_pips  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  enabled      BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- One config per symbol; the API upserts on this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_spreads_symbol
  ON symbol_spreads (symbol);

-- Seeded disabled with a zero markup: installing this must not silently change
-- live pricing. A broker turns it on deliberately from the admin panel.
INSERT INTO symbol_spreads (symbol, spread_pips, enabled)
VALUES ('ALL', 0, FALSE)
ON CONFLICT (symbol) DO NOTHING;

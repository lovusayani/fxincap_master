-- Run against the same PostgreSQL database as fxincapapi (e.g. fxincapmain).
-- Safe to re-run: ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS ws_api_keys (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL UNIQUE,
  api_key TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  endpoint VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ws_api_keys (provider, api_key, endpoint, notes, enabled)
VALUES
  ('finnhub', '', 'wss://ws.finnhub.io', 'Finnhub WebSocket', TRUE),
  ('twelvedata', '', 'wss://ws.twelvedata.com/v1/quotes/price', 'TwelveData WebSocket', FALSE),
  ('binance', '', 'wss://stream.binance.com:9443/ws', 'Binance WebSocket', FALSE)
ON CONFLICT (provider) DO NOTHING;

-- Set API keys via admin UI or: UPDATE ws_api_keys SET api_key = '...' WHERE provider = 'finnhub';

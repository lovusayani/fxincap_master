-- Multi-provider API management table
-- Stores API keys, endpoints, and enable/disable status per provider
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NOT NULL UNIQUE,
  api_key LONGTEXT,
  enabled BOOLEAN DEFAULT 0,
  endpoint VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_provider (provider),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default providers (can be enabled/disabled via admin)
INSERT IGNORE INTO api_keys (provider, api_key, enabled, endpoint, notes) VALUES
('finnhub', '', 0, 'wss://ws.finnhub.io', 'Finnhub WebSocket for stocks'),
('twelvedata', '', 0, 'wss://ws.twelvedata.com/v1/quotes/price', 'TwelveData WebSocket for forex/metals'),
('binance', '', 0, 'wss://stream.binance.com:9443/ws', 'Binance WebSocket for crypto');

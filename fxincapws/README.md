# FXIncap Multi-Provider WebSocket Service

Real-time market data aggregation service with support for multiple data providers.

## Features

- **Multi-Provider Architecture**: Finnhub, TwelveData, and Binance support
- **Admin Panel**: Enable/disable providers and configure API keys via REST API
- **WebSocket Streaming**: Real-time quotes via `/stream` endpoint
- **REST Fallback**: Automatic fallback to polling when WebSocket unavailable
- **Database-Driven Config**: All settings stored in MySQL for persistence

---

## Quick Start

### 1. Database Setup

The service automatically creates the `api_keys` table on startup:

```sql
CREATE TABLE api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NOT NULL UNIQUE,
  api_key LONGTEXT,
  enabled BOOLEAN DEFAULT 0,
  endpoint VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. Start the Service

```bash
pm2 restart fxincap-ws
```

### 3. Check Health

```bash
curl http://localhost:6000/health
```

Response:
```json
{
  "status": "ok",
  "provider": "twelvedata",
  "ws_clients": 5,
  "uptime_seconds": 123
}
```

---

## Admin API Reference

### Get All Providers

**GET** `/admin/providers`

Headers:
- `X-Admin-Token: changeme-admin-token`

Response:
```json
{
  "success": true,
  "providers": [
    {
      "id": 1,
      "provider": "finnhub",
      "enabled": 0,
      "endpoint": "wss://ws.finnhub.io",
      "api_key": "REPLACE_WITH_YOUR_FINNHUB_API_KEY",
      "notes": "Finnhub WebSocket for stocks"
    },
    {
      "id": 2,
      "provider": "twelvedata",
      "enabled": 1,
      "endpoint": "wss://ws.twelvedata.com/v1/quotes/price",
      "api_key": "40298686d2194b2087b87482f786e6b8",
      "notes": "TwelveData WebSocket for forex/metals"
    },
    {
      "id": 3,
      "provider": "binance",
      "enabled": 0,
      "endpoint": "wss://stream.binance.com:9443/ws",
      "api_key": "",
      "notes": "Binance WebSocket for crypto"
    }
  ]
}
```

### Update Provider Settings

**POST** `/admin/providers/:provider`

Headers:
- `X-Admin-Token: changeme-admin-token`
- `Content-Type: application/json`

Body:
```json
{
  "api_key": "your-api-key-here",
  "enabled": true
}
```

Response:
```json
{
  "success": true,
  "provider": {
    "id": 2,
    "provider": "twelvedata",
    "enabled": 1,
    "api_key": "40298686d2194b2087b87482f786e6b8",
    "endpoint": "wss://ws.twelvedata.com/v1/quotes/price"
  }
}
```

**Example:**

```bash
# Enable TwelveData provider
curl -X POST http://localhost:6000/admin/providers/twelvedata \
  -H "X-Admin-Token: changeme-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"40298686d2194b2087b87482f786e6b8","enabled":true}'

# Disable Finnhub provider
curl -X POST http://localhost:6000/admin/providers/finnhub \
  -H "X-Admin-Token: changeme-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

---

## Provider Configuration

### TwelveData (Recommended for Forex/Metals)

**Supported Symbols:** XAUUSD, XAGUSD, EUR/USD, stocks, indices

**Free Plan Limitations:**
- REST API: ✅ 8 credits/minute (1 credit per quote)
- WebSocket: ⚠️ Limited to trial symbols only

**API Key:** Sign up at https://twelvedata.com

**Configuration:**
```bash
curl -X POST http://localhost:6000/admin/providers/twelvedata \
  -H "X-Admin-Token: changeme-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "40298686d2194b2087b87482f786e6b8",
    "enabled": true
  }'
```

The provider automatically:
1. Attempts WebSocket connection first
2. Falls back to REST polling (2-second interval) if WS fails
3. Handles rate limiting gracefully

### Finnhub (Stocks Only)

**Supported Symbols:** AAPL, TSLA, MSFT, etc. (US equities)

**Limitations:**
- ❌ No forex or metals support (requires OANDA subscription)
- ✅ Free WebSocket streaming for stocks

**API Key:** Get free key at https://finnhub.io

### Binance (Crypto)

**Supported Symbols:** BTCUSDT, ETHUSDT, etc.

**Note:** No API key required for public WebSocket streams

---

## Client WebSocket Usage

### Connect

```javascript
const ws = new WebSocket('wss://ws.fxincap.com/stream');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### Subscribe to Symbol

```javascript
ws.send(JSON.stringify({
  action: 'subscribe',
  symbol: 'XAUUSD'
}));
```

### Receive Updates

**Initial Quote:**
```json
{
  "type": "quote",
  "symbol": "XAUUSD",
  "bid": 4530.42384,
  "ask": 4534.95654,
  "mid": 4532.69019,
  "last": 4532.69019,
  "time": 1735300000
}
```

**Real-time Updates:**
```json
{
  "type": "last",
  "symbol": "XAUUSD",
  "last": 4533.12,
  "bid": 4531.0,
  "ask": 4535.24,
  "ts": 1735300123456
}
```

### Unsubscribe

```javascript
ws.send(JSON.stringify({
  action: 'unsubscribe',
  symbol: 'XAUUSD'
}));
```

---

## Troubleshooting

### Provider Not Switching

1. Check database settings:
```bash
curl -s http://localhost:6000/admin/providers \
  -H "X-Admin-Token: changeme-admin-token" | jq .
```

2. Ensure only ONE provider is enabled:
```bash
# Disable all first
for provider in finnhub twelvedata binance; do
  curl -X POST http://localhost:6000/admin/providers/$provider \
    -H "X-Admin-Token: changeme-admin-token" \
    -H "Content-Type: application/json" \
    -d '{"enabled":false}'
done

# Enable desired provider
curl -X POST http://localhost:6000/admin/providers/twelvedata \
  -H "X-Admin-Token: changeme-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"YOUR_API_KEY","enabled":true}'
```

3. Restart service:
```bash
pm2 restart fxincap-ws
```

### Rate Limiting (TwelveData Free Plan)

**Error:** `You have run out of API credits for the current minute`

**Solution:**
- Free plan: 8 credits/minute (1 credit per quote)
- Limit concurrent symbol subscriptions to ~4 symbols
- Upgrade to Grow plan ($79/month) for higher limits

### WebSocket 401 Unauthorized

**Common with:** TwelveData free plan

**Reason:** Free plan WebSocket limited to trial symbols only

**Solution:** Provider automatically falls back to REST polling (no action needed)

---

## Environment Variables

Set in `ecosystem.config.cjs`:

```javascript
env: {
  WS_PORT: 6000,
  ADMIN_TOKEN: "changeme-admin-token",
  DB_HOST: "your-db-host",
  DB_PORT: 25060,
  DB_USER: "suimfx1",
  DB_PASS: "your-db-password",
  DB_NAME: "suim_fx",
  DB_SSL: "REQUIRED",
  FINNHUB_API_KEY: "REPLACE_WITH_YOUR_FINNHUB_API_KEY" // fallback only
}
```

---

## Provider Priorities

The service loads the **first enabled provider** from:
1. Binance (alphabetically first)
2. Finnhub
3. TwelveData

**Best Practice:** Enable only ONE provider at a time to avoid conflicts.

**Recommended Setup:**
- **Metals (XAUUSD, XAGUSD):** TwelveData
- **Stocks (AAPL, TSLA):** Finnhub or TwelveData
- **Crypto (BTCUSDT):** Binance

---

## Production Checklist

- [ ] Change `ADMIN_TOKEN` from default value
- [ ] Enable desired provider via admin API
- [ ] Set valid API key for provider
- [ ] Test quote endpoint: `curl http://localhost:6000/quote/XAUUSD`
- [ ] Monitor logs: `pm2 logs fxincap-ws`
- [ ] Verify WebSocket health: Check for 401/rate limit errors
- [ ] Set up SSL certificate for `wss://` (production)

---

## License

Proprietary - FXIncap Platform

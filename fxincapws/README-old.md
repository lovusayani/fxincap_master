# suimfx-ws

WebSocket price feed service for SUIMFX. Supports Finnhub (initial) and Binance (placeholder).

## Run

1. Create `.env` in project root:

```
WS_PORT=6000
ADMIN_TOKEN=changeme-admin-token
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=
DB_NAME=suimfx
FINNHUB_API_KEY=YOUR_KEY
```

2. Install and start:

```
npm install
npm run start
```

## Admin API

- GET `/admin/settings` → current provider & api key
- POST `/admin/settings` (header `x-admin-token`) body `{ provider: 'finnhub'|'binance', api_key: '...' }`

## WebSocket

Connect: `ws://HOST:6000/stream`

Messages:
- Subscribe: `{"action":"subscribe","symbol":"XAUUSD"}`
- Unsubscribe: `{"action":"unsubscribe","symbol":"XAUUSD"}`

Server events:
- Quote snapshot: `{ type: 'quote', symbol, bid, ask, mid }`
- Last trade updates: `{ type: 'last', symbol, last, ts }`

## Notes
- Finnhub Forex quotes use `/forex/quote` and approximate bid/ask around mid.
- Trade updates are streamed from Finnhub WebSocket.
- Binance provider is a placeholder for future expansion.

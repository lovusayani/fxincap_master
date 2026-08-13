# fxincap-ws — Market Data Service

Real-time market data aggregation for the FXIncap platform. Connects to one upstream provider at a
time, normalizes its quotes, and fans them out over WebSocket and REST.

**Full documentation:** [docs/MARKET_DATA_ARCHITECTURE.md](../docs/MARKET_DATA_ARCHITECTURE.md) ·
[docs/WEBSOCKET.md](../docs/WEBSOCKET.md)

## At a glance

| | |
| --- | --- |
| Port | `4040` (`WS_PORT`) |
| Runtime | Node.js, ESM, no build step |
| PM2 process | `fxincap-ws` → `node src/server.js` |
| Database | **PostgreSQL**, table `ws_api_keys`, created and seeded on boot |
| Providers | Finnhub · TwelveData · Binance (stub) |
| WebSocket | `ws://HOST:4040/stream` |

## Quick start

```bash
pnpm install
pnpm dev            # or: pnpm start

curl http://localhost:4040/health
curl http://localhost:4040/quote/XAUUSD
```

### Configuration

`.env` in this directory:

```
WS_PORT=4040
ADMIN_TOKEN=YOUR_ADMIN_TOKEN          # must match WS_ADMIN_TOKEN on the admin server
FINNHUB_API_KEY=                      # seeds the finnhub row only
FINNHUB_WEBHOOK_SECRET=               # empty disables webhook verification

PGHOST=YOUR_DB_HOST                   # same database as fxincapapi
PGPORT=25060
PGUSER=YOUR_DB_USER
PGPASSWORD=YOUR_DB_PASSWORD
PGDATABASE=YOUR_DB_NAME
PGSSLMODE=require
```

`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` are accepted as fallbacks.

> ⚠ **Always set the `PG*` variables.** [src/config.js](./src/config.js) hard-codes a production
> database host as its fallback, so an unconfigured process will try to reach it. See
> [docs/SECURITY.md](../docs/SECURITY.md) §3.

**Provider API keys are not environment variables.** They live in the `ws_api_keys` table and are
managed from Admin → Server Settings. For a fresh database:

```bash
psql "$DATABASE_URL" -f sql/seed_ws_api_keys.sql
```

## WebSocket

```
ws://HOST:4040/stream          # no authentication
```

```jsonc
// client → server
{"action":"subscribe","symbol":"XAUUSD"}
{"action":"unsubscribe","symbol":"XAUUSD"}

// server → client
{"type":"quote","symbol":"XAUUSD","bid":…,"ask":…,"mid":…,"last":…,"time":…,"provider":"twelvedata"}
{"type":"last","symbol":"XAUUSD","bid":…,"ask":…,"mid":…,"last":…,"time":…}
{"type":"error","message":"…"}
```

`quote` is a one-off snapshot on subscribe; `last` is the streaming tick. Full protocol, including
reconnect and heartbeat behaviour: [docs/WEBSOCKET.md](../docs/WEBSOCKET.md).

## HTTP

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/` · `/health` | none | provider status, client count, uptime |
| GET | `/quote/:symbol` | none | single quote — **the bid is nested under `.quote.bid`** |
| POST | `/webhook/finnhub` | `x-finnhub-secret` | broadcast to all clients |
| GET | `/admin/providers` | `x-admin-token` | list providers |
| POST | `/admin/providers/:provider` | `x-admin-token` | set API key / enable |
| GET | `/admin/settings` | ⚠ none | active provider — see below |
| POST | `/admin/settings` | `x-admin-token` | legacy provider switch |

```json
// GET /quote/:symbol
{ "success": true,
  "quote": { "symbol": "XAUUSD", "bid": 0, "ask": 0, "mid": 0, "last": 0, "time": 0 },
  "provider": "twelvedata" }
```

## Providers

| Provider | Transport | State |
| --- | --- | --- |
| `twelvedata` | WebSocket + REST polling (2 s) | Full support. Maps `XAUUSD → XAU/USD` etc. Synthesizes a 5 bps spread around REST `close` |
| `finnhub` | WebSocket trade ticks | ⚠ emits `{symbol, last, ts}` only — **no `bid`/`ask`**, and `getQuote()` always returns `null` |
| `binance` | — | Stub. Excluded from `SUPPORTED_RUNTIME_PROVIDERS`; configurable but never activated |

### ⚠ Finnhub is the seeded default and produces no usable prices

The frontend drops any tick without a `bid`, and `/quote/:symbol` returns 404 while Finnhub is
active. Enable `twelvedata` for working prices. Detail:
[docs/MARKET_DATA_ARCHITECTURE.md](../docs/MARKET_DATA_ARCHITECTURE.md) §3.

## Provider selection and failover

One provider is enabled at a time. `refreshProviderChain()` builds an ordered candidate list from
`ws_api_keys` (preferred first, then a static order, then `updated_at`); an adapter failure calls
`activateNextProvider()`, which swaps the provider and **replays every live subscription** — client
sockets are not disturbed.

Enabling a provider through the admin API disables the others in the same transaction and hot-swaps
the runtime provider with no restart.

## Adding a provider

One new adapter file plus registration in `src/server.js` and `src/db.js`. Nothing outside this
service should change. Step-by-step, with the contract an adapter must satisfy:
[docs/MARKET_DATA_ARCHITECTURE.md](../docs/MARKET_DATA_ARCHITECTURE.md) §8.

## Layout

```
src/
├── server.js               HTTP + WebSocket, provider selection, failover, fan-out
├── config.js               env parsing (⚠ hard-coded DB fallbacks)
├── db.js                   ws_api_keys table, seed, failover-chain query
└── providers/
    ├── twelvedata.js       adapter: REST + WS, symbol mapping, spread synthesis
    ├── twelvedata-ws.js    raw TwelveData WebSocket client (10 s heartbeat)
    ├── finnhub.js          adapter + raw Finnhub stream
    └── binance.js          stub
sql/seed_ws_api_keys.sql    standalone DDL + seed for a fresh database
```

## Operations

```bash
pm2 restart fxincap-ws
pm2 logs fxincap-ws --lines 50
curl http://127.0.0.1:4040/health     # provider_status should be "ready"
```

| `provider_status` | Meaning |
| --- | --- |
| `initializing` | booting, no provider loaded yet |
| `loading` | activating a candidate |
| `ready` | connected — check `provider_loaded_at` |
| `error` | see `provider_error`; `"apiKey is required"` means no key in `ws_api_keys` |

Note that the top-level `status` field is the literal string `"ok"` and is not a computed verdict —
monitor `provider_status` instead.

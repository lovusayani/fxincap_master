# FXIncap — System Architecture

> Derived from the source tree at commit `0b7e87b` (branch `main`). Every statement below is traceable
> to a file in this repository. Anything that cannot be proven from the repository is marked
> `TODO: verify on production server`.

## 1. Services

The repository is a **monorepo of five independently deployed Node.js services** plus a deployment
webhook. There is no shared workspace at the root — each service installs its own dependencies with
pnpm and is started as its own PM2 process.

| PM2 process | Directory | Port | Runtime entry point | Role |
| --- | --- | --- | --- | --- |
| `fxincap-app` | [fxincap/](../fxincap/) | 4000 | `next start -p 4000` | Public marketing site (Next.js) |
| `fxincap-admin` | [fxincapadmin/](../fxincapadmin/) | 5001 | `node server/src/index.js` | Admin back-office (Express static host + auth proxy in front of a React SPA) |
| `fxincap-api` | [fxincapapi/](../fxincapapi/) | 7000 | `node dist/index.js` | **The** REST API + trading engine + P&L + background workers |
| `fxincap-trade` | [fxincaptrade/](../fxincaptrade/) | 3000 | `node dist/server/start.js` | Trading client SPA (React) served by a thin Express host |
| `fxincap-ws` | [fxincapws/](../fxincapws/) | 4040 | `node src/server.js` | Market-data aggregation: provider adapters → normalized quotes → WebSocket + REST |
| `fxincap-deploy-webhook` | repo root | 9010 | `node deploy/webhook-server.cjs` | GitHub push webhook → `deploy-prod.sh` |

Ports come from [ecosystem.production.portable.cjs](../ecosystem.production.portable.cjs) and
[run-prod.sh](../run-prod.sh), which agree with each other.

> **Port caveat:** the admin Express server defaults to `PORT=4096`
> ([fxincapadmin/server/src/index.js:14](../fxincapadmin/server/src/index.js#L14)) but PM2 always injects
> `PORT=5001`. The default is never used in production.

## 2. Runtime topology

```
                          ┌───────────────────────────────┐
                          │        Browser (user)         │
                          └───────────┬───────────────────┘
                                      │ HTTPS
                    ┌─────────────────┴──────────────────┐
                    │        nginx / reverse proxy       │   TODO: verify on production server
                    └──┬───────────┬───────────┬─────────┘
                       │           │           │
     ┌─────────────────▼──┐  ┌─────▼───────┐  ┌▼──────────────────┐
     │ fxincap-app  :4000 │  │ fxincap-    │  │ fxincap-admin     │
     │ Next.js marketing  │  │ trade :3000 │  │ :5001 (SPA+proxy) │
     └────────────────────┘  │ React SPA   │  └────────┬──────────┘
                             └──┬───────┬──┘           │
                                │       │              │ /api/admin*, /api/admin-auth
              VITE_API_URL      │       │ ws://:4040   │ (Bearer ADMIN_API_TOKEN injected
              (REST)            │       │  /stream     │  server-side)
                                │       │              │
                                │       │              │ /api/ws-admin/* → x-admin-token
                                │       │              │
     ┌──────────────────────────▼───────┼──────────────▼───────────┐
     │                fxincap-api  :7000  (Express 5)              │
     │  REST · JWT auth · trading engine · P&L · SL/TP + auto-close │
     │  background workers (setInterval in src/index.ts)            │
     └───────────────┬───────────────────────────┬─────────────────┘
                     │                           │
                     │ GET /quote/:symbol        │ SQL (pg Pool)
                     │ (WS_QUOTE_BASE_URL)       │
     ┌───────────────▼────────────┐   ┌──────────▼─────────────────┐
     │   fxincap-ws  :4040        │   │  PostgreSQL (DigitalOcean  │
     │   provider adapters        │   │  managed) — single shared  │
     │   Finnhub / TwelveData /   │   │  database for all services │
     │   Binance(stub)            │   └────────────────────────────┘
     └───────────────┬────────────┘                 ▲
                     │ wss                          │ ws_api_keys (provider config)
        ┌────────────▼─────────────┐                │
        │  External market data    │────────────────┘
        │  ws.finnhub.io           │
        │  ws.twelvedata.com       │
        │  api.twelvedata.com REST │
        └──────────────────────────┘
```

Two external HTTP dependencies exist outside the provider layer:

- **CoinGecko** — dashboard crypto ticker only, called directly from
  [fxincapapi/src/routes/prices.ts:19](../fxincapapi/src/routes/prices.ts#L19) and
  [fxincaptrade/server/index.ts](../fxincaptrade/server/index.ts). It never feeds trading or P&L.
- **SendGrid / SMTP** — transactional email, see [fxincapapi/src/lib/mailer.ts](../fxincapapi/src/lib/mailer.ts).

## 3. Which service owns what

This is the single most important thing to understand about this repository, because two services
contain trading code and **only one of them is authoritative**.

### fxincapapi — authoritative

`fxincapapi` owns users, accounts, orders, trades, balances, P&L, admin, IB, MAM/PAM and payments.
It is a PostgreSQL application ([fxincapapi/src/lib/database.ts](../fxincapapi/src/lib/database.ts)) and
its trading engine is [fxincapapi/src/lib/trading-engine.ts](../fxincapapi/src/lib/trading-engine.ts).

It also runs two in-process background workers, started from
[fxincapapi/src/index.ts:143-180](../fxincapapi/src/index.ts#L143-L180):

| Worker | Interval env var | Default | Function |
| --- | --- | --- | --- |
| Auto-close expired trades | `TRADE_AUTO_CLOSE_POLL_MS` | 15000 ms | `autoCloseExpiredTrades(timeoutMinutes)` |
| SL/TP evaluation | `SL_TP_POLL_MS` | 4000 ms | `processAllStopLossTakeProfit()` |

### fxincaptrade — SPA host, legacy server routes

`fxincaptrade`'s React client calls **fxincapapi** directly via `VITE_API_URL`
([fxincaptrade/client/lib/api.ts](../fxincaptrade/client/lib/api.ts)). Its own Express server
([fxincaptrade/server/index.ts](../fxincaptrade/server/index.ts)) still registers a parallel set of
`/api/*` routes, but those routes are **legacy**:

- [fxincaptrade/server/lib/trading-engine.ts](../fxincaptrade/server/lib/trading-engine.ts) issues
  MySQL-style SQL (`?` placeholders, `pool.getConnection()`, `beginTransaction()`) against a
  `pg` Pool exported by [fxincaptrade/shared/database.ts](../fxincaptrade/shared/database.ts). Those
  calls cannot succeed — `pg.Pool` has no `getConnection`.
- [fxincaptrade/server/lib/price-service.ts](../fxincaptrade/server/lib/price-service.ts) is a
  hard-coded mock price table, self-described as a stub.

In production the process still matters — it serves `dist/spa` — so the files are **kept**. Do not
route new work through them. See [REPOSITORY_CLEANUP.md](./REPOSITORY_CLEANUP.md).

### fxincapws — market data only

`fxincapws` holds no business state. It reads provider credentials from the `ws_api_keys` table,
maintains one upstream provider connection at a time, and fans normalized quotes out to WebSocket
subscribers. See [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md).

### fxincapadmin — UI + credential-hiding proxy

The admin Express server holds no business logic. It exists to serve the built SPA and to attach
secrets server-side so they never reach the browser bundle
([fxincapadmin/server/src/index.js](../fxincapadmin/server/src/index.js)):

| Path prefix | Proxied to | Header injected |
| --- | --- | --- |
| `/api/ws-admin/*` | `WS_SERVICE_URL` (fxincapws) | `x-admin-token: WS_ADMIN_TOKEN` |
| `/api/admin/server-settings` | `LOCAL_ADMIN_API_URL` | `authorization: Bearer ADMIN_API_TOKEN` |
| `/api/admin-auth/*` | `LOCAL_ADMIN_API_URL` | `authorization: Bearer ADMIN_API_TOKEN` |
| `/api/admin/*` | `ADMIN_API_URL` | `authorization: Bearer ADMIN_API_TOKEN` |

## 4. Request lifecycle — opening a trade

```
Browser (fxincaptrade SPA)
   │  1. ws://host:4040/stream  →  {"action":"subscribe","symbol":"XAUUSD"}
   │     ← {"type":"last","symbol":"XAUUSD","bid":…,"ask":…}
   │     (client-side price display only — the price the user sees)
   │
   │  2. POST {VITE_API_URL}/api/trades/open   Authorization: Bearer <JWT>
   │     { symbol, side, volume, entryPrice, takeProfit, stopLoss, leverage }
   ▼
fxincap-api
   │  3. validateTradeOpen()  — side/volume/leverage(1..100)/SL-TP sanity + margin check
   │  4. resolveActiveAccountId(userId)
   │       user_profiles.selected_trading_mode  ('demo' | 'real')
   │       → user_accounts WHERE trading_mode = mode AND is_active AND account_status='active'
   │  5. BEGIN
   │       INSERT INTO trades (... status='OPEN')
   │       lockBalance(accountId, margin)   — conditional UPDATE, fails if free margin < margin
   │     COMMIT
   │  6. logTradeAction(TRADE_OPENED)
   ▼
PostgreSQL: trades, user_accounts, trade_logs
```

**The entry price is supplied by the client.** The API does not re-fetch a server-side price to
validate `entryPrice` before opening. See [TRADING_ENGINE.md](./TRADING_ENGINE.md) §7.

## 5. Request lifecycle — closing a trade

Two paths reach the same `closeTrade()`:

```
(a) User close      PUT /api/trades/:id/close  { closePrice }
(b) SL/TP worker    every SL_TP_POLL_MS:
                      SELECT open trades with SL or TP
                      → GET {WS_QUOTE_BASE_URL}/quote/:symbol   (fxincap-ws)
                      → checkAndExecuteStopLossTakeProfit(tradeId, bid, ask)
(c) Timeout worker  every TRADE_AUTO_CLOSE_POLL_MS:
                      close trades older than trade_settings timeout, at current_price
                      reason = FORCED_TIMEOUT
                              │
                              ▼
                        closeTrade(tradeId, closePrice, reason)
                          BEGIN
                            UPDATE trades  → CLOSED, close_price, final_pnl
                            INSERT trade_history
                            unlockBalance(accountId, locked_balance)
                            UPDATE user_accounts SET balance += pnl, available_balance += pnl
                          COMMIT
```

> **Known defect in path (b):** the worker reads `data.bid` from the fxincap-ws response, but
> `GET /quote/:symbol` returns `{ success, quote: { bid, ask, … }, provider }` — the bid lives one level
> deeper. See [TRADING_ENGINE.md](./TRADING_ENGINE.md) §6. Not fixed in this documentation pass.

## 6. Technology stack (as declared in package files)

| Service | Framework | Notable versions |
| --- | --- | --- |
| fxincap | Next.js (App Router) | `next ^16.0.8`, `react ^19`, Tailwind v4, `better-auth ^1.4.6`, `drizzle-orm ^0.44.6` |
| fxincapadmin (client) | Vite + React 18 | `react-router-dom`, styled-components + Tailwind |
| fxincapadmin (server) | Express 4 | `http-proxy-middleware ^2.0.6`, `morgan` |
| fxincapapi | Express 5 + TypeScript (ESM) | `pg ^8.20`, `jsonwebtoken ^9`, `bcryptjs ^2.4.3`, `zod ^3.25`, `multer ^2`, `@sendgrid/mail`, `socket.io ^4.8` (declared, not wired) |
| fxincaptrade | Vite 7 + React 18 + Express 5 | `lightweight-charts ^5`, `@tanstack/react-query`, `zustand`, `pg`, `metaapi.cloud-sdk` (declared, not wired) |
| fxincapws | Express 4 (ESM) | `ws ^8.18`, `axios`, `pg ^8.20` |

`socket.io`, `metaapi.cloud-sdk`, `better-sqlite3`, `sql.js` and `mysql2` appear as dependencies but no
source file imports them for a live code path — they are residue from earlier iterations.

## 7. Cross-cutting decisions

Recorded as ADRs:

- [ADR-0001 — Service split](./ADR/0001-system-architecture.md)
- [ADR-0002 — Database-backed market-data provider abstraction](./ADR/0002-market-data-provider.md)
- [ADR-0003 — PM2 + webhook production deployment](./ADR/0003-production-deployment.md)

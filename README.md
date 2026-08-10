# FXIncap

A multi-service forex, metals and crypto trading platform: a marketing site, a browser trading
terminal, an admin back-office, a REST/trading API and a real-time market-data service — five Node.js
applications in one repository, deployed together to a single DigitalOcean host with PM2.

> **This is a live production system.** Before changing anything, read
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/SECURITY.md](docs/SECURITY.md).

---

## Capabilities

Only functionality that exists in this repository is listed.

### Trading
- Market orders opened and closed against a PostgreSQL-backed position ledger (`trades`)
- Long (BUY) and short (SELL) positions with per-trade leverage, validated to 1–100×
- Per-symbol contract sizes: 100,000 (FX) · 100 (XAU) · 5,000 (XAG) · 1 (BTC/ETH)
- Margin locked at open, released at close, with a conditional balance check that cannot overdraw
- Stop loss and take profit stored per trade, evaluated at executable prices (BUY exits at bid,
  SELL at ask) — ⚠ the background worker that drives this has a known defect, see
  [docs/TRADING_ENGINE.md](docs/TRADING_ENGINE.md) §9
- Automatic close of trades older than an admin-configured timeout
- Pending orders that reserve margin (they do not convert into positions)
- Realized P&L settled transactionally into the account balance, with a `trade_history` ledger and a
  `trade_logs` audit trail

### Accounts
- Demo and real trading modes; multiple accounts per mode with exactly one active at a time
- Balance, locked balance, available balance (free margin) per account
- Admin-defined account types
- KYC document upload and review
- Deposits and withdrawals with screenshot upload, bank accounts and crypto beneficiaries

### Market data
- Provider-abstracted feed: **TwelveData** (REST + WebSocket) and **Finnhub** (WebSocket);
  a Binance adapter exists as a stub only
- Provider selection and API keys stored in the database and changed live from the admin UI —
  no restart
- Automatic failover across a configured provider chain, replaying live subscriptions
- WebSocket fan-out to browsers with reference-counted upstream subscriptions
- REST quote endpoint used as a fallback and by the trading engine

### Admin
- Separate admin identity store with email verification, device tracking and session locking
- User, trader and trading-account management (ban, activate, change password, impersonate)
- Fund request approval, KYC review, balance adjustment
- Market-data provider configuration and live connectivity testing
- Email provider configuration (SendGrid or SMTP) with a test send
- IB program and MAM/PAM administration
- Platform branding and trade settings

### Programs
- **IB (Introducing Broker)**: applications, commission levels, client tracking, referral links,
  commission withdrawal, sub-agents
- **MAM/PAM copy trading**: master accounts, follower subscriptions, performance and investor views

### Authentication
- JWT bearer authentication for users, with bcrypt password hashing and a complexity policy
- Email verification (deferrable at registration)
- Separate admin auth with refresh tokens and password recovery

> ⚠ **Not implemented despite appearances:** margin level, margin call and stop-out; commission,
> swap and fee accounting; order-to-position conversion; server-side unrealized P&L (`trades.pnl` is
> never written for open positions and `user_accounts.equity` is never recomputed). See
> [docs/PNL_ENGINE.md](docs/PNL_ENGINE.md).

---

## Architecture

```
                          ┌───────────────────────────────┐
                          │        Browser (user)         │
                          └───────────┬───────────────────┘
                                      │ HTTPS
                    ┌─────────────────┴──────────────────┐
                    │        nginx / reverse proxy       │
                    └──┬───────────┬───────────┬─────────┘
                       │           │           │
     ┌─────────────────▼──┐  ┌─────▼───────┐  ┌▼──────────────────┐
     │ fxincap      :4000 │  │ fxincaptrade│  │ fxincapadmin      │
     │ Next.js marketing  │  │ :3000 SPA   │  │ :5001 SPA + proxy │
     └────────────────────┘  └──┬───────┬──┘  └────────┬──────────┘
                                │       │              │
                REST (VITE_API_URL)     │ ws :4040     │ /api/admin*
                                │       │  /stream     │ /api/ws-admin*
                                │       │              │
     ┌──────────────────────────▼───────┼──────────────▼───────────┐
     │                fxincapapi  :7000  (Express 5)               │
     │  REST · JWT auth · trading engine · P&L · background workers │
     └───────────────┬───────────────────────────┬─────────────────┘
                     │ GET /quote/:symbol        │ SQL
     ┌───────────────▼────────────┐   ┌──────────▼─────────────────┐
     │   fxincapws  :4040         │   │  PostgreSQL (DigitalOcean  │
     │   provider adapters +      │◄──┤  managed) — one shared DB  │
     │   failover + fan-out       │   └────────────────────────────┘
     └───────────────┬────────────┘      ws_api_keys = provider config
                     │ wss
        ┌────────────▼─────────────┐
        │ TwelveData · Finnhub     │
        └──────────────────────────┘
```

Detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Repository structure

| Directory | Service | Port | Role |
| --- | --- | --- | --- |
| [fxincap/](fxincap/) | `fxincap-app` | 4000 | Marketing site (Next.js 16, React 19) |
| [fxincapadmin/](fxincapadmin/) | `fxincap-admin` | 5001 | Admin SPA + Express credential-injecting proxy |
| [fxincapapi/](fxincapapi/) | `fxincap-api` | 7000 | **REST API, trading engine, P&L, workers** |
| [fxincaptrade/](fxincaptrade/) | `fxincap-trade` | 3000 | Trading client SPA + thin Express host |
| [fxincapws/](fxincapws/) | `fxincap-ws` | 4040 | **Market-data aggregation and fan-out** |
| [deploy/](deploy/) | `fxincap-deploy-webhook` | 9010 | GitHub push webhook → `deploy-prod.sh` |
| [docs/](docs/) | — | — | Platform documentation |
| [scripts/](scripts/) | — | — | Windows developer helpers, one backfill SQL |

`fxincapapi` is the authoritative backend. `fxincaptrade/server/` also registers `/api/trades`,
`/api/positions` and `/api/orders`, but those routes are legacy and non-functional — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3.

Full map: [docs/REPOSITORY_STRUCTURE.md](docs/REPOSITORY_STRUCTURE.md).

---

## Technology stack

Versions as declared in the package files — not guessed.

| Service | Stack |
| --- | --- |
| fxincap | `next ^16.0.8`, `react ^19`, Tailwind v4, Radix UI, `framer-motion`, `three` / `@react-three/fiber` |
| fxincapadmin | client: Vite + `react ^18.3`, `react-router-dom`, Tailwind + styled-components · server: Express 4, `http-proxy-middleware ^2.0.6` |
| fxincapapi | Express `^5.2.1`, TypeScript `^5.9.3` (ESM), `pg ^8.20`, `jsonwebtoken ^9`, `bcryptjs ^2.4.3`, `zod ^3.25`, `multer ^2`, `@sendgrid/mail ^7.7` |
| fxincaptrade | Vite `^7.1`, `react ^18.3`, `@tanstack/react-query ^5.84`, `zustand ^5`, `lightweight-charts ^5`, Express `^5.1`, `pg ^8.20` |
| fxincapws | Express `^4.19` (ESM), `ws ^8.18`, `axios ^1.7`, `pg ^8.20` |

Runtime: Node.js 18+ · pnpm · PM2 · PostgreSQL (DigitalOcean managed).

`socket.io`, `metaapi.cloud-sdk`, `mysql2`, `better-sqlite3` and `sql.js` are declared but not
imported on any live code path.

---

## Local development

**pnpm is the only supported package manager.** Never commit a `package-lock.json`.

```bash
git clone https://github.com/lovusayani/fxincap_master.git
cd fxincap_master

for d in fxincap fxincapadmin fxincapapi fxincaptrade fxincapws; do
  (cd $d && pnpm install --frozen-lockfile)
done

pnpm run dev:all        # all five services (PowerShell / Windows)
```

Individually:

| Service | Command | Port |
| --- | --- | --- |
| fxincap | `cd fxincap && pnpm dev` | 4000 |
| fxincapadmin | `cd fxincapadmin && pnpm dev` | 5173 |
| fxincapapi | `cd fxincapapi && pnpm dev` | 7000 |
| fxincaptrade | `cd fxincaptrade && pnpm dev` | 3000 |
| fxincapws | `cd fxincapws && pnpm dev` | 4040 |

More: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

### Contributing

Development happens on two PCs synchronized through GitHub. Work on a feature branch off `main`, push
it, and open a PR — **merging to `main` deploys to production**. Never commit directly to `main`, and
never use `deploy-remote.ps1`. Full rules: [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

---

## Environment configuration

Each service reads its own `.env`; none is committed. Copy the `.example` templates:

```bash
cp fxincapapi/.env.example          fxincapapi/.env
cp fxincaptrade/.env.example        fxincaptrade/.env
cp fxincapadmin/client/.env.example fxincapadmin/client/.env
cp fxincap/.env.example             fxincap/.env
# fxincapws has no template — see docs/ENVIRONMENT.md §5
```

⚠ **Set these explicitly even locally.** Where they are unset the code falls back to production
hostnames or insecure literals:

| Variable | Fallback if unset |
| --- | --- |
| `PGHOST` / `PGUSER` / `PGDATABASE` | **a real production database host** |
| `JWT_SECRET` | the literal `"secret"` |
| `ADMIN_TOKEN` / `WS_ADMIN_TOKEN` | `changeme-admin-token` |
| `CORS_ORIGIN` | empty ⇒ any origin allowed |

Full reference: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

---

## Database

PostgreSQL on a DigitalOcean managed cluster (TLS, port 25060), shared by all services.

Tables are created three different ways — runtime `CREATE TABLE IF NOT EXISTS` in route modules, a
boot-time seed in fxincapws, and manual SQL migrations. **There is no migration runner and no
migration ledger.** `fxincapapi/src/lib/schema.sql` is MySQL-era DDL kept for reference only; it
cannot run on PostgreSQL.

Core tables: `users`, `user_profiles`, `user_accounts`, `trades`, `trade_history`, `trade_logs`,
`orders`, `symbols`, `ws_api_keys`, `adm_settings`.

Details: [docs/DATABASE.md](docs/DATABASE.md).

---

## WebSocket

| | |
| --- | --- |
| Endpoint | `ws(s)://<host>:4040/stream` |
| Auth | none — market data is public |
| Subscribe | `{"action":"subscribe","symbol":"XAUUSD"}` |
| Unsubscribe | `{"action":"unsubscribe","symbol":"XAUUSD"}` |
| Tick | `{"type":"last","symbol":"XAUUSD","bid":…,"ask":…,"mid":…,"last":…,"time":…}` |
| Snapshot | `{"type":"quote", …, "provider":"twelvedata"}` |
| Error | `{"type":"error","message":"…"}` |
| Reconnect | client-side, fixed 3 s, subscriptions replayed on open |
| Health | `GET /health` → provider, `provider_status`, `ws_clients`, uptime |

Protocol: [docs/WEBSOCKET.md](docs/WEBSOCKET.md).

---

## Market data

Providers live behind adapters in [fxincapws/src/providers/](fxincapws/src/providers/) and emit one
normalized quote shape:

```js
{ symbol, bid, ask, mid, last, time }   // symbol = CLIENT symbol, time = UNIX seconds
```

| Provider | State |
| --- | --- |
| **TwelveData** | REST + WebSocket, symbol mapping (`XAUUSD → XAU/USD`), synthetic 5 bps spread on REST quotes |
| **Finnhub** | WebSocket trade ticks only — ⚠ emits no `bid`/`ask`, so prices are dropped downstream. It is the seeded default |
| **Binance** | stub only; excluded from the runtime provider set |

Configuration lives in the `ws_api_keys` table and is changed live from the admin UI. Failover runs
across the configured chain, replaying subscriptions.

**Adding a provider** (e.g. Infoway) touches one new adapter file plus registration in
`fxincapws/src/server.js` and `src/db.js`. Nothing outside `fxincapws/` should change. Step-by-step:
[docs/MARKET_DATA_ARCHITECTURE.md](docs/MARKET_DATA_ARCHITECTURE.md) §8.

---

## Trading

```
POST /api/trades/open  { symbol, side, volume, entryPrice, stopLoss?, takeProfit?, leverage? }
   │  validate  →  resolve active account (demo|real)  →  BEGIN
   │  INSERT trades (status='OPEN')  +  lock margin     →  COMMIT
   ▼
 open position
   │  close: manual (PUT /api/trades/:id/close) · SL/TP worker · timeout worker
   ▼
 BEGIN  UPDATE trades → CLOSED  ·  INSERT trade_history
        unlock margin  ·  balance += final_pnl        COMMIT
```

```
notional  = contractSize(symbol) × volume × price
margin    = notional / leverage
pnl       = (BUY ? current − entry : entry − current) × contractSize × volume
pnl%      = pnl / notional × 100
```

Leverage affects margin only, never P&L. No commission, swap or fee is modelled.

Details: [docs/TRADING_ENGINE.md](docs/TRADING_ENGINE.md) · [docs/PNL_ENGINE.md](docs/PNL_ENGINE.md).

---

## Admin

The admin SPA never holds secrets. Its Express server proxies four prefixes and injects credentials
server-side:

| Prefix | Target | Injected |
| --- | --- | --- |
| `/api/ws-admin/*` | fxincapws | `x-admin-token` |
| `/api/admin/server-settings` | fxincapapi | `Bearer ADMIN_API_TOKEN` |
| `/api/admin-auth/*` | fxincapapi | `Bearer ADMIN_API_TOKEN` |
| `/api/admin/*` | fxincapapi | `Bearer ADMIN_API_TOKEN` |

⚠ The API side does **not** enforce an admin role on `/api/admin/*` — see Security below.

Details: [docs/ADMIN.md](docs/ADMIN.md).

---

## Deployment

Push-to-deploy via a self-hosted GitHub webhook — there is no CI.

```
git push → GitHub → POST https://fxincap.com/hooks/deploy (HMAC-SHA256)
                  → deploy/webhook-server.cjs :9010
                  → deploy-prod.sh   git fetch && git reset --hard origin/$DEPLOY_BRANCH
                      → install-prod.sh   pnpm install --frozen-lockfile + build ×5
                      → run-prod.sh       pm2 delete + start ×5
```

⚠ `DEPLOY_BRANCH` defaults to **`dev`** in code, but `origin/dev` contains none of the deploy chain —
the live `.deploy.env` must set it to **`main`**. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) §6.
Server config lives in a gitignored `.deploy.env`.

Manual deploy: `bash deploy-prod.sh`. Rollback is `git reset --hard <sha>` + rebuild — there is no
release versioning and no database rollback.

Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Monitoring

```bash
pm2 status
pm2 logs                          # or: pm2 logs fxincap-api
pm2 logs fxincap-deploy-webhook   # deploy output

curl http://127.0.0.1:7000/api/ping    # API
curl http://127.0.0.1:4040/health      # market data — check provider_status
curl http://127.0.0.1:5001/health      # admin
curl http://127.0.0.1:3000/api/ping    # trade
```

Logs are written to `logs/` at the repository root. Log rotation is not configured.

---

## Security

Read [docs/SECURITY.md](docs/SECURITY.md) before deploying or changing authentication. The audit
found **no committed credentials**, but it did find:

| Severity | Finding |
| --- | --- |
| 🚨 Critical | **Customer KYC documents and deposit screenshots are recoverable from git history** — 382 files added in the root commit, deleted from the working tree but never purged. Requires containment and a legal assessment |
| 🚨 Critical | All 69 `/api/admin/*` endpoints accept any user JWT — no admin role check |
| 🚨 Critical | Three trade-mutating endpoints have no authentication at all |
| High | Production database coordinates hard-coded as fallbacks in five files |
| High | `JWT_SECRET` and admin tokens fall back to insecure literals |
| High | `GET /admin/settings` on fxincapws returns the provider API key without a token |

**None of these were changed** — the audit's brief excluded modifications to authentication and
production behaviour. They are prioritized in [docs/SECURITY.md](docs/SECURITY.md) §9.

Baseline requirements for any deployment: set `JWT_SECRET`, `ADMIN_TOKEN`/`WS_ADMIN_TOKEN` and an
explicit `CORS_ORIGIN`; never commit a `.env`; keep `uploads/` out of git.

---

## Testing

**There are no tests and no CI.** Both `fxincapapi` and `fxincaptrade` declare vitest, but the
repository contains zero test files. Verification today is builds plus manual smoke tests.

| Check | Command | Status |
| --- | --- | --- |
| API typecheck / build | `cd fxincapapi && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/tsc` | PASS |
| Trade typecheck / build | `cd fxincaptrade && ./node_modules/.bin/tsc --noEmit && npm run build` | PASS |
| Admin build | `cd fxincapadmin/client && ./node_modules/.bin/vite build` | PASS |
| Marketing build | `cd fxincap && ./node_modules/.bin/next build` | PASS (types skipped by config) |
| WS syntax | `cd fxincapws && node --check src/**/*.js` | PASS |
| API lint | — | NOT AVAILABLE (no eslint config) |
| Tests | — | NOT AVAILABLE |

Measured baseline: [docs/BASELINE.md](docs/BASELINE.md) · guidance: [docs/TESTING.md](docs/TESTING.md).

---

## Troubleshooting

| Symptom | Start here |
| --- | --- |
| Prices not updating | `curl :4040/health` → check `provider_status`. If the provider is `finnhub`, that is the known no-bid/ask defect — switch to `twelvedata` |
| SL/TP never fires | Known defect — [docs/TRADING_ENGINE.md](docs/TRADING_ENGINE.md) §9 |
| "No active trading account found" | No `user_accounts` row matches the user's `selected_trading_mode` and is active |
| Deploy did not run | `pm2 logs fxincap-deploy-webhook`; check the secret and that you pushed to `DEPLOY_BRANCH` |
| Service will not start | `pm2 logs <name>`; usually a missing build or a port conflict |

Full guide: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## Documentation

Index: [docs/README.md](docs/README.md).

| Document | Contents |
| --- | --- |
| [SYSTEM_OVERVIEW](docs/SYSTEM_OVERVIEW.md) | responsibilities, data ownership, failure behaviour, glossary |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | services, topology, request lifecycles |
| [MARKET_DATA_ARCHITECTURE](docs/MARKET_DATA_ARCHITECTURE.md) | provider pipeline · **where a new provider plugs in** |
| [TRADING_ENGINE](docs/TRADING_ENGINE.md) · [PNL_ENGINE](docs/PNL_ENGINE.md) | formulas traced from source |
| [API](docs/API.md) · [WEBSOCKET](docs/WEBSOCKET.md) · [DATABASE](docs/DATABASE.md) | interfaces |
| [AUTHENTICATION](docs/AUTHENTICATION.md) · [ADMIN](docs/ADMIN.md) · [SECURITY](docs/SECURITY.md) | access control |
| [DEPLOYMENT](docs/DEPLOYMENT.md) · [ENVIRONMENT](docs/ENVIRONMENT.md) | operations |
| [DEVELOPMENT](docs/DEVELOPMENT.md) · [TESTING](docs/TESTING.md) · [BASELINE](docs/BASELINE.md) · [TROUBLESHOOTING](docs/TROUBLESHOOTING.md) | working on it |
| [GIT_WORKFLOW](docs/GIT_WORKFLOW.md) | **two-PC workflow** — branch model, syncing, recovery |
| [REPOSITORY_STRUCTURE](docs/REPOSITORY_STRUCTURE.md) · [REPOSITORY_CLEANUP](docs/REPOSITORY_CLEANUP.md) · [GIT_HISTORY_AUDIT](docs/GIT_HISTORY_AUDIT.md) | repository hygiene |
| [ADR/](docs/ADR/) | architecture decision records |
| [CHANGELOG](docs/CHANGELOG.md) | change history |

---

## License

[Apache License 2.0](LICENSE).

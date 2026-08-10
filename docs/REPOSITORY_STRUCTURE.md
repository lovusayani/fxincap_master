# Repository Structure

## 1. Layout

```
fxincap_master/
├── fxincap/                    Marketing site — Next.js 16, React 19        :4000
│   ├── src/app/                App Router: layout, page, global-error
│   ├── src/components/         sections/ (9 landing sections) + ui/
│   ├── src/visual-edits/       visual editing tooling
│   ├── next.config.ts          ⚠ typescript.ignoreBuildErrors: true
│   └── ecosystem.config.js
│
├── fxincapadmin/               Admin back-office                            :5001
│   ├── client/                 Vite + React 18 SPA
│   │   ├── src/pages/          30 pages (auth, members, wallet, settings, IB, MAM/PAM)
│   │   ├── src/components/     Layout, Sidebar, ProtectedRoute, ui/
│   │   ├── src/context/        AuthContext
│   │   └── vite.config.js      dev proxy mirroring the server proxy
│   ├── server/src/index.js     Express: serves client/dist + 4 credential-injecting proxies
│   ├── pnpm-workspace.yaml     workspace: client + server
│   └── ecosystem.config.cjs
│
├── fxincapapi/                 ★ REST API · trading engine · P&L            :7000
│   ├── src/index.ts            app bootstrap, route mounting, 2 background workers
│   ├── src/routes/             18 routers — see docs/API.md
│   ├── src/services/           adminAuth, adminUsers, adminFunds, adminKyc, userEmailVerification
│   ├── src/lib/
│   │   ├── database.ts         pg Pool, DATABASE_URL or PG*, MySQL-`?`→`$n` shim
│   │   ├── trading-engine.ts   ★ margin, P&L, open/close, SL/TP, auto-close
│   │   ├── database-trading.ts trade queries and statistics
│   │   ├── schema.sql          MySQL-era DDL — reference only
│   │   └── *-settings.ts       adm_settings-backed config (trade, email, smtp)
│   ├── migrations/             3 PostgreSQL migrations + 2 MySQL-era files
│   ├── uploads/                runtime user uploads — gitignored (.gitkeep only)
│   └── ecosystem.config.cjs
│
├── fxincaptrade/               Trading client SPA + thin Express host       :3000
│   ├── client/
│   │   ├── pages/              20 routes (Dashboard, Terminal, Markets, Wallet, IB, MAM/PAM…)
│   │   ├── components/trading/ TradingLayout, TradePanel, charts, order book
│   │   ├── hooks/useMarketStream.ts   ★ the WebSocket price client
│   │   ├── lib/api.ts          VITE_API_URL → fxincapapi
│   │   └── state/trading-store.ts     zustand
│   ├── server/                 legacy Express routes — non-functional, see ARCHITECTURE §3
│   ├── shared/                 database.ts, api.ts (shared types)
│   ├── deploy/                 nginx-trade.example.conf
│   └── ecosystem.config.cjs
│
├── fxincapws/                  ★ Market data aggregation                    :4040
│   ├── src/server.js           provider selection, failover, /stream, /quote, /admin, /health
│   ├── src/db.js               ws_api_keys table + failover chain query
│   ├── src/config.js           ⚠ hard-coded DB fallbacks
│   ├── src/providers/          finnhub.js · twelvedata.js · twelvedata-ws.js · binance.js (stub)
│   ├── sql/seed_ws_api_keys.sql
│   └── ecosystem.config.cjs
│
├── deploy/webhook-server.cjs   GitHub push webhook → deploy-prod.sh         :9010
├── docs/                       this documentation set
├── scripts/                    Windows developer helpers + one backfill SQL
│
├── deploy-prod.sh              fetch + reset + install + run     ← the live deploy chain
├── install-prod.sh             pnpm install --frozen-lockfile + build ×5
├── run-prod.sh                 pm2 delete + start ×5 + webhook
├── install-staging.sh / run-staging.sh
├── ecosystem.production.portable.cjs / ecosystem.staging.portable.cjs
├── setup-server-deploy-env.sh  one-time .deploy.env bootstrap (server)
├── server-setup.sh             one-time provisioning reference
├── deploy-remote.ps1           legacy push+ssh deploy (source of the fc<timestamp> commits)
├── dev-all.ps1                 run all five services locally
├── .deploy.env.example
├── DEPLOYMENT.md               pointer → docs/DEPLOYMENT.md
├── README.md
└── LICENSE                     Apache-2.0
```

★ = the files that matter most for the upcoming market-data provider work.

## 2. Reading order for a new contributor

1. [README.md](../README.md) — what the platform is
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — the five services and who owns what
3. [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) — the provider pipeline
4. [TRADING_ENGINE.md](./TRADING_ENGINE.md) + [PNL_ENGINE.md](./PNL_ENGINE.md) — the money paths
5. [DATABASE.md](./DATABASE.md), [API.md](./API.md), [WEBSOCKET.md](./WEBSOCKET.md) — interfaces
6. [SECURITY.md](./SECURITY.md) — read before touching auth or deploying
7. [DEPLOYMENT.md](./DEPLOYMENT.md) — before any production action

## 3. Conventions worth knowing

| Convention | Detail |
| --- | --- |
| Package manager | **pnpm only**. `install-prod.sh` uses `--frozen-lockfile`; a stale lockfile fails the deploy |
| Module system | fxincapapi, fxincaptrade, fxincapws are ESM (`"type": "module"`). fxincapapi's TS imports carry explicit `.js` extensions |
| PM2 config | `.cjs` extension is required in ESM packages |
| Database | PostgreSQL, `pg`, `$1`-style placeholders. `?`-style SQL is MySQL-era legacy |
| API envelope | `{ success: true, ... }` / `{ success: false, error }` |
| Auth | `Authorization: Bearer <JWT>` via `verifyToken` |
| Uploads | written under `<service>/uploads/`, gitignored |
| Env | `.env` per service, never committed; `VITE_*` variables are build-time |

## 4. `.gitignore`

Extended during this audit. Additions:

| Pattern | Why |
| --- | --- |
| `.next/`, `out/`, `.turbo/`, `*.tsbuildinfo`, `next-env.d.ts` | Next.js build artefacts at the root level |
| `dist/spa/`, `dist/server/` | explicit fxincaptrade build outputs |
| `.pnpm-store/`, `.pnpm-debug.log*` | pnpm caches |
| `*.pid`, `*.seed`, `*.pid.lock` | stray process files |
| `.env.production.local`, `.env.development.local`, `.env.test.local` | framework-specific env variants |
| `ca-certificate.crt`, `*.p12`, `*.pfx` | database TLS material |
| `.eslintcache`, `.prettiercache` | tool caches |
| `*.bak`, `*.orig`, `*.rej`, `*~` | editor/merge residue |
| `.pm2/`, `pids/` | PM2 runtime state |

Deliberately **not** ignored, because production needs them tracked:

```
ecosystem*.cjs        deploy-prod.sh    install-prod.sh    run-prod.sh
deploy/               .deploy.env.example    *.example
fxincapapi/migrations/*.sql             fxincapws/sql/*.sql
```

Pre-existing rules preserved unchanged: `.env` + `.env.*` with `!.env.example` / `!.env.*.example`
re-inclusion, `uploads/**` with `!uploads/.gitkeep`, `node_modules/`, `logs/`, `*.log`, `*.pem`,
`*.key`, `*.crt`, `.vscode/*` with `!settings.json`.

> `*.crt` is ignored globally while `ca-certificate.crt` is named explicitly — belt and braces, since
> the database TLS bundle is the one certificate most likely to be dropped into a service directory.

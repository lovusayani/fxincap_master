# Environment Configuration

No real credential values appear in this file. Placeholders are written as `YOUR_...`.

## 1. Where env files live

| File | Service | Loaded by | Committed? |
| --- | --- | --- | --- |
| `.deploy.env` | repo root (server only) | `deploy-prod.sh`, `install-prod.sh`, `run-prod.sh` | no — `.deploy.env.example` is |
| `fxincap/.env` | marketing site | Next.js | no |
| `fxincapadmin/server/.env` | admin server | `dotenv.config()` | no |
| `fxincapadmin/client/.env` | admin Vite build | `loadEnv()` | no — `.env.example` is |
| `fxincapapi/.env` | API | `src/lib/database.ts` (cwd, then `../../.env`) | no |
| `fxincaptrade/.env`, `.env.local` | trade app | `server/load-env.ts` (`.env.local` overrides) | no |
| `fxincapws/.env` | ws service | `dotenv.config()` | no |

`.gitignore` ignores `.env` and `.env.*` while re-including `!.env.example` and `!.env.*.example`.
**No real `.env` file is tracked** — verified with `git ls-files | grep .env`.

## 2. Root — `.deploy.env`

Template: [.deploy.env.example](../.deploy.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEPLOY_WEBHOOK_SECRET` | yes | must equal the GitHub webhook secret; `run-prod.sh` aborts without it |
| `DEPLOY_BRANCH` | yes | branch this server deploys. **Must be `main`** — the code default `dev` is unusable, see [DEPLOYMENT.md](./DEPLOYMENT.md) §6 |
| `VITE_API_URL` | yes | public API origin baked into the fxincaptrade build, no trailing slash |
| `DEPLOY_ALLOW_NO_GIT` | no | `1` = rebuild without pulling (emergency only) |

## 3. fxincapapi

Template: [fxincapapi/.env.example](../fxincapapi/.env.example).

**Database** — either a single URL or discrete variables:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | takes precedence; the query string is stripped unless strict TLS is on |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | discrete form |
| `PGSSLMODE` | default `require`; `disable` turns TLS off |
| `PGSSL_REJECT_UNAUTHORIZED` | default `false` — encrypted but chain **not** verified |
| `PGSSL_CA` / `SSL_CERT_PATH` | CA bundle path, only used when `PGSSL_REJECT_UNAUTHORIZED=true` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | legacy aliases, read by fxincapws only |

> `PGSSL_REJECT_UNAUTHORIZED` defaults to `false`, so production TLS is encrypted but unauthenticated
> unless the CA bundle is configured. The code comment explains this was to fix local Windows
> development. Consider `true` + `PGSSL_CA` in production.

**Runtime**

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` in code | PM2 injects `7000`. The example file says `6000` — stale. |
| `NODE_ENV` | — | |
| `JWT_SECRET` | falls back to `"secret"` | **must be set** — see [AUTHENTICATION.md](./AUTHENTICATION.md) |
| `CORS_ORIGIN` / `CORS_ORIGINS` | empty | comma-separated allowlist. **Empty = allow any origin** |

**Trading workers**

| Variable | Default | Purpose |
| --- | --- | --- |
| `WS_QUOTE_BASE_URL` | `http://127.0.0.1:4040` | fxincapws HTTP quotes for SL/TP |
| `SL_TP_POLL_MS` | `4000` | SL/TP sweep interval |
| `TRADE_AUTO_CLOSE_POLL_MS` | `15000` | auto-close sweep interval |

**Integrations** — `SENDGRID_API_KEY`, `SENDGRID_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASSWORD`, `VERIFICATION_URL`, `OXAPAY_API_KEY`, `OXAPAY_WEBHOOK_SECRET`, `METAAPI_TOKEN`,
`METAAPI_ACCOUNT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

SendGrid/SMTP settings can also be stored in the `adm_settings` table via the admin UI, which takes
precedence over env vars at runtime ([email-settings.ts](../fxincapapi/src/lib/email-settings.ts)).
MetaAPI and OxaPay variables are declared but no live code path consumes them.

## 4. fxincaptrade

Templates: [.env.example](../fxincaptrade/.env.example) (current, PostgreSQL) and
[.env.production.example](../fxincaptrade/.env.production.example).

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | **build-time** — the fxincapapi origin compiled into the bundle. Empty ⇒ same-origin `/api` |
| `VITE_WS_STREAM_URL` | optional override for the price stream; default `ws(s)://<hostname>:4040` |
| `VITE_APP_URL`, `VITE_APP_NAME` | branding |
| `PG*` / `DB_*` | for the legacy server routes; same database as fxincapapi |
| `PORT` | `3000` |
| `JWT_SECRET` | legacy server routes |

`VITE_*` variables are **inlined at build time**. Changing them requires a rebuild, which is why
`install-prod.sh` exports `VITE_API_URL` from `.deploy.env` before `pnpm build`.

## 5. fxincapws

No `.env.example` exists — create one from this table.

| Variable | Default in code | Purpose |
| --- | --- | --- |
| `WS_PORT` | `4040` | HTTP + WebSocket port |
| `ADMIN_TOKEN` | `changeme-admin-token` | `/admin/*` gate; must equal `WS_ADMIN_TOKEN` on the admin server |
| `FINNHUB_API_KEY` | empty | seed value for the `finnhub` row only |
| `FINNHUB_WEBHOOK_SECRET` | empty | `/webhook/finnhub`; **when empty the check is skipped** |
| `PGHOST`/`DB_HOST`, `PGPORT`/`DB_PORT`, `PGUSER`/`DB_USER`, `PGPASSWORD`/`DB_PASSWORD`, `PGDATABASE`/`DB_NAME` | ⚠ hard-coded fallbacks | must point at the same database as fxincapapi |
| `PGSSLMODE`/`DB_SSLMODE` | `require` | |

⚠ [fxincapws/src/config.js](../fxincapws/src/config.js) hard-codes a real managed-database hostname,
port and username as fallbacks. A machine with no `.env` will attempt to connect to that host. This
is reproducible — see [BASELINE.md](./BASELINE.md) §4. Runtime provider API keys are **not** env vars;
they live in `ws_api_keys`.

## 6. fxincapadmin

**Server** ([server/src/index.js](../fxincapadmin/server/src/index.js)):

| Variable | Default in code | Purpose |
| --- | --- | --- |
| `PORT` | `4096` | PM2 injects `5001` |
| `NODE_ENV` | `development` | non-development serves `client/dist`; development proxies to Vite:5173 |
| `ADMIN_API_URL` | ⚠ `https://api.suimfx.world` | target for `/api/admin/*` |
| `LOCAL_ADMIN_API_URL` | `ADMIN_API_URL` | target for `/api/admin-auth` and `/server-settings` |
| `ADMIN_API_TOKEN` | empty | Bearer token injected into proxied requests |
| `WS_SERVICE_URL` | `https://ws.fxincap.com` | fxincapws origin |
| `WS_ADMIN_TOKEN` | `changeme-admin-token` | must equal fxincapws `ADMIN_TOKEN` |

**Client build** ([client/.env.example](../fxincapadmin/client/.env.example)) — `VITE_API_URL`,
`VITE_API_BASE_URL`, `ADMIN_LOCAL_API_URL`, `ADMIN_API_URL`, `WS_SERVICE_URL`, `WS_ADMIN_TOKEN`,
`ADMIN_API_TOKEN`. Only the `VITE_`-prefixed ones reach the browser; the rest configure the Vite dev
proxy.

## 7. fxincap (marketing)

`NODE_ENV`, `PORT` (PM2 injects `4000`), `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DASHBOARD_URL`,
`JWT_SECRET`. The example file still points at `*.suimfx.world` defaults.

## 8. Values that must be changed before they are trusted

| Variable | Insecure default | Impact |
| --- | --- | --- |
| `JWT_SECRET` (fxincapapi) | `"secret"` | forgeable user tokens |
| `JWT_SECRET` (adminAuth) | `'your-super-secret-jwt-key-change-in-production'` | forgeable admin tokens |
| `ADMIN_TOKEN` (fxincapws) | `changeme-admin-token` | open provider admin API |
| `WS_ADMIN_TOKEN` (admin) | `changeme-admin-token` | matching pair of the above |
| `CORS_ORIGIN` | empty ⇒ any origin | no cross-origin restriction |
| `PGSSL_REJECT_UNAUTHORIZED` | `false` | unverified TLS chain to the database |
| `PGHOST`/`PGUSER` (ws, trade, api) | real production hostnames | see [SECURITY.md](./SECURITY.md) §3 |
| `ADMIN_API_URL` (admin) | `https://api.suimfx.world` | admin traffic to a legacy domain |
| `FINNHUB_WEBHOOK_SECRET` | empty ⇒ check skipped | unauthenticated webhook |

## 9. Setting env on the server

```bash
cd /path/to/repo
bash setup-server-deploy-env.sh   # creates .deploy.env from the example if absent (chmod 600)
nano .deploy.env
# then per service:
nano fxincapapi/.env
nano fxincapws/.env
nano fxincaptrade/.env
nano fxincapadmin/server/.env
bash run-prod.sh
```

`TODO: verify on production server` — which of these files currently exist and whether each service
is running with an explicit configuration rather than the code fallbacks.

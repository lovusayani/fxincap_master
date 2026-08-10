# Local Development

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 18+ | production targets 18; verified locally on 24.18.0 |
| pnpm | 10+ | **the only supported package manager** |
| PostgreSQL | any reachable instance | services share one database |
| PowerShell | Windows | `dev-all.ps1` and `scripts/*.ps1` are PowerShell |

## 2. Install

```bash
git clone https://github.com/lovusayani/fxincap_master.git
cd fxincap_master

for d in fxincap fxincapadmin fxincapapi fxincaptrade fxincapws; do
  (cd $d && pnpm install --frozen-lockfile)
done
```

There is no root workspace — each service installs independently.

> Use `--frozen-lockfile` to match production. If it fails, `package.json` and `pnpm-lock.yaml` have
> drifted apart; fix that and commit the lockfile, or the next deploy will fail too.

## 3. Configure

Copy the templates and fill them in — see [ENVIRONMENT.md](./ENVIRONMENT.md):

```bash
cp fxincapapi/.env.example        fxincapapi/.env
cp fxincaptrade/.env.example      fxincaptrade/.env
cp fxincapadmin/client/.env.example fxincapadmin/client/.env
cp fxincap/.env.example           fxincap/.env
# fxincapws has no template — create fxincapws/.env from ENVIRONMENT.md §5
```

**Set these explicitly even locally**, because the code falls back to production values or insecure
defaults when they are missing:

```
PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE     # otherwise it dials a production host
JWT_SECRET                                          # otherwise the literal "secret"
ADMIN_TOKEN / WS_ADMIN_TOKEN                        # otherwise "changeme-admin-token"
```

On Windows, keep `PGSSL_REJECT_UNAUTHORIZED=false` unless you have the CA bundle — the code comments
explain this was added to fix "self-signed certificate in certificate chain" against managed
Postgres.

## 4. Run everything

```bash
pnpm run dev:all        # → powershell ./dev-all.ps1 start
pnpm run dev:all:status
pnpm run dev:all:stop
pnpm run dev:all:restart
```

`dev-all.ps1` runs all five services through `concurrently` in a single terminal.

## 5. Run services individually

| Service | Command | Port |
| --- | --- | --- |
| fxincap | `cd fxincap && pnpm dev` | 4000 |
| fxincapadmin (client) | `cd fxincapadmin && pnpm dev` | 5173 |
| fxincapadmin (server) | `cd fxincapadmin && pnpm dev:server` | 4096 (dev default) |
| fxincapapi | `cd fxincapapi && pnpm dev` (`tsx watch`) | 7000 |
| fxincaptrade | `cd fxincaptrade && pnpm dev` (Vite) | 3000 |
| fxincapws | `cd fxincapws && pnpm dev` | 4040 |

**Port note:** local dev ports differ from production. `fxincapapi` uses **7000** locally and in
production, but its `.env.example` still says `6000` and its code default is `3000` — always set
`PORT` explicitly.

## 6. How local requests route

```
browser :3000 (Vite)
   │
   ├─ /api/*  ──► vite.config.ts proxy ──► VITE_API_URL or http://localhost:7000  (fxincapapi)
   └─ ws://localhost:4040/stream ──────────────────────────────► fxincapws
```

Setting `VITE_API_URL` makes the client call the API cross-origin and bypass the proxy. Leaving it
empty keeps requests same-origin through the Vite proxy — usually what you want locally.

Admin (5173) proxies `/api/admin`, `/api/admin-auth` and `/api/ws-admin` per
[client/vite.config.js](../fxincapadmin/client/vite.config.js), injecting `ADMIN_API_TOKEN` and
`WS_ADMIN_TOKEN` so the browser bundle never sees them.

## 7. Build locally

```bash
cd fxincapapi   && ./node_modules/.bin/tsc               # → dist/
cd fxincaptrade && npm run build                          # → dist/spa + dist/server/start.js
cd fxincapadmin/client && ./node_modules/.bin/vite build  # → client/dist
cd fxincap      && ./node_modules/.bin/next build         # → .next/
# fxincapws has no build step
```

Invoke the binaries directly rather than `pnpm run <script>` — pnpm 11's dependency-status precheck
aborts with `ERR_PNPM_IGNORED_BUILDS` and hides the real exit code. See [BASELINE.md](./BASELINE.md) §8.

## 8. Working on market data

The most common local task, given the upcoming provider change:

```bash
cd fxincapws && pnpm dev

curl http://localhost:4040/health
curl http://localhost:4040/quote/XAUUSD          # note: bid is under .quote.bid

# stream test
npx wscat -c ws://localhost:4040/stream
> {"action":"subscribe","symbol":"XAUUSD"}
```

Provider credentials live in the `ws_api_keys` **table**, not in `.env`. Seed them with
[fxincapws/sql/seed_ws_api_keys.sql](../fxincapws/sql/seed_ws_api_keys.sql), then set the key through
the admin UI or directly:

```sql
UPDATE ws_api_keys SET api_key = 'YOUR_API_KEY', enabled = TRUE WHERE provider = 'twelvedata';
UPDATE ws_api_keys SET enabled = FALSE WHERE provider <> 'twelvedata';
```

`finnhub` is the seeded default but emits no `bid`/`ask`, so nothing renders while it is active —
enable `twelvedata` for realistic local behaviour. See
[MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) §3.

## 9. Database work

There is no migration runner. Apply migrations by hand:

```bash
psql "$DATABASE_URL" -f fxincapapi/migrations/001_multi_account_support.sql
psql "$DATABASE_URL" -f fxincapapi/migrations/002_adm_settings.sql
psql "$DATABASE_URL" -f fxincapapi/migrations/004_trade_indexes.sql
```

`001_multi_account_support.sql` must run as the cluster **owner**, not the application role. The
files numbered `001_admin_auth_schema.sql` and `create_beneficiaries_table.sql` are MySQL DDL and
will not execute on PostgreSQL. See [DATABASE.md](./DATABASE.md) §2.

Many tables are created lazily at runtime, so a fresh database partly self-populates on first boot.

## 10. Conventions

- **Package manager:** pnpm. Never commit a `package-lock.json`.
- **Modules:** fxincapapi / fxincaptrade / fxincapws are ESM. In fxincapapi TypeScript, import with
  an explicit `.js` extension (`from "./routes/auth.js"`) even though the source is `.ts`.
- **SQL:** PostgreSQL `$1` placeholders. `?` placeholders are MySQL-era legacy; `database.ts` has a
  compatibility shim but do not write new `?` SQL.
- **API responses:** `{ success, ... }` / `{ success: false, error }`.
- **Commits:** use the template — `git config commit.template .gitmessage.txt`. Do not use
  `deploy-remote.ps1`, which auto-generates `fc<timestamp>` messages
  ([GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md) §3).
- **Branch:** work on a feature branch off `main` and open a PR. `main` is the deployment branch;
  `origin/dev` is vestigial and must not be used. See [GIT_WORKFLOW.md](./GIT_WORKFLOW.md).

## 11. Before opening a pull request

```bash
cd fxincapapi   && ./node_modules/.bin/tsc --noEmit
cd fxincaptrade && ./node_modules/.bin/tsc --noEmit
cd fxincapws    && node --check src/server.js src/config.js src/db.js src/providers/*.js
# then build every service you touched
```

There are no tests and no CI. Manual verification is the only gate — see
[TESTING.md](./TESTING.md).

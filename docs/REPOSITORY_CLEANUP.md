# Repository Cleanup Audit

Every candidate file was classified before any deletion. **A file was deleted only when its absence
from every runtime path could be proven** — from PM2 configs, shell scripts, package scripts, import
graphs and grep. Anything unprovable was kept.

Status vocabulary: `USED` · `PRODUCTION REQUIRED` · `DEVELOPMENT ONLY` · `DOCUMENTATION ONLY` ·
`DUPLICATE` · `LEGACY` · `UNUSED` · `UNKNOWN`.

---

## 1. Deleted

| File | Status | Evidence | Action |
| --- | --- | --- | --- |
| `fxincapapi/tmp_db_check.js` | UNUSED · DUPLICATE | byte-identical to `tmp_db_check.cjs`; no reference in any script, package.json or import | DELETE |
| `fxincapapi/tmp_db_check.cjs` | UNUSED | one-off privilege probe; hard-codes the production DB host/user and reads `F:/app/fxfx/ca-certificate.crt` — a path that exists only on one developer's machine | DELETE |
| `fxincapapi/tmp_grant_status.cjs` | UNUSED | same: one-off `GRANT` inspection, same unreachable CA path | DELETE |
| `fxincapapi/tmp_grant_fix.mjs` | UNUSED | same: one-off `GRANT` execution, same unreachable CA path | DELETE |
| `fxincapapi/check_balance.js` | UNUSED · LEGACY | `require("mysql2/promise")` against the **MySQL** cluster the platform no longer uses; hard-codes a user UUID; CommonJS `require` in a `"type":"module"` package, so it cannot run | DELETE |
| `fxincapapi/test-email.mjs` | UNUSED | imports `node-fetch`, which is not a dependency of the package → cannot execute; targets `localhost:4000`, not the API's port | DELETE |
| `fxincapapi/src/routes/user.ts` | UNUSED · LEGACY | 3-line re-export shim (`export { default } from "./user_v2.js"`). `index.ts` imports `user_v2.js` directly; grep finds no importer. Verified by a clean `tsc --noEmit` after removal | DELETE |
| `fxincapws/ecosystem.config.js` | DUPLICATE · UNUSED | byte-identical to `ecosystem.config.cjs`; `fxincapws/package.json` declares `"type": "module"`, so PM2 cannot `require()` a `.js` ecosystem file — it would throw `ERR_REQUIRE_ESM`. The `.cjs` twin is kept | DELETE |
| `fxincapws/schema/api_keys_init.sql` | UNUSED · LEGACY | MySQL DDL (`AUTO_INCREMENT`, `ENGINE=InnoDB`, `INSERT IGNORE`) for a table named `api_keys`. The code uses PostgreSQL and a table named **`ws_api_keys`**; grep finds no reference to this file or to `api_keys` (without the `ws_` prefix) anywhere in the source. Superseded by `sql/seed_ws_api_keys.sql` | DELETE |
| `fxincapws/README-old.md` | LEGACY · DOCUMENTATION ONLY | describes "suimfx-ws" on port 6000 with a MySQL `.env`; every fact is wrong for the current service. Superseded by the rewritten `README.md` | DELETE |
| `fxincapws/IMPLEMENTATION.md` | LEGACY · DOCUMENTATION ONLY | stale build summary; documents the MySQL `api_keys` table, port 6000, and a file `components/admin/ProvidersAdmin.tsx` that does not exist in the repository. Superseded by [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) | DELETE |
| `fxincaptrade/env.example` | DUPLICATE · LEGACY | third env template in one directory. Documents **MySQL** (`DB_PORT=3306`, `DB_NAME=forex_final`, `root`) while the service uses PostgreSQL via `pg`. Superseded by `.env.example` (current) and `.env.production.example` | DELETE |
| `fxincap/package-lock.json` | DUPLICATE · UNUSED | see §2 (lock files) | DELETE |
| `fxincapadmin/package-lock.json` | DUPLICATE · UNUSED | " | DELETE |
| `fxincapapi/package-lock.json` | DUPLICATE · UNUSED | " | DELETE |
| `fxincaptrade/package-lock.json` | DUPLICATE · UNUSED | " | DELETE |
| `fxincapws/package-lock.json` | DUPLICATE · UNUSED | " | DELETE |
| `fxincapadmin/client/pnpm-lock.yaml` | DUPLICATE · UNUSED | shadowed nested workspace lockfile — see §2 | DELETE |

**17 files deleted. No source file with a live runtime path was removed.**

## 2. Lock file audit (Phase 9)

**pnpm is authoritative.** Evidence:

| Signal | Finding |
| --- | --- |
| `install-prod.sh` | `pnpm install --frozen-lockfile` in all five services |
| `install-staging.sh` | identical |
| `run-prod.sh` | `pm2 start pnpm --name fxincap-app … -- start` |
| `ecosystem.production.portable.cjs` | `script: "pnpm"` for the app and admin processes |
| `fxincaptrade/package.json` | `"packageManager": "pnpm@10.14.0+sha512…"` |
| `fxincapadmin/pnpm-workspace.yaml` | pnpm workspace with `client` + `server` |
| `dev-all.ps1` | `pnpm dev` for every service |
| CI | none exists — no workflow files in the repository |
| Docker | none exists |

No script, config or documented workflow invokes `npm install` or `npm ci`. The five service-level
`package-lock.json` files were therefore never consumed, and having both lockfiles risks a developer
resolving a different dependency tree than production builds.

`fxincapadmin/client/pnpm-lock.yaml`: the workspace lockfile at `fxincapadmin/pnpm-lock.yaml`
contains both importers (`.` and `client`), which is what `pnpm install --frozen-lockfile` in
`fxincapadmin/` — the exact command `install-prod.sh` runs — consumes. pnpm ignores nested lockfiles
inside a workspace, so the `client` copy is dead weight that can drift out of sync.

**Kept: the root `package-lock.json`.** It matches the root `package.json` (which has one dependency,
`bcryptjs`). No deploy script installs root dependencies, so it is almost certainly vestigial — but
"almost certainly" is not proof, and a human may run `npm ci` at the root. Classified `UNKNOWN`,
kept. See §5.

## 3. Kept — production required

| File / directory | Status | Evidence |
| --- | --- | --- |
| `deploy-prod.sh`, `install-prod.sh`, `run-prod.sh` | PRODUCTION REQUIRED | the live webhook deploy chain |
| `deploy/webhook-server.cjs` | PRODUCTION REQUIRED | PM2 process `fxincap-deploy-webhook` |
| `.deploy.env.example`, `setup-server-deploy-env.sh` | PRODUCTION REQUIRED | server configuration bootstrap |
| `ecosystem.production.portable.cjs` | PRODUCTION REQUIRED | declarative PM2 definition |
| `ecosystem.staging.portable.cjs`, `install-staging.sh`, `run-staging.sh` | USED | staging path; ports mirror production |
| `fxincapws/src/**` | PRODUCTION REQUIRED | `fxincap-ws` entry point |
| `fxincapws/sql/seed_ws_api_keys.sql` | USED | referenced by an error message in `src/db.js` |
| `fxincapapi/migrations/*.sql` | PRODUCTION REQUIRED | the three PostgreSQL migrations are the real schema source; the MySQL ones are historical reference |
| `fxincapapi/src/lib/schema.sql` | DOCUMENTATION ONLY | MySQL DDL, not runnable on PostgreSQL — kept as the only full table reference |
| `fxincapapi/uploads/.gitkeep`, `fxincaptrade/uploads/.gitkeep` | PRODUCTION REQUIRED | `.gitignore` relies on them to keep the directories |
| `LICENSE` | KEEP | Apache License 2.0 |

## 4. Kept — legacy but reachable at runtime

| File | Status | Why kept |
| --- | --- | --- |
| `fxincaptrade/server/**` (routes, `trading-engine.ts`, `price-service.ts`, `mockData.ts`, `db.js`) | LEGACY · PRODUCTION REQUIRED | PM2 runs `dist/server/start.js`, built from `server/start.ts` → `server/index.ts`, which imports all of them. The trading routes are non-functional (MySQL-style SQL on a `pg` pool) but the process serves `dist/spa` and **must keep starting**. Deleting any of it breaks the build. See [ARCHITECTURE.md](./ARCHITECTURE.md) §3 |
| `fxincapapi/src/routes/positions.ts` | LEGACY | registered at `/api/positions`; parallel to `/api/trades` but live |
| `fxincapapi/src/routes/prices.ts` | LEGACY | mounted; `/crypto` is used by the dashboard ticker, `/` and `/:symbol` are stubs |
| `fxincapws/src/providers/binance.js` | UNUSED (but referenced) | a no-op stub, yet `createProviderInstance()` returns it as the fallback branch. Removing it breaks `server.js` |
| `fxincapws/ecosystem.config.cjs` | UNKNOWN | targets `/home/fxincapws/htdocs/ws.fxincap.com` — a different layout from `run-prod.sh`. May be the live definition. `TODO: verify on production server` |
| `fxincapadmin/ecosystem.config.cjs`, `fxincaptrade/ecosystem.config.cjs`, `fxincapapi/ecosystem.config.cjs`, `fxincap/ecosystem.config.js` | UNKNOWN | same reasoning |
| `fxincapadmin/client/src/components/ui/{button,card,label,select,table}.jsx` + `.tsx` twins, `lib/utils.js` + `.ts` | UNKNOWN | JSX/TSX pairs of the same component. The build resolves one; determining which requires a bundle trace. Low value, non-zero risk — kept |

## 5. Kept — cannot prove unused

| File | Status | Why kept |
| --- | --- | --- |
| `deploy-remote.ps1` | LEGACY · UNKNOWN | pushes and runs `ssh kaka "bash /var/www/deploy.sh"` — a deploy path that predates the webhook and is not described anywhere else. It is also the source of the `fc<timestamp>` commit messages ([GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md) §3). Recommend retiring, but the developer may still use it |
| `server-setup.sh` | DOCUMENTATION ONLY | one-time provisioning; contains a server IP and deploy username (noted in [SECURITY.md](./SECURITY.md) §8) |
| `fxincap/script.sh`, `fxincapadmin/script.sh`, `fxincapapi/script.sh`, `fxincaptrade/script.sh`, `fxincap/clean_pm2_logs.sh` | LEGACY · UNKNOWN | PM2 log cleaners for `/home/suimfx*/htdocs/*.suimfx.world` paths. If the live server still uses that layout they are live cron targets |
| `scripts/*.ps1` (`auto-sync`, `publish-github`, `setup-autosync-task`, `setup-git-workflow`, `smart-commit`) | DEVELOPMENT ONLY | local Windows developer workflow; harmless |
| `scripts/backfill-selected-trading-mode-for-real-accounts.sql` | DOCUMENTATION ONLY | one-time backfill; keep as a record of what was run |
| `fxincaptrade/test-deposit-withdraw.sh` | DEVELOPMENT ONLY | manual API smoke script |
| `fxincapapi/migrate.js` | LEGACY · UNKNOWN | runs only the MySQL `001_admin_auth_schema.sql` and imports from `./dist`. Probably obsolete, but it is the only migration runner that exists |
| `fxincaptrade/deploy/nginx-trade.example.conf` | DOCUMENTATION ONLY | the repository's only nginx reference |
| `.cursor/`, `.vscode/`, `.claude/` | DEVELOPMENT ONLY | editor/tooling config; `.gitignore` already excludes `.vscode/*` except `settings.json` |
| root `package-lock.json` | UNKNOWN | see §2 |
| `.gitmessage.txt` | DEVELOPMENT ONLY | commit template; recommended for adoption |
| `docs/version-control-guide.md` | DOCUMENTATION ONLY | pre-existing developer guide; retained unchanged |

## 6. Rewritten rather than deleted

| File | Change |
| --- | --- |
| `fxincapws/README.md` | Every operational fact was wrong: it documented MySQL, port 6000 and the `api_keys` table. Rewritten to describe PostgreSQL, port 4040 and `ws_api_keys`, and to point at `docs/` |
| `DEPLOYMENT.md` (root) | Content migrated and expanded into [docs/DEPLOYMENT.md](./DEPLOYMENT.md). The root file is now a pointer — kept because [deploy-prod.sh](../deploy-prod.sh) prints `see DEPLOYMENT.md` in its error path, and modifying a production script was out of scope |
| `.gitignore` | Extended — see [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) §4 |

## 7. Deliberately not touched

- **`fxincapapi/uploads/` history.** The working tree is clean (`.gitkeep` only) and `.gitignore`
  covers `uploads/**`. The historical blobs require a history rewrite, which was out of scope —
  see [SECURITY.md](./SECURITY.md) §7.
- **Branches.** `dev-clean` and `live-server-updates` are fully merged into `main` but were not
  deleted.
- **Unused dependencies.** `socket.io`, `metaapi.cloud-sdk`, `mysql2`, `better-sqlite3`, `sql.js`,
  `bcryptjs` (root) are declared but unimported. Removing them changes lockfiles and therefore
  `--frozen-lockfile` deploys — deferred.
- **Duplicate route registrations** in `user_v2.ts` (`/beneficiaries`, `/beneficiary`, `/accounts`
  declared twice). Dead code, but editing a live route file was out of scope.

## 8. Verification performed after deletion

```
fxincapapi   tsc --noEmit        exit 0
fxincapapi   tsc (build)         exit 0
fxincaptrade tsc --noEmit        exit 0
fxincaptrade vite build ×2       exit 0
fxincapadmin vite build          exit 0
fxincap      next build          exit 0
fxincapws    node --check ×7     all OK
fxincapws    boot + GET /health  200
```

Full results in [BASELINE.md](./BASELINE.md).

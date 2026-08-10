# Changelog

Notable changes to the FXIncap platform. Entries before 2026-08-10 are reconstructed from git history
and are therefore summaries, not exhaustive records — 11 of the 15 commits carry no descriptive
message (see [GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md)).

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). The project does not use
semantic versioning; there are no tags or releases.

---

## [Unreleased] — 2026-08-10 — Documentation & repository baseline

Documentation, audit and safe cleanup only. **No application logic, authentication, database schema,
production configuration or market-data behaviour was changed.**

### Added
- `README.md` — complete platform overview
- `docs/SYSTEM_OVERVIEW.md` — responsibilities, data ownership, boundaries, failure behaviour, glossary
- `docs/GIT_WORKFLOW.md` — two-PC development workflow, branch model, collision avoidance, recovery
- `docs/ARCHITECTURE.md` — service topology and request lifecycles
- `docs/MARKET_DATA_ARCHITECTURE.md` — provider pipeline and the integration point for a future provider
- `docs/TRADING_ENGINE.md`, `docs/PNL_ENGINE.md` — formulas traced from source
- `docs/API.md`, `docs/WEBSOCKET.md`, `docs/DATABASE.md`
- `docs/AUTHENTICATION.md`, `docs/ADMIN.md`, `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`, `docs/ENVIRONMENT.md`, `docs/DEVELOPMENT.md`
- `docs/TESTING.md`, `docs/BASELINE.md`, `docs/TROUBLESHOOTING.md`
- `docs/REPOSITORY_STRUCTURE.md`, `docs/REPOSITORY_CLEANUP.md`, `docs/GIT_HISTORY_AUDIT.md`
- `docs/ADR/0001-system-architecture.md`, `0002-market-data-provider.md`, `0003-production-deployment.md`
- `docs/README.md` — documentation index

### Changed
- `fxincapws/README.md` rewritten — the previous version documented MySQL, port 6000 and an
  `api_keys` table; the service actually uses PostgreSQL, port 4040 and `ws_api_keys`
- Root `DEPLOYMENT.md` reduced to a pointer at `docs/DEPLOYMENT.md` (kept because `deploy-prod.sh`
  references it by name)
- `.gitignore` extended: build artefacts, pnpm caches, PM2 runtime state, TLS material, tool caches,
  editor residue. Verified that no tracked file became ignored

### Removed
17 files, each proven unreachable from every runtime path — full evidence table in
[REPOSITORY_CLEANUP.md](./REPOSITORY_CLEANUP.md):
- 6 one-off developer scripts in `fxincapapi/` (`tmp_db_check.{js,cjs}`, `tmp_grant_{fix.mjs,status.cjs}`,
  `check_balance.js`, `test-email.mjs`) — several hard-coded production DB coordinates and an
  absolute path from one developer's machine
- `fxincapapi/src/routes/user.ts` — unreferenced re-export shim
- `fxincapws/ecosystem.config.js` — duplicate of the `.cjs` twin, unloadable in an ESM package
- `fxincapws/schema/api_keys_init.sql` — MySQL DDL for a table the code does not use
- `fxincapws/README-old.md`, `fxincapws/IMPLEMENTATION.md` — superseded stale docs
- `fxincaptrade/env.example` — third, MySQL-era env template
- 5 service-level `package-lock.json` files and `fxincapadmin/client/pnpm-lock.yaml` — pnpm is the
  authoritative package manager

### Security
Audit performed; **nothing fixed** — the brief excluded changes to authentication and production
behaviour. Findings in [SECURITY.md](./SECURITY.md):
- 🚨 **Customer KYC documents and deposit screenshots are recoverable from git history** (382 files
  added in the root commit, deleted from the working tree in `52fc638`). Requires containment,
  a history rewrite, and a legal assessment
- All 69 `/api/admin/*` endpoints lack any admin role check
- Three trade-mutating API endpoints have no authentication
- Hard-coded production database coordinates as fallback defaults in five files
- Insecure default secrets (`JWT_SECRET` → `"secret"`, `ADMIN_TOKEN` → `changeme-admin-token`)
- `GET /admin/settings` on fxincap-ws returns the provider API key without a token check
- **No committed credentials were found**, and no credential rotation is required from this audit

### Corrected
- **`origin/dev` is not the deployment branch.** An earlier reading took the `DEPLOY_BRANCH=dev`
  code default at face value. `origin/dev` in fact branched at the root commit, carries only three
  **empty** webhook-test commits, and contains **none** of the deploy chain (`deploy-prod.sh`,
  `install-prod.sh`, `run-prod.sh`, `deploy/`). Deploying from it would delete those scripts from the
  server via `git reset --hard`. `main` is the real deployment branch; the live `.deploy.env` must
  override the default. Corrected in DEPLOYMENT, ENVIRONMENT, DEVELOPMENT, TROUBLESHOOTING,
  GIT_HISTORY_AUDIT, ADR-0003 and README.

### Known defects documented (not fixed)
- Server-side SL/TP never fires: the worker reads `data.bid` where the API returns `data.quote.bid`
- Same bug in the frontend HTTP quote fallback
- `FinnhubProvider` emits no `bid`/`ask`, so prices are dropped while it is active — and it is the
  seeded default
- `trades.pnl` is never written for open trades; `updateTradeRealtime()` is dead code
- `user_accounts.equity` is never recomputed from open P&L

---

## 2026-06-20 — `0b7e87b`
Unlabelled changes (auto-generated commit message).

## 2026-06-13 — `b6f618b`
### Added
- IB Program: partner applications, commission levels, referral links, sub-agents
- MAM/PAM copy trading: master accounts, follower subscriptions, admin approval
- Supporting API routes (`/api/ib`, `/api/mam`, `/api/pamm`, `/api/user/mampam/*`), admin pages and
  trading-client pages

## 2026-05-11 → 2026-06-01 — `bbe0004`, `9c6ccae`, `303cf65`, `d9c1852`, `76d3105`, `3006030`, `703680c`, `6f2fce0`, `7dd39ae`
Eight commits with placeholder or auto-generated messages. Content not reconstructable from the log.

## 2026-04-04 — `d24b7d4`
### Changed
- Trading engine, orders and trades API updates; terminal UI refresh

## 2026-04-04 — `4430f0a`
### Added
- Trading mode (demo/real) selection and environment handling
- `user_v2` API routes
- Admin server settings
- WebSocket service adjustments

## 2026-04-02 — `52fc638`
### Added
- Deployment scripts (`deploy-prod.sh`, `install-prod.sh`, `run-prod.sh`)
### Changed
- Trade platform top-bar colour in light mode
### Removed
- 380 user upload files from the working tree (they remain in git history — see
  [SECURITY.md](./SECURITY.md) §7)

## 2026-03-31 — `1d95474` — Initial import
Root commit. Full monorepo import: all five services, deployment tooling, CI workflows (since
removed) and 382 user upload files (since deleted from the working tree, still in history).

# Build & Test Baseline

Established **before** and re-verified **after** the repository cleanup, so any future regression can
be attributed. Machine: Windows 11, Node **v24.18.0**, pnpm **11.18.0**, npm 11.16.0. Date: 2026-08-10.

> Production runs Node 18+ per [server-setup.sh](../server-setup.sh). These results are from a
> Node 24 developer machine — a version difference to keep in mind.
> `TODO: verify on production server` which Node version is live.

## 1. Results

| Service | Install | Typecheck | Build | Lint | Tests |
| --- | --- | --- | --- | --- | --- |
| `fxincap` | PASS | ⚠ SKIPPED BY CONFIG | **PASS** | NOT RUN | NOT AVAILABLE |
| `fxincapadmin` | PASS | NOT AVAILABLE | **PASS** | NOT AVAILABLE | NOT AVAILABLE |
| `fxincapapi` | PASS | **PASS** | **PASS** | NOT AVAILABLE | NOT AVAILABLE |
| `fxincaptrade` | PASS | **PASS** | **PASS** | **FAIL** (formatting only) | NOT AVAILABLE |
| `fxincapws` | PASS | N/A (plain JS) | N/A (no build step) | NOT AVAILABLE | NOT AVAILABLE |

Every result above is identical across three runs: **before** the file deletions in
[REPOSITORY_CLEANUP.md](./REPOSITORY_CLEANUP.md), **after** them, and **again** on the
`docs/repository-audit` branch before commit. No regression was introduced.

## 2. Detail

### fxincapapi — the critical service

```
pnpm install --frozen-lockfile        exit 0
./node_modules/.bin/tsc --noEmit      exit 0   (no output)
./node_modules/.bin/tsc               exit 0   → dist/{index.js,lib,routes,services}
./node_modules/.bin/eslint src        exit 2   "ESLint couldn't find a configuration file"
```

- **Lint: NOT AVAILABLE.** `package.json` declares `"lint": "eslint src --ext .ts"` and pulls in
  eslint 8 + the TS plugin, but no `.eslintrc*` or `eslint.config.*` exists. The script has never
  been runnable.
- **Tests: NOT AVAILABLE.** `"test": "vitest"` is declared and `vitest ^1.6.1` is installed, but the
  repository contains **zero** test files (`git ls-files | grep -E '\.(test|spec)\.'` → empty).

### fxincaptrade

```
./node_modules/.bin/tsc --noEmit      exit 0
npm run build                         exit 0
    vite build            → dist/spa   (2365 modules, index ~857 kB / 235 kB gzip)
    vite build --ssr      → dist/server/start.js  (72 kB)
./node_modules/.bin/prettier --check .  → "Code style issues found in 95 files"
./node_modules/.bin/vitest --run        → "No test files found, exiting with code 1"
```

- **Lint: FAIL, cosmetic only.** `"lint": "tsc --noEmit && npm run format:check"`. The typecheck half
  passes; `prettier --check` flags 95 files. This is pre-existing formatting drift, **not** a code
  defect. Running `prettier --write .` would touch ~95 files and swamp this documentation commit, so
  it was deliberately not run.
- The SSR build output `dist/server/start.js` matches what PM2 executes (`node dist/server/start.js`).

### fxincapadmin

```
pnpm install --frozen-lockfile           exit 0   (workspace: root + client + server)
client: ./node_modules/.bin/vite build   exit 0   → client/dist (~842 kB / 236 kB gzip)
```

No typecheck, lint or test script exists in either workspace package. The server has no build step
(`"build": "echo \"No build step for server\""`).

### fxincap (marketing)

```
pnpm install --frozen-lockfile     exit 0
./node_modules/.bin/next build     exit 0   Next.js 16.2.1 (Turbopack), 3 static pages
```

⚠ Build output includes **`Skipping validation of types`** — [next.config.ts](../fxincap/next.config.ts)
sets `typescript: { ignoreBuildErrors: true }`. The build therefore cannot fail on a type error.
`"lint": "next lint"` is declared but was not run; `eslint.config.mjs` does exist here.

### fxincapws

No build step and no TypeScript.

```
node --check src/server.js src/config.js src/db.js src/providers/*.js    all OK (7 files)
```

## 3. Runtime smoke tests

### fxincapws boots and serves health

```
$ WS_PORT=4142 node src/server.js
$ curl http://127.0.0.1:4142/health
{"status":"ok","provider":"finnhub","provider_status":"error",
 "provider_error":"apiKey is required","provider_candidates":["finnhub"],
 "ws_clients":0,"uptime_seconds":6}
```

**PASS** — the service starts, the HTTP listener responds, and it degrades gracefully with no
database and no provider credential. `provider_status: "error"` is the correct report for an
unconfigured environment.

### fxincapapi / fxincaptrade / fxincapadmin startup

**NOT RUN.** Starting them requires database credentials that only exist on the production server.
Both TypeScript services compile to the exact artefacts PM2 executes
(`fxincapapi/dist/index.js`, `fxincaptrade/dist/server/start.js`), which is the strongest signal
obtainable off-server.

`TODO: verify on production server`:

```bash
pm2 status
curl http://127.0.0.1:7000/api/ping       # expect {"message":"pong",...}
curl http://127.0.0.1:4040/health         # expect provider_status:"ready"
curl http://127.0.0.1:5001/health
curl http://127.0.0.1:3000/api/ping
```

## 4. Notable observation from the smoke test

Booting fxincapws locally with **no configuration at all** produced:

```
[fxincap-ws] initSettingsTable failed, continuing without DB table sync:
             password authentication failed for user "…"
```

The service attempted to reach a **real production database host**, because
[fxincapws/src/config.js](../fxincapws/src/config.js) hard-codes it as a fallback. Only the missing
password stopped the connection. Recorded as [SECURITY.md](./SECURITY.md) §3.

## 5. Functional areas that could not be verified locally

| Area | Status | Reason |
| --- | --- | --- |
| TwelveData live feed | NOT VERIFIED | requires a real API key |
| Finnhub live feed | NOT VERIFIED | requires a real API key |
| WebSocket `/stream` end-to-end | NOT VERIFIED | needs an active provider |
| REST `/quote/:symbol` fallback | NOT VERIFIED | " |
| Database connectivity | NOT VERIFIED | credentials are server-only |
| Trading open/close | NOT VERIFIED | needs the database |
| P&L settlement | NOT VERIFIED | " |
| Admin UI end-to-end | NOT VERIFIED | needs API + DB |

Static review of these paths is in [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md),
[TRADING_ENGINE.md](./TRADING_ENGINE.md) and [PNL_ENGINE.md](./PNL_ENGINE.md).

## 6. Defects found by reading, not by running

The toolchain is green, so these are invisible to the build and would only surface in production:

| # | Defect | Where |
| --- | --- | --- |
| 1 | SL/TP worker reads `data.bid`; the API returns `data.quote.bid` → server-side SL/TP never fires | [trading-engine.ts:541](../fxincapapi/src/lib/trading-engine.ts#L541) |
| 2 | Same bug in the frontend HTTP quote fallback | [useMarketStream.ts:50](../fxincaptrade/client/hooks/useMarketStream.ts#L50) |
| 3 | `FinnhubProvider` emits no `bid`/`ask` → prices are dropped whenever Finnhub is the active provider (and it is the seeded default) | [finnhub.js](../fxincapws/src/providers/finnhub.js) |
| 4 | `trades.pnl` is never written for open trades; `updateTradeRealtime()` is dead code | [PNL_ENGINE.md](./PNL_ENGINE.md) §3 |
| 5 | `user_accounts.equity` is never recomputed from open P&L | [PNL_ENGINE.md](./PNL_ENGINE.md) §5 |
| 6 | Three trade-mutating API endpoints have no authentication | [SECURITY.md](./SECURITY.md) §2 |
| 7 | All 69 `/api/admin/*` endpoints lack an admin role check | [SECURITY.md](./SECURITY.md) §1 |

**None were fixed.** Each changes live trading, authentication or production behaviour and needs
explicit approval plus a staging test.

## 7. Recommended baseline improvements

1. Add an ESLint config to `fxincapapi` so its declared `lint` script runs.
2. Add the first tests — `calculatePnL` and `getRequiredMargin` are pure functions and are the
   highest-value, lowest-effort place to start.
3. Run `prettier --write .` in `fxincaptrade` as its own isolated commit.
4. Remove `typescript.ignoreBuildErrors` from `fxincap/next.config.ts` once its type errors are fixed.
5. Add typecheck scripts to the `fxincapadmin` workspace packages.
6. Add CI that runs install + typecheck + build for all five services on pull requests.

## 8. Reproducing this baseline

```bash
# per service
cd <service> && pnpm install --frozen-lockfile

fxincapapi:    ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/tsc
fxincaptrade:  ./node_modules/.bin/tsc --noEmit && npm run build
fxincapadmin:  (cd client && ./node_modules/.bin/vite build)
fxincap:       ./node_modules/.bin/next build
fxincapws:     node --check src/server.js src/config.js src/db.js src/providers/*.js
```

Invoke the binaries directly rather than through `pnpm run`: pnpm 11's dependency-status precheck
aborts these packages with `ERR_PNPM_IGNORED_BUILDS` (esbuild postinstall scripts are not approved),
which masks the real exit code. This is a local pnpm-version artefact, not a repository defect.

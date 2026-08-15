# Development Handover

State of the work as of the latest commit on `feature/infoway-market-data`.
Read this first when picking the project up on another PC, then follow the links —
this file records **state and next steps only** and does not repeat the other documents.

---

## 1. Git state

| | |
| --- | --- |
| Active branch | `feature/infoway-market-data` |
| Based on | `fix/security-and-pnl` → `docs/repository-audit` → `main` |
| Working tree | clean |
| `main` | `0b7e87b`, identical to `origin/main` — **never committed to** |

Branches on GitHub, none merged:

```
main                          0b7e87b   production baseline, untouched
docs/repository-audit         de4ad41   documentation + repo baseline
fix/security-and-pnl          7b1be48   security + P&L remediation
feature/infoway-market-data   HEAD      Infoway provider  ← active
```

Each branch contains the one before it, so `feature/infoway-market-data` carries all
8 commits. Merging it alone brings everything.

## 2. Completed work

**Documentation & audit** (`docs/repository-audit`) — full architecture, API, database,
trading and deployment documentation; 17 conclusively-unused files removed; `.gitignore`
extended. See [CHANGELOG.md](./CHANGELOG.md).

**Security & P&L** (`fix/security-and-pnl`) — five commits:

- `requireAdmin` on `/api/admin/*`; previously any customer JWT was accepted on
  endpoints that set balances and impersonate traders
- `requireInternalService` on the three trade endpoints that had no authentication
- Insecure fallbacks removed (`JWT_SECRET="secret"`, `changeme-admin-token`,
  hard-coded production database coordinates); services now fail fast at boot
- fxincap-ws admin routes gated + provider API keys redacted out of responses
- **Server-authoritative pricing**: the client no longer supplies `entryPrice` or
  `closePrice`; a price-sync worker values open positions and recomputes equity.
  Fixed along the way: SL/TP never fired (`data.bid` vs `data.quote.bid`), the same
  bug in the frontend fallback, `trades.pnl` never written, equity never recomputed,
  `getRequiredMargin()` returning 0 on bad input, auto-close settling at entry price

Details: [SECURITY.md](./SECURITY.md), [PNL_ENGINE.md](./PNL_ENGINE.md),
[TRADING_ENGINE.md](./TRADING_ENGINE.md).

**Infoway provider** (`feature/infoway-market-data`) — see §3.

## 3. Infoway implementation

| | |
| --- | --- |
| Adapter | `fxincapws/src/providers/infoway.js` |
| Raw socket | `fxincapws/src/providers/infoway-ws.js` |
| Tests | `fxincapws/src/providers/infoway.test.js` |
| Registered in | provider factory, `SUPPORTED_RUNTIME_PROVIDERS`, `CONFIGURABLE_PROVIDERS`, failover order, boot seed, `sql/seed_ws_api_keys.sql` |
| Admin panel | appears automatically (the provider table is data-driven); key editable under Server Settings → Providers |
| Enabled? | **Yes, in production** — see the status note below |

> **Status correction (2026-08-15).** This section previously read "seeded
> `enabled = FALSE`". That is no longer true. Infoway is **live in production**
> and is the active provider (`/health` reports `"provider":"infoway"`,
> `"provider_status":"ready"`, with `common` and `crypto` sockets connected).
> TwelveData is now the fallback, not the active feed. §9's warning about not
> enabling Infoway is therefore historical — it has already happened.
>
> It is serving prices, but **rate-limiting is degrading it**: see §6a.

**REST** — `GET {base}/{business}/batch_depth/{codes}` (bid/ask) and `/batch_trade/{codes}`
(last). Auth via the **`apiKey` request header**.

**WebSocket** — `wss://data.infoway.io/ws?business=<b>&apikey=<key>`; depth subscribe
`10003` → push `10005`, trade subscribe `10000` → push `10002`, heartbeat `10010` every
30 s. 60 requests/minute per connection.

Depth is primary because the trade channel carries no bid/ask. One socket per asset
class (`common` = forex/metals, `crypto`, `stock`, …), created lazily, reconnecting with
exponential backoff and escalating to the existing failover chain.

Protocol table: [MARKET_DATA_ARCHITECTURE.md §7a](./MARKET_DATA_ARCHITECTURE.md).

## 4. Test results (last run, this branch)

```
fxincapws   node --test infoway.test.js     27/27 PASS
fxincapapi  vitest --run                    16/16 PASS
fxincapapi  tsc --noEmit                    PASS
fxincapadmin client vite build              PASS
```

Endpoint shapes confirmed **live**, without a key:

```
GET https://data.infoway.io/common/batch_depth/EURUSD
   no header    → 401 {"code":401,"message":"Unauthorized"}     (path exists)
   bogus apiKey → 401 {"code":401,"message":"Token invalid"}    (header is read)
wss://data.infoway.io/ws?business=common&apikey=invalid
   → handshake rejected 401                                     (URL + query auth valid)
```

**Not yet tested:** live REST quotes, live WS ticks, and the full
fxincapws → fxincapapi → trading path. Both need a real API key and a database.

## 5. TwelveData status

**Intact and unchanged.** `twelvedata.js`, `twelvedata-ws.js`, `finnhub.js` and
`binance.js` have zero diff on this branch.

Failover order is now `infoway → twelvedata → finnhub → binance`, putting two-sided
providers ahead of last-price-only Finnhub. Because Infoway is seeded disabled,
**TwelveData remains the working provider and the fallback**. Do not remove it until
Infoway has passed the §7 sequence.

## 6. Infoway limitations / open questions

Two details the official documentation does not specify. Neither was invented:

1. **Unsubscribe protocol is undocumented.** No unsubscribe code is published for
   either channel. `unsubscribe()` removes the subscription **locally** — the callback
   is dropped and ticks stop reaching the platform — and sends nothing upstream. When
   Infoway confirms the message, it goes in `infoway-ws.js removeSymbol()`, the only
   place that needs changing.
2. **Forex/metal symbol codes are unconfirmed.** Crypto is confirmed as `BTCUSDT`
   (concatenated). The forex page lists `EURUSD`/`USDGBP` but also writes `GBP/USD` in
   prose with no worked request. Symbols pass through unchanged. Verify with a live key:
   `curl -H "apiKey: $KEY" "https://data.infoway.io/common/basic/symbols?type=FOREX"`.
   If the codes differ, set `INFOWAY_SYMBOL_MAP` — **do not edit code**.

Also known: 60 requests/min per WS connection, 60 s idle disconnect, 100 codes per REST
request, one connection per asset class.

Symbol codes are now **confirmed working** against the live key — `common/EURUSD`,
`common/GBPUSD` and `crypto/BTCUSDT` all return `ret:200` with bid/ask depth. Item 2
above is resolved; no `INFOWAY_SYMBOL_MAP` is needed.

## 6a. Open production issue: REST rate-limiting

Quotes intermittently return `{"success":false,"error":"Quote unavailable for …"}`.
The cause is **not** bad symbol codes — Infoway returns valid data for every symbol
tested. It is the 60 requests/minute limit being exceeded.

The path that does it:

- `fxincapapi` values positions by polling `GET {WS_QUOTE_BASE_URL}/quote/{symbol}`
  over HTTP, one request per symbol (`market-price.ts`, `price-sync.ts`). It never
  subscribes to the stream.
- `InfowayProvider.getQuote()` serves the streamed cache only while it is under
  10 s old. Otherwise it falls back to REST — `batch_depth`, then `batch_trade`.
- With `PRICE_SYNC_POLL_MS=5000` and a 10 s cache, roughly every second poll of
  every symbol becomes 2 REST calls.

Observed: 37 `Too Many Requests` errors in one log window, across `XAUUSD`, `XAGUSD`,
`USDJPY`, `GBPUSD`, `EURUSD`, `BTCUSDT`, `ETHUSDT` — i.e. every symbol, including the
ones that appear to work. A symbol "works" or not depending on whether its last REST
call happened to land inside the budget.

Directions worth considering (none applied — this is the live trading price path and
needs a deliberate decision):

1. Have the price path **subscribe** to the stream rather than poll `/quote/`, so the
   WS cache stays warm and REST becomes the exception it was designed to be.
2. Batch REST lookups — the endpoint accepts up to 100 codes per request, but
   `getQuote` fetches one symbol at a time.
3. Raise the cache window above the poll interval so a poll cannot outrun the cache.
4. Skip the `batch_trade` call when `batch_depth` already yields bid/ask; it halves
   request volume and `last` is only cosmetic for settlement.

## 7. Current task — next development step

**Test Infoway locally against the real Infoway API and the live SQL database.**

```
Infoway REST → Infoway WebSocket → fxincapws → fxincapapi
   → server-side market price → trading / P&L / SL-TP
```

Order of work:

1. `GET /common/batch_depth/EURUSD` with the real key — confirm the symbol code and the
   response shape
2. `cd fxincapws && npm run dev`, then `curl localhost:4040/quote/XAUUSD` — expect
   `{"success":true,"quote":{"bid":…,"ask":…},"provider":"infoway"}`
3. `wscat -c ws://localhost:4040/stream` → `{"action":"subscribe","symbol":"XAUUSD"}` —
   confirm `type:"last"` ticks carry `bid`/`ask`
4. Start fxincapapi and confirm it resolves a server-side price from fxincapws
5. On a **demo** account only: open BUY, open SELL, check unrealized P&L, set SL/TP,
   close both. Confirm a client-supplied price in the request body is ignored.

### Blocker: selecting Infoway locally

Provider selection is entirely database-driven and the only switch is the shared
`ws_api_keys.enabled` flag — which must not be flipped while pointed at the live
database (§9). A local-only `WS_FORCE_PROVIDER=infoway` override in
`loadProvider()` is the clean fix and is **not yet implemented**. Add it before step 2,
or test the adapter through a local database instead.

## 8. Local `.env` configuration

No `.env` file is tracked; only `.example` templates. Create these locally.

**`fxincapws/.env`** — template at `fxincapws/.env.example`

```
WS_PORT=4040
ADMIN_TOKEN=<any local value; must match WS_ADMIN_TOKEN on the admin server>

PGHOST=<live db host>          # see §9 before pointing at production
PGPORT=25060
PGUSER=<live db user>
PGPASSWORD=<live db password>
PGDATABASE=<live db name>
PGSSLMODE=require

INFOWAY_API_KEY=<local fallback; the authoritative value lives in ws_api_keys>
INFOWAY_REST_URL=https://data.infoway.io
INFOWAY_WS_URL=wss://data.infoway.io/ws
INFOWAY_SYMBOL_MAP=            # only if Infoway's forex codes differ
```

**`fxincapapi/.env`** — required or the service refuses to start:
`JWT_SECRET`, `INTERNAL_SERVICE_TOKEN` (new — cannot already exist anywhere),
`PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (or `DATABASE_URL`).

Note **fxincapws does not support `DATABASE_URL`** — it needs discrete `PG*`/`DB_*`.

Full reference: [ENVIRONMENT.md](./ENVIRONMENT.md).

> ⚠ **The `imp` API key situation got worse before it got better.** The file was not
> merely untracked — it was **committed** in `5c794d9` and reached `main`. This branch
> untracks it and gitignores it, but the key remains recoverable from git history.
>
> The same key was additionally being served **unauthenticated over the public
> internet** from `GET /admin/settings` on `ws.ncapfx.com`, which had no token check
> (its three sibling `/admin` routes did). An nginx `location ~* ^/admin/settings
> { deny all; }` rule now blocks it; the application-level fix is commit `7ce4276`.
>
> **The key must be rotated.** Neither the untracking nor the nginx rule un-leaks what
> was already exposed. Rotate in the Infoway dashboard, then update it via
> Admin → Server Settings → Providers (the authoritative value lives in `ws_api_keys`,
> not a file).

## 9. Live database testing

The live database is **`fxincapmain`** on
`kaka1fxincap-do-user-32897695-0.d.db.ondigitalocean.com:25060`, app role `amitkaka`,
owner role `doadmin`, TLS required. (`forex-final-db-…` / `suim_fx` is the retired
MySQL-era cluster — not live.) Confirm on the server with
`grep -E '^(DATABASE_URL|PGHOST)=' <repo>/fxincapapi/.env`.

Your local IP must be in the DigitalOcean **trusted sources** list or connections hang.

**`ws_api_keys` is shared with production.** Two consequences:

1. **Booting this branch against the live database inserts an `infoway` row**
   (`initSettingsTable()` seeds providers on every boot). This was written when the row
   was benign (`enabled=false`, empty key). **That is no longer the case** — the row now
   exists, is enabled, and carries a live key. See the §3 status correction.
2. **Never set `enabled = true` for Infoway there.** `updateProvider()` runs
   `UPDATE ws_api_keys SET enabled = FALSE WHERE provider <> 'infoway'` in the same
   transaction, disabling TwelveData **for production**. Deployed code doesn't recognise
   `infoway`, so on the next `fxincap-ws` restart it finds nothing enabled, falls back to
   the Finnhub row, and Finnhub publishes no bid/ask → **production prices break**. A
   deploy, crash or memory-limit restart is enough to trigger it.

Setting the **key** is safe. Flipping **enabled** is not.

Testing must not modify real customer or production trading data. Use a **demo** account
for any trading test, and never run write operations against `users`, `user_accounts`,
`trades` or `trade_history` without explicit authorisation.

## 10. Two-PC workflow

GitHub is the only synchronisation channel. Full rules in
[GIT_WORKFLOW.md](./GIT_WORKFLOW.md); the essentials:

```bash
git fetch origin
git switch feature/infoway-market-data
git pull --ff-only origin feature/infoway-market-data
# … work …
git push origin feature/infoway-market-data
```

- Never commit to `main`; merging to `main` **deploys to production**
- Never leave uncommitted work on a PC you walk away from — push, or it is invisible
  to the other machine
- One feature branch per task per PC; do not share a branch name
- `pnpm-lock.yaml` conflicts: take one side and re-run `pnpm install`, never hand-merge
- `origin/dev` is a trap — it holds none of the deploy chain; see
  [GIT_WORKFLOW.md §8](./GIT_WORKFLOW.md)

## 11. Production safety rules

- ❌ No merge to `main`, no deploy, no production config or `.env` change
- ❌ No history rewrite, no force-push to a shared branch
- ❌ Do not remove TwelveData
- ❌ Do not enable Infoway for production
- ❌ Never commit an API key, password or `.env`; keep `.env` gitignored
- ⚠ Before this work can ever deploy: `INTERNAL_SERVICE_TOKEN` and explicit `PG*`
  must exist on the server, or fxincapapi and fxincap-ws will not start. See
  [SECURITY.md](./SECURITY.md) remediation status.
- ⚠ Unresolved: customer KYC documents remain recoverable from git history —
  [SECURITY_INCIDENT_KYC_HISTORY.md](./SECURITY_INCIDENT_KYC_HISTORY.md)

## 12. Documentation index

| Topic | Document |
| --- | --- |
| Where a provider plugs in, Infoway protocol | [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) |
| Security findings and remediation status | [SECURITY.md](./SECURITY.md) |
| KYC history incident | [SECURITY_INCIDENT_KYC_HISTORY.md](./SECURITY_INCIDENT_KYC_HISTORY.md) |
| P&L and server-side pricing | [PNL_ENGINE.md](./PNL_ENGINE.md) |
| Trading engine, SL/TP, margin | [TRADING_ENGINE.md](./TRADING_ENGINE.md) |
| Environment variables | [ENVIRONMENT.md](./ENVIRONMENT.md) |
| Two-PC git workflow | [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) |
| Deployment and its risks | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| System overview and glossary | [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) |
| Everything else | [docs/README.md](./README.md) |

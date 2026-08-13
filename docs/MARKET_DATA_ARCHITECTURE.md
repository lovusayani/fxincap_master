# Market Data Architecture

> This document is the reference for the **next** development phase (replacing the market-data
> provider). It describes the system exactly as it is today and identifies the single integration
> point a new provider such as **Infoway** must plug into.

## 1. The pipeline

```
   ┌──────────────────────────────────────────────────────────────┐
   │ External providers                                            │
   │   wss://ws.finnhub.io                     (trade ticks)       │
   │   wss://ws.twelvedata.com/v1/quotes/price (price events)      │
   │   https://api.twelvedata.com/quote        (REST snapshots)    │
   │   wss://stream.binance.com:9443/ws        (declared, no impl) │
   └────────────────────────┬─────────────────────────────────────┘
                            │
   ┌────────────────────────▼─────────────────────────────────────┐
   │ Provider Adapter        fxincapws/src/providers/*.js          │
   │   FinnhubProvider · TwelvedataProvider · BinanceProvider      │
   │   duck-typed interface: connect/subscribe/unsubscribe/        │
   │                         getQuote/disconnect                   │
   │   responsibilities: transport, reconnect, symbol mapping      │
   └────────────────────────┬─────────────────────────────────────┘
                            │  Normalized Quote (§3)
   ┌────────────────────────▼─────────────────────────────────────┐
   │ FXIncap WebSocket Service   fxincapws/src/server.js           │
   │   provider selection + failover chain (from ws_api_keys)      │
   │   symbol→client fan-out, /stream WS, /quote/:symbol REST,     │
   │   /health, /admin/providers                                   │
   └───┬───────────────────┬──────────────────────┬───────────────┘
       │                   │                      │
       │ WS /stream        │ REST /quote/:symbol  │ REST /quote/:symbol
       ▼                   ▼                      ▼
  ┌──────────┐     ┌──────────────┐      ┌──────────────────┐
  │ Frontend │     │ Frontend     │      │ Trading engine   │
  │ (live    │     │ HTTP quote   │      │ SL/TP worker in  │
  │ prices,  │     │ fallback     │      │ fxincapapi       │
  │ charts)  │     └──────────────┘      └──────────────────┘
  └──────────┘
```

The **P&L engine does not read prices from this pipeline.** Unrealized P&L is computed from
`trades.current_price`, a column written by the client via `POST /api/trades/price-update`, and
realized P&L uses the `closePrice` supplied at close time. See [PNL_ENGINE.md](./PNL_ENGINE.md).

## 2. Provider configuration is database-backed

Table `ws_api_keys` (PostgreSQL), created and seeded on boot by
[fxincapws/src/db.js](../fxincapws/src/db.js) `initSettingsTable()`:

| Column | Purpose |
| --- | --- |
| `provider` | unique key: `finnhub` \| `twelvedata` \| `binance` |
| `api_key` | credential, written through the admin UI |
| `enabled` | exactly one provider is normalized to enabled at boot |
| `endpoint` | informational upstream URL |
| `notes` | free text |
| `updated_at` | tie-break in the ordering |

Seed defaults: `finnhub` enabled, `twelvedata` and `binance` disabled.

Standalone DDL for a fresh database: [fxincapws/sql/seed_ws_api_keys.sql](../fxincapws/sql/seed_ws_api_keys.sql).

**Static ordering.** `PROVIDER_ORDER` in `db.js` hard-codes `finnhub(0) → twelvedata(1) → binance(2)`
via a SQL `CASE` expression. Adding a provider means editing `providerOrderSql()`.

## 3. The normalized quote — the contract that matters

Every adapter must emit this shape. It is the only market-data structure that crosses the
fxincapws boundary.

```js
{
  symbol: "XAUUSD",   // the CLIENT symbol, not the provider symbol
  bid:    4535.12,
  ask:    4537.39,
  mid:    4536.25,
  last:   4536.25,
  time:   1770000000  // UNIX SECONDS
}
```

Produced by:
- [twelvedata.js `getTwelvedataQuote()`](../fxincapws/src/providers/twelvedata.js) — REST path.
- [twelvedata.js `connectWebSocket().onUpdate`](../fxincapws/src/providers/twelvedata.js) — stream path.

**Finnhub does not honour this contract.** `FinnhubProvider.subscribe` emits
`{ symbol, last, ts }` — no `bid`, no `ask`, no `time`
([finnhub.js](../fxincapws/src/providers/finnhub.js)), and `FinnhubProvider.getQuote()` returns `null`
unconditionally. Consequences, all observable in the code:

- `useMarketStream` drops any message where `msg.bid == null`
  ([useMarketStream.ts:97](../fxincaptrade/client/hooks/useMarketStream.ts#L97)) → Finnhub ticks never
  render.
- `GET /quote/:symbol` returns 404 while Finnhub is the active provider.
- The SL/TP worker gets no usable bid/ask and skips the symbol.

Since `finnhub` is the seeded default, a database that has never been touched through the admin UI
produces **no usable prices anywhere**. `TODO: verify on production server` which provider row is
currently `enabled = TRUE`.

## 4. Provider selection and failover

All in [fxincapws/src/server.js](../fxincapws/src/server.js).

```
loadProvider(preferred?)
  └─ refreshProviderChain(preferred)
       SELECT * FROM ws_api_keys
       WHERE enabled = TRUE OR api_key <> ''
       ORDER BY (preferred first), PROVIDER_ORDER, updated_at DESC
       ── then filtered in JS to SUPPORTED_RUNTIME_PROVIDERS = {finnhub, twelvedata}
  └─ try candidates in order → activateProviderAt(i)
       closeCurrentProvider() → new XProvider(apiKey,{onFailure}) → connect()
       → replayProviderSubscriptions()   (re-subscribes every live symbol)
```

`binance` is excluded from `SUPPORTED_RUNTIME_PROVIDERS`
([server.js:14](../fxincapws/src/server.js#L14)) — it can be configured and enabled in the admin UI but
can never become the runtime provider.

**Failover triggers**

| Trigger | Path |
| --- | --- |
| Adapter `onFailure` callback | `handleProviderFailure()` → `activateNextProvider(reason, exclude)` |
| Subscribe throws | `ensureStreamProviderForSubscribe()` retries on the next provider |
| Quote miss | **deliberately does not fail over** — a single bad symbol must not tear down the shared stream ([server.js:252-256](../fxincapws/src/server.js#L252-L256)) |

TwelveData escalates to `onFailure` only after `maxReconnectAttempts = 3` closes, spaced 5 s apart.

## 5. Symbol mapping

Only TwelveData maps symbols. `toTwelvedataSymbol()`
([twelvedata.js](../fxincapws/src/providers/twelvedata.js)):

| Client symbol | Provider symbol | Rule |
| --- | --- | --- |
| `XAUUSD`, `XAGUSD`, `XPTUSD`, `XPDUSD` | `XAU/USD`, … | explicit metals table |
| `EURUSD` (both legs in the majors set) | `EUR/USD` | 6-char split |
| `BTCUSDT` | `BTC/USD` | `USDT` suffix stripped |
| `US30`, `US100`, `SPX500` | `DJI`, `IXIC`, `SPX` | alias table |
| anything containing `/` or `:` | unchanged | assumed already provider-native |

The adapter keeps two maps so a normalized quote is always re-labelled with the **client** symbol
before leaving the adapter: `clientToProvider` and `providerToClients`.

Finnhub performs **no** mapping — the raw client symbol is forwarded, so Finnhub-native forms
(`OANDA:EUR_USD`, `BINANCE:BTCUSDT`) would have to be typed by the caller.

## 6. Spread synthesis

TwelveData REST returns a single `close` price. The adapter fabricates a two-sided quote:

```js
const mid = parseFloat(data.close);
const spread = mid * 0.0005;          // 5 basis points, hard-coded
bid = +(mid - spread).toFixed(5);
ask = +(mid + spread).toFixed(5);
```

This synthetic spread is not configurable and is not derived from any account or symbol setting.
`TODO: verify business rule` — whether 5 bps is intended to represent the broker spread.

The TwelveData **WebSocket** path uses `payload.bid` / `payload.ask` when present and falls back to
`payload.price` for both sides (zero spread) when absent.

## 7. Consumers

| Consumer | Transport | Code |
| --- | --- | --- |
| Trading UI prices | WS `/stream` + 2 s HTTP fallback | [fxincaptrade/client/hooks/useMarketStream.ts](../fxincaptrade/client/hooks/useMarketStream.ts) |
| SL/TP auto-close | HTTP `GET /quote/:symbol` | [fxincapapi/src/lib/trading-engine.ts:511](../fxincapapi/src/lib/trading-engine.ts#L511) |
| Admin health/stream test | HTTP via `/api/ws-admin/*` | [fxincapadmin/client/src/pages/ServerSettings.jsx](../fxincapadmin/client/src/pages/ServerSettings.jsx) |
| Charts | **not connected** — TradingView widget loads its own upstream data | [fxincaptrade/client/components/trading/TradingViewWidget.tsx](../fxincaptrade/client/components/trading/TradingViewWidget.tsx) |
| `GET /api/prices` (fxincapapi) | — | returns three hard-coded pairs, [prices.ts:34](../fxincapapi/src/routes/prices.ts#L34) |
| `GET /api/prices` (fxincaptrade) | — | returns `mockData.ts` values |

The last two are stubs that predate fxincapws. They are not used by the trading UI.

## 7a. Infoway provider (implemented, local testing only)

Added on `feature/infoway-market-data`. **Not enabled anywhere** — the `ws_api_keys`
row is seeded `enabled = FALSE`.

| | |
| --- | --- |
| Adapter | [fxincapws/src/providers/infoway.js](../fxincapws/src/providers/infoway.js) |
| Raw socket | [fxincapws/src/providers/infoway-ws.js](../fxincapws/src/providers/infoway-ws.js) |
| REST | `GET https://data.infoway.io/{business}/batch_depth/{codes}` (bid/ask) · `/batch_trade/{codes}` (last) |
| REST auth | `apiKey` **request header** |
| WebSocket | `wss://data.infoway.io/ws?business={business}&apikey={key}` |
| WS auth | `apikey` **query parameter**, enforced at the upgrade handshake |
| Subscribe | depth `{code:10003, trace, data:{codes}}` · trade `{code:10000, trace, data:{codes, includeTy:false}}` |
| Push | depth `10005` `{s,t,a:[[px],[qty]],b:[[px],[qty]]}` · trade `10002` `{s,p,t,td,v,vw}` |
| Heartbeat | `{code:10010, trace}` every 30 s (server drops after 60 s idle) |
| Rate limit | 60 requests/minute per connection, heartbeats included |
| Timestamps | milliseconds → divided to **seconds** in the adapter |

**Depth is the primary channel.** The trade channel carries only `p` (last price)
with no bid/ask — the same shape that makes Finnhub unusable here (§3). Depth
supplies `b[0][0]` as best bid and `a[0][0]` as best ask; trade contributes `last`.
A trade tick arriving before the first depth tick is held rather than emitted as a
one-sided quote.

**One connection per asset class.** Infoway exposes a separate `business` endpoint
per class, so the adapter keeps a socket per business, created lazily:
`common` (forex/metals/futures), `crypto`, `stock`, `japan`, `india`, `korea`.

### ⚠ Two details the official documentation does not specify

1. **Unsubscribe protocol.** The `subscribe-and-unsubscribe` section, both channel
   pages and every code example document subscription only; no unsubscribe code is
   published. `unsubscribe()` therefore removes the subscription **locally** — the
   callback is dropped and ticks stop reaching the platform — without sending a
   guessed message. The upstream feed continues until the socket closes. When
   Infoway confirms the message, it goes in `infoway-ws.js` `removeSymbol()`, the
   only place that needs to change.
2. **Forex/metal symbol codes.** Crypto is confirmed as `BTCUSDT` (concatenated,
   no separator) and the forex page lists `EURUSD`/`USDGBP`, but it also writes
   `GBP/USD` in prose and shows no worked forex request. The adapter passes symbols
   through unchanged, which matches the confirmed crypto form. Verify against
   `GET /common/basic/symbols?type=FOREX` with a live key; if the codes differ, set
   `INFOWAY_SYMBOL_MAP=XAUUSD=XAU/USD,...` rather than editing code.

## 8. Where Infoway (or any future provider) plugs in

**One file, one registration, one database row. Nothing outside `fxincapws/` should change.**

### Step 1 — new adapter

Create `fxincapws/src/providers/infoway.js` exporting a class with this duck-typed interface
(the interface is implicit — there is no TypeScript type to implement):

```js
export class InfowayProvider {
  constructor(apiKey, options = {}) { this.onFailure = options.onFailure; }

  connect()                       {}   // may be lazy; called once on activation
  subscribe(symbol, onUpdate)     {}   // onUpdate(normalizedQuote) per tick
  unsubscribe(symbol)             {}
  async getQuote(symbol)          {}   // → normalized quote | null   (REST snapshot)
  disconnect()                    {}
}
```

Contract requirements, each learned from an existing bug or behaviour above:

1. `onUpdate` and `getQuote` **must** emit the full §3 shape including `bid`, `ask` and `time` in
   **seconds** — otherwise the frontend silently drops ticks and SL/TP silently skips symbols.
2. `symbol` in the emitted quote must be the **client** symbol, never the provider symbol.
3. Call `options.onFailure(error)` only for genuine connectivity loss, after your own retry budget is
   spent. A single unavailable symbol must not trigger it.
4. `subscribe` must be safe to call repeatedly for the same symbol — `replayProviderSubscriptions()`
   re-invokes it on every failover.

### Step 2 — register it

In [fxincapws/src/server.js](../fxincapws/src/server.js):

```js
// 1. import
import { InfowayProvider } from './providers/infoway.js';

// 2. allow it at runtime  (line 14)
const SUPPORTED_RUNTIME_PROVIDERS = new Set(['finnhub', 'twelvedata', 'infoway']);

// 3. construct it  (createProviderInstance, line 49)
if (candidate.provider === 'infoway') return new InfowayProvider(candidate.api_key, options);
```

In [fxincapws/src/db.js](../fxincapws/src/db.js):

```js
// 4. failover priority
const PROVIDER_ORDER = ['infoway', 'twelvedata', 'finnhub', 'binance'];
//    …and the matching CASE arm in providerOrderSql()

// 5. seed row in initSettingsTable(): { provider:'infoway', endpoint:'…', enabled:false }
```

In [fxincapws/src/server.js](../fxincapws/src/server.js) the two admin handlers validate the provider
name against a literal array — add `'infoway'` to both
(`POST /admin/providers/:provider`, `POST /admin/settings`).

### Step 3 — admin UI (optional, cosmetic)

[fxincapadmin/client/src/pages/ServerSettings.jsx](../fxincapadmin/client/src/pages/ServerSettings.jsx)
builds its socket-test list from a hard-coded `socketTargets` array. Add an entry there so the new
provider gets a connectivity test button. The provider **table** in that page is rendered from
`GET /api/ws-admin/admin/providers`, so the new row appears automatically without a UI change.

### Step 4 — enable

Admin → Server Settings → set the API key, toggle enabled. `updateProvider()` disables every other
provider in the same transaction and `loadProvider()` hot-swaps the runtime provider without a
restart.

### What must NOT happen

Provider-specific field names, symbol formats, timestamp units or error shapes must never appear in:

- `fxincaptrade/client/**` — it only knows `{type,symbol,bid,ask,time}`
- `fxincapapi/src/lib/trading-engine.ts` — it only knows `bid`/`ask` numbers
- any database table other than `ws_api_keys`
- the P&L engine, which never touches provider data at all

If a new provider needs a field that does not exist in §3, extend §3 for **all** adapters rather than
leaking a provider-shaped object downstream.

## 9. Gaps to close before the provider swap

| # | Gap | Impact |
| --- | --- | --- |
| 1 | No shared `ProviderAdapter` interface (duck typing only) | A new adapter can omit `bid`/`ask` and fail silently, exactly as Finnhub does today |
| 2 | `FinnhubProvider` violates the normalized shape | Prices dead whenever Finnhub is active |
| 3 | `providerOrderSql()` and two admin validation arrays hard-code provider names | Four edit sites per new provider |
| 4 | `getWsQuoteBaseUrl()` consumer reads `data.bid` instead of `data.quote.bid` | SL/TP never fires (see [TRADING_ENGINE.md](./TRADING_ENGINE.md) §6) |
| 5 | 5 bps synthetic spread hard-coded | Cannot be tuned per symbol or account |
| 6 | No quote staleness / heartbeat check on the fan-out side | A silently stalled provider looks healthy on `/health` |

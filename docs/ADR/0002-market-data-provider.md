# ADR-0002 — Database-backed provider abstraction with runtime failover

**Status:** Accepted (documented retrospectively, 2026-08-10)
**Directly relevant to:** the upcoming market-data provider change

## Context

The platform needs live bid/ask prices for forex, metals and crypto. No single vendor covers every
instrument well, vendor terms change, free tiers restrict WebSocket symbols, and an outage at the
price feed makes the whole product unusable.

Three vendors have been involved: Finnhub (stocks, trade ticks), TwelveData (forex and metals, both
REST and WebSocket) and Binance (crypto, never implemented beyond a stub).

## Decision

Isolate every vendor behind a **provider adapter** inside `fxincapws`, keep provider selection in a
**database table** rather than in environment variables or code, and expose only a **normalized
quote** to the rest of the platform.

```
Provider Adapter  →  Normalized Quote  →  fxincapws fan-out  →  frontend / trading engine
```

- **Adapter interface** (duck-typed): `connect`, `subscribe(symbol, cb)`, `unsubscribe`,
  `getQuote(symbol)`, `disconnect`, plus an `onFailure` callback supplied by the server.
- **Normalized quote:** `{ symbol, bid, ask, mid, last, time }` — `symbol` is always the *client*
  symbol; `time` is UNIX seconds.
- **Configuration:** the `ws_api_keys` table holds `provider`, `api_key`, `enabled`, `endpoint`.
  Exactly one provider is enabled; enabling one disables the rest in the same transaction.
- **Failover:** a chain ordered by preference, then a static `PROVIDER_ORDER`, then `updated_at`.
  An adapter failure triggers `activateNextProvider()`, which replays every live subscription onto
  the new provider.
- **Symbol mapping** lives inside the adapter (`toTwelvedataSymbol()`), never outside it.

## Why

1. **Vendor changes are operational, not deployment, events.** An admin sets a key and toggles a
   flag; `loadProvider()` hot-swaps the runtime provider with no restart and no dropped client
   sockets.
2. **Downstream code stays vendor-agnostic.** The trading engine, the P&L engine and the frontend
   only ever see `bid`/`ask` numbers. Nothing downstream imports a provider module.
3. **Failover needs a chain, not a boolean.** A single configured provider means an outage is an
   outage. The ordered chain lets a second vendor take over automatically.
4. **Credentials do not belong in five `.env` files.** One row, edited through the admin UI, applies
   immediately.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Provider chosen by env var | Changing vendor requires an edit + redeploy + restart; no failover |
| Each service talks to the vendor directly | Duplicated API keys, duplicated rate-limit budget, and vendor formats leaking into trading code |
| Hard-code one vendor | Vendor lock-in; a free-tier symbol restriction becomes a product limitation |
| A third-party aggregation service | Extra cost and an extra dependency for what is ~200 lines of adapter code |

## Consequences

**Positive**
- Adding a provider is one new file plus registration in two modules — the exact plan in
  [MARKET_DATA_ARCHITECTURE.md](../MARKET_DATA_ARCHITECTURE.md) §8.
- Provider swaps happen live, with subscription replay.
- Provider credentials never reach the trading services.

**Negative — and these matter for the next provider**

1. **The adapter interface is implicit.** There is no TypeScript interface and no runtime validation
   of what an adapter emits. `FinnhubProvider` violates the normalized shape — it emits
   `{symbol, last, ts}` with no `bid`/`ask` — and nothing catches it. The frontend silently drops
   those ticks and the SL/TP worker silently skips those symbols. Finnhub is the seeded default.
2. **Provider names are hard-coded in four places:** `SUPPORTED_RUNTIME_PROVIDERS`,
   `createProviderInstance()`, `PROVIDER_ORDER`/`providerOrderSql()`, and two admin validation
   arrays. `binance` is configurable in the admin UI but excluded from the runtime set.
3. **API keys are stored in plaintext** in `ws_api_keys` and are returned in full to the admin
   browser so the UI can build vendor test URLs.
4. **The synthetic 5 bps spread** applied to TwelveData REST quotes is hard-coded in the adapter and
   is not tunable per symbol or account.
5. **No staleness detection.** `/health` reports a provider as `ready` even if it has stopped
   emitting.

## Follow-ups before the next provider integration

1. Define an explicit `ProviderAdapter` TypeScript interface, or validate emitted quotes at the
   fan-out boundary so a malformed adapter fails loudly instead of silently.
2. Fix or replace `FinnhubProvider` so it satisfies the normalized contract.
3. Collapse the four hard-coded provider name lists into one registry.
4. Add a last-tick-age field to `/health`.
5. Fix the two consumers that read `data.bid` instead of `data.quote.bid`.

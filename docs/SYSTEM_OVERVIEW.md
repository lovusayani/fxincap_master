# System Overview

The non-technical map of the platform: what each part is responsible for, who owns which data, where
the boundaries are, and how the system behaves when something breaks.

For the technical topology — ports, entry points, request lifecycles — see
[ARCHITECTURE.md](./ARCHITECTURE.md). This document deliberately does not repeat it.

## 1. What FXIncap is

A retail trading platform on which customers open demo or real accounts, deposit funds, take
leveraged long/short positions in FX, metals and crypto, and withdraw realized profits. Staff operate
it through a separate back-office: approving deposits and KYC, adjusting balances, configuring the
market-data feed, and running the introducing-broker and copy-trading programmes.

Positions are settled **internally against the platform's own ledger**. There is no bridge to a
liquidity provider or broker in the codebase — `metaapi.cloud-sdk` is declared as a dependency but no
code path uses it. Prices come from a market-data vendor; fills, margin and P&L are computed by
`fxincapapi` and written to PostgreSQL.

## 2. Component responsibilities

| Component | Owns | Does **not** own |
| --- | --- | --- |
| **fxincap** | Public marketing content | Anything authenticated. No user data, no API of its own |
| **fxincaptrade** | The customer's trading experience: price display, order entry, portfolio views | Any business rule. It renders state and posts intents; every decision is made by fxincapapi |
| **fxincapapi** | Users, accounts, balances, orders, trades, P&L, KYC, funds, IB, MAM/PAM, admin operations, email | Market data. It asks fxincapws for prices |
| **fxincapws** | Vendor connections, quote normalization, provider failover, price fan-out | Any customer state. It never reads or writes a business table |
| **fxincapadmin** | Staff UI and keeping service credentials out of the browser | Business rules. It is a UI plus a proxy; every action is an fxincapapi call |
| **deploy webhook** | Turning a GitHub push into a rebuild and restart | Anything at runtime |

The important consequence: **fxincapapi is the only component that may change money.** If a change
affects a balance, a position or a P&L figure, it belongs there.

## 3. Data ownership

One PostgreSQL database, but the tables have clear owners:

| Data | Owner | Notes |
| --- | --- | --- |
| `users`, `user_profiles`, `user_accounts` | fxincapapi | `user_profiles.selected_trading_mode` decides which account every trade settles against |
| `trades`, `trade_history`, `trade_logs`, `orders`, `positions` | fxincapapi | `trades` is authoritative; `positions` is a parallel legacy model |
| `ws_api_keys` | fxincapws | The only table fxincapws touches. Written by staff via the admin proxy |
| `adm_settings` | fxincapapi | Integration credentials (SendGrid, Firebase), plaintext at rest |
| Uploads (KYC, deposit screenshots) | fxincapapi | Filesystem, not the database. **Must never enter git** — [SECURITY.md](./SECURITY.md) §7 |

`fxincaptrade` also opens a database connection, but only for its legacy server routes, which do not
function ([ARCHITECTURE.md](./ARCHITECTURE.md) §3). Treat the trading client as database-free.

## 4. The three flows that matter

**Money in → position → money out**

```
deposit request (+ screenshot)  →  staff approval  →  user_accounts.balance ↑
        ↓
open trade   →  margin moves balance → locked_balance
        ↓
close trade  →  margin released, balance ± realized P&L
        ↓
withdrawal request  →  staff approval  →  balance ↓
```

Every step is a transaction in fxincapapi. No step is automatic: deposits and withdrawals both
require staff action.

**Price → screen**

```
vendor  →  adapter  →  normalized quote  →  fxincapws  →  browser WebSocket  →  rendered price
```

The price a customer sees is delivered straight from fxincapws to the browser. It does not pass
through fxincapapi.

**Price → settlement**

```
vendor  →  adapter  →  fxincapws  →  GET /quote/:symbol  →  fxincapapi SL/TP worker  →  close trade
```

This is the only path where a market price causes money to move — and it is currently broken
([TRADING_ENGINE.md](./TRADING_ENGINE.md) §9).

## 5. Integration boundaries

Boundaries a change must not cross without deliberate design:

| Boundary | Contract | Why it matters |
| --- | --- | --- |
| fxincapws → everything | `{ symbol, bid, ask, mid, last, time }` | The whole point of the provider abstraction. A vendor-shaped object leaking past here couples the trading engine to a vendor — [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) |
| fxincaptrade → fxincapapi | REST + JWT, `{ success, … }` | The client is untrusted. It currently supplies `entryPrice` and `closePrice`, which is a known weakness ([PNL_ENGINE.md](./PNL_ENGINE.md) §6) |
| fxincapadmin → fxincapapi | REST + injected `Bearer` token | Secrets stay server-side; the browser bundle never holds them |
| fxincapapi → PostgreSQL | `pg`, `$1` placeholders | `?`-style SQL is MySQL-era legacy |
| GitHub → server | HMAC-signed webhook | The only inbound control channel to production |

## 6. External dependencies

| Dependency | Used for | If it fails |
| --- | --- | --- |
| Market-data vendor (TwelveData / Finnhub) | All live prices | Failover to the next configured provider. If all fail: no prices; trading UI is unusable but existing positions and balances are safe |
| PostgreSQL (DigitalOcean managed) | All state | Total outage. Nothing degrades gracefully |
| SendGrid / SMTP | Verification and notification email | Registration verification stalls; trading unaffected |
| CoinGecko | Dashboard crypto ticker only | A widget stops updating. No trading impact |
| GitHub | Deployment | Cannot deploy; running services unaffected |

## 7. Failure behaviour

Worth knowing before an incident:

| Failure | Actual behaviour |
| --- | --- |
| fxincapws down | Prices stop; the trading UI reconnects every 3 s indefinitely. Trading endpoints still respond — a customer can still open a trade at a **client-supplied** price |
| Active provider fails | Automatic failover to the next candidate, with subscription replay. Transparent to the browser |
| Provider returns no bid/ask (Finnhub today) | No error anywhere — prices are silently dropped and `/quote/:symbol` 404s. The most misleading failure mode in the system |
| Database down | fxincapapi logs the failure and keeps serving; every request then fails |
| fxincapapi down | Trading, balances and admin all stop. Prices keep streaming, so the UI looks alive while being unusable |
| A service crashes | PM2 restarts it (`autorestart`, `max_memory_restart: 500M`) |
| Deploy fails mid-build | `run-prod.sh` has already run `pm2 delete`, so services can stay down until the build is fixed |

## 8. Deliberate design decisions

| Decision | Rationale | Record |
| --- | --- | --- |
| Five services, one repository | Isolate the price feed from settlement; ship frontend and API together | [ADR-0001](./ADR/0001-system-architecture.md) |
| Provider config in the database, not env | Change vendor live, no restart, no redeploy | [ADR-0002](./ADR/0002-market-data-provider.md) |
| PM2 + self-hosted webhook | No CI runner, no deploy key leaves the server | [ADR-0003](./ADR/0003-production-deployment.md) |
| Admin server as a credential-injecting proxy | Service tokens never reach the browser bundle | [ADMIN.md](./ADMIN.md) §2 |

## 9. What the system does **not** do

Stated plainly, because several of these look implemented:

- **No margin call or stop-out.** No margin-level calculation exists. Positions are never liquidated
  for insufficient margin.
- **No commission, swap or overnight financing.** The only cost is a synthetic 5 bps spread applied
  in the market-data layer.
- **No order matching.** Pending orders reserve margin and are never converted into positions.
- **No server-side unrealized P&L.** `trades.pnl` is never written for open trades and
  `user_accounts.equity` is never recomputed — [PNL_ENGINE.md](./PNL_ENGINE.md) §3, §5.
- **No external liquidity.** Positions net against the platform.
- **No automated tests, no CI** — [TESTING.md](./TESTING.md).
- **No admin authorization check** — any authenticated user's token is accepted on every
  `/api/admin/*` endpoint ([SECURITY.md](./SECURITY.md) §1).

## 10. Glossary

| Term | Meaning here |
| --- | --- |
| **Trade** | An open or closed position, row in `trades`. The authoritative record |
| **Order** | A *pending* instruction in `orders` that only reserves margin. Never becomes a trade |
| **Position** | Informally a trade; also a legacy `positions` table that the UI does not use |
| **Trading mode** | `demo` or `real`. Set per user in `user_profiles.selected_trading_mode` |
| **Active account** | The one `user_accounts` row matching the user's mode with `is_active` and `account_status='active'`. All settlement targets it |
| **Contract size** | Units per lot: 100,000 FX · 100 XAU · 5,000 XAG · 1 BTC/ETH. Hard-coded |
| **Notional** | `contractSize × volume × price` |
| **Margin / locked balance** | `notional / leverage`, held while a trade or pending order is live |
| **Available balance / free margin** | Balance not committed to margin |
| **Equity** | A stored column. **Not** balance + floating P&L, despite the name |
| **Normalized quote** | `{ symbol, bid, ask, mid, last, time }` — the contract every provider adapter must emit |
| **Provider chain** | Ordered failover candidates from `ws_api_keys` |
| **IB** | Introducing Broker — referral programme with commission levels |
| **MAM / PAM** | Copy-trading: followers mirror a master account |

## 11. Where to go next

| Question | Document |
| --- | --- |
| How do the services actually talk? | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| How do I add a market-data provider? | [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) §8 |
| What exactly is the P&L formula? | [PNL_ENGINE.md](./PNL_ENGINE.md) |
| What endpoints exist? | [API.md](./API.md) |
| How do I work across two PCs? | [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) |
| What is unsafe right now? | [SECURITY.md](./SECURITY.md) |

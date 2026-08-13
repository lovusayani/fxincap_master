# P&L Engine

Everything below is traced from [fxincapapi/src/lib/trading-engine.ts](../fxincapapi/src/lib/trading-engine.ts),
[fxincapapi/src/lib/price-sync.ts](../fxincapapi/src/lib/price-sync.ts) and
[fxincapapi/src/lib/database-trading.ts](../fxincapapi/src/lib/database-trading.ts).

> **Updated after the `fix/security-and-pnl` remediation.** Prices are now
> server-authoritative: [market-price.ts](../fxincapapi/src/lib/market-price.ts) obtains executable
> prices from fxincapws, and a price-sync worker values open positions and recomputes equity. The
> browser no longer supplies any price that moves money. §3, §5 and §6 record what changed.

## 1. The single P&L formula

```ts
export async function calculatePnL(side, symbol, volume, entryPrice, currentPrice) {
  const contractSize = getContractSize(symbol);
  const signedMove   = side === "BUY" ? currentPrice - entryPrice
                                      : entryPrice   - currentPrice;
  const pnl          = Number((signedMove * contractSize * volume).toFixed(2));
  const notional     = contractSize * volume * entryPrice;
  const pnlPercentage= notional > 0 ? Number(((pnl / notional) * 100).toFixed(4)) : 0;
  return { pnl, pnlPercentage };
}
```

| Term | Definition |
| --- | --- |
| `side` | `BUY` (long) or `SELL` (short) |
| `signedMove` | long: `current − entry`; short: `entry − current` |
| `contractSize` | BTC/ETH 1, XAU 100, XAG 5000, else 100000 — see [TRADING_ENGINE.md](./TRADING_ENGINE.md) §2 |
| `pnl` | `signedMove × contractSize × volume`, rounded to 2 dp, in account currency |
| `notional` | `contractSize × volume × entryPrice` — denominated at **entry**, not current |
| `pnlPercentage` | `pnl / notional × 100`, 4 dp |

**Leverage does not appear in the P&L formula.** It affects only the margin locked at open. A 1:1 and
a 1:100 position of the same volume produce identical P&L.

**Spread, commission, swap and fees are not modelled anywhere.** There is no fee table, no
commission column, and no swap accrual job. `TODO: verify business rule` — whether the 5 bps synthetic
spread applied in the market-data layer ([MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) §6)
is intended to be the only cost the trader pays.

### Worked examples

Long 0.10 XAUUSD, entry 4535.00, current 4540.00 (contract size 100):

```
signedMove = 4540.00 − 4535.00 = 5.00
pnl        = 5.00 × 100 × 0.10 = 50.00
notional   = 100 × 0.10 × 4535.00 = 45,350.00
pnl%       = 50.00 / 45,350.00 × 100 = 0.1102 %
```

Short 0.50 EURUSD, entry 1.0850, current 1.0830 (contract size 100000):

```
signedMove = 1.0850 − 1.0830 = 0.0020
pnl        = 0.0020 × 100000 × 0.50 = 100.00
notional   = 100000 × 0.50 × 1.0850 = 54,250.00
pnl%       = 100.00 / 54,250.00 × 100 = 0.1843 %
```

## 2. Realized P&L

Computed once, inside `closeTrade()`, using the `closePrice` passed by the caller:

```
final_pnl = calculatePnL(side, symbol, volume, entry_price, closePrice).pnl
```

Persisted in two places within the same transaction:

- `trades.final_pnl`, `trades.close_price`, `trades.closed_at`, `trades.closing_reason`
- a new `trade_history` row with `profit`, `profit_percentage`, `duration_seconds`

Then settled:

```sql
UPDATE user_accounts
   SET balance           = balance + final_pnl,
       available_balance = available_balance + final_pnl
 WHERE id = <settlement account>
```

(after `unlockBalance()` has already returned the margin to `available_balance`).

Where `closePrice` comes from:

| Close path | Price source | Trustworthy? |
| --- | --- | --- |
| `PUT /api/trades/:id/close` | **client request body** | No — see §6 |
| SL/TP worker | `bid`/`ask` from fxincapws | Yes, but the worker is broken |
| Auto-close timeout | `current_price ?? entry_price` | `current_price` is client-written |

## 3. Unrealized P&L

**Server-side, on an interval.** [price-sync.ts](../fxincapapi/src/lib/price-sync.ts) runs every
`PRICE_SYNC_POLL_MS` (default 5 s) and, for every open trade:

1. fetches one server quote per distinct symbol from fxincapws;
2. marks the position at its **executable close price** (BUY at bid, SELL at ask);
3. computes P&L through the same `calculatePnL()` used at settlement;
4. persists `current_price`, `pnl` and `pnl_percentage`;
5. accumulates floating P&L per account and rewrites `equity` (see §5).

Symbols without a fresh quote are skipped and logged — a stale position keeps its last values rather
than being marked at a fabricated price.

| Column | Written by | When |
| --- | --- | --- |
| `current_price` | price-sync worker | every `PRICE_SYNC_POLL_MS`, from server prices |
| `pnl` | price-sync worker | same |
| `pnl_percentage` | price-sync worker | same |

### What this replaced

| Column | Previously written by | Problem |
| --- | --- | --- |
| `current_price` | `POST /api/trades/price-update` — **unauthenticated** | any caller could set any trade's price |
| `pnl_percentage` | same statement | only when a client happened to post |
| `pnl` | **nothing** | never written for open trades; consumers read a stale default |

`updateTradeRealtime()` in `trading-engine.ts` remains exported and uncalled — the worker supersedes
it. `POST /api/trades/price-update` still exists but now requires an internal service token or
administrator credentials, and is a maintenance tool rather than the primary mechanism.

`updateTradeCurrentPrice()` writes the percentage with an inline SQL expression:

```sql
pnl_percentage = CASE WHEN side = 'BUY' THEN (($1 - entry_price) / entry_price) * 100
                      ELSE ((entry_price - $1) / entry_price) * 100 END
```

That is algebraically identical to `calculatePnL`'s percentage (the `contractSize × volume` factor
cancels), so the two definitions agree. The absolute `pnl` column, however, is left stale at its
default forever.

`updateTradeRealtime()` in `trading-engine.ts` *would* write both columns correctly — it is exported
and **never called by any route**. Dead code.

**Consequence:** `GET /api/trades/dashboard` and `GET /api/trades/open` return `pnl` straight from the
row, so open positions report a P&L that was never computed. The trading UI must therefore derive
floating P&L client-side from the live WebSocket price.

## 4. Aggregate statistics

`getTradeStatistics(userId)` — closed trades only:

```sql
total       = COUNT(*)
open_count  = COUNT(status='OPEN')
closed_count= COUNT(status='CLOSED')
win_count   = COUNT(status='CLOSED' AND final_pnl > 0)
total_pnl   = SUM(final_pnl WHERE status='CLOSED')
avg_win     = AVG(final_pnl WHERE CLOSED AND final_pnl > 0)
avg_loss    = AVG(final_pnl WHERE CLOSED AND final_pnl < 0)
winRate     = win_count / closed_count × 100
```

A trade closing at exactly `0.00` counts as neither a win nor a loss but is in the denominator.

`getAccountInfo()` reports `totalPnL` as `SUM(final_pnl)` over **all** the user's closed trades — it is
not filtered by `account_id`, so a user's demo and real realized P&L are summed together even though
balances are per-account. `TODO: verify business rule`.

## 5. Account state model

```
                    user_accounts (one row per user × trading_mode × account)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ balance            deposits − withdrawals + Σ realized P&L           │
  │ locked_balance     Σ margin of OPEN trades + Σ margin_reserved of    │
  │                    pending orders                                     │
  │ available_balance  free margin (maintained incrementally, self-heals  │
  │                    to balance − locked_balance)                       │
  │ equity             STORED COLUMN — see below                          │
  │ margin_free        legacy column, written at registration/admin only  │
  └──────────────────────────────────────────────────────────────────────┘
```

Exposed by `GET /api/user/balance` as:

| API field | Backed by |
| --- | --- |
| `balance` | `user_accounts.balance` |
| `equity` | `user_accounts.equity` |
| `margin` | `locked_balance` (falls back to `margin_used`) |
| `freeMargin` | `available_balance`, or `max(0, balance − locked_balance)` when the stored value is 0 |
| `leverage` | `user_profiles.leverage`, clamped to `1..100` |
| `currency` | `user_accounts.currency`, default `USD` |

### Equity

`equity = balance + Σ unrealized P&L of that account's open trades`, recomputed by the price-sync
worker on the same interval as position valuation. Accounts with no open trades are reconciled back
to `equity = balance` by `reconcileFlatAccountEquity()`, so a flat account cannot keep a stale
floating figure forever.

It remains a **stored** column rather than a derived one — computing it on read would have meant
touching every balance-reporting endpoint, a far larger change than the security work warranted. The
stored value is now maintained rather than abandoned.

Previously `equity` was written only at registration
([auth.ts:131,153](../fxincapapi/src/routes/auth.ts#L131)) and by admin balance edits
([admin.ts](../fxincapapi/src/routes/admin.ts)); nothing added floating P&L and closing a trade
updated `balance` but not `equity`, so it drifted permanently after the first close.

### Margin level / stop-out

Not implemented. There is no margin-level percentage, no margin call, and no stop-out liquidation
anywhere in the codebase. The only automatic close is the `FORCED_TIMEOUT` worker.

## 6. Integrity — before and after

| # | Risk | Status |
| --- | --- | --- |
| 1 | `POST /api/trades/price-update` unauthenticated | ✅ **FIXED** — requires an internal service token or admin credentials |
| 2 | `closePrice` on manual close client-supplied | ✅ **FIXED** — the request body value is ignored; the server resolves the executable close price |
| 3 | `entryPrice` on open client-supplied | ✅ **FIXED** — ignored; the server resolves the executable open price and returns it in the response |
| 4 | `trades.pnl` never updated for open trades | ✅ **FIXED** — written by the price-sync worker |
| 5 | `equity` never recomputed | ✅ **FIXED** — recomputed per account, reconciled when flat |
| 6 | `getAccountInfo().totalPnL` not scoped to `account_id` | ⬜ **open** — demo P&L still aggregates with real-account reporting |

### Price resolution rules

`resolveServerPrice()` in [trades.ts](../fxincapapi/src/routes/trades.ts) and
`getSettlementPrice()` in [market-price.ts](../fxincapapi/src/lib/market-price.ts):

| Action | Price used |
| --- | --- |
| Open BUY | ask |
| Open SELL | bid |
| Close BUY | bid |
| Close SELL | ask |

Quotes older than `PRICE_MAX_AGE_MS` (default 30 s) are refused. When no fresh price exists the
operation returns **503** rather than settling — a client price or a fabricated one is never
substituted.

> **Operational consequence.** Trading now depends on fxincapws having a working provider. If no
> provider can supply quotes, opens and closes are refused. This is deliberate: settling at an
> unverifiable price is worse than refusing. Confirm a working provider (currently `twelvedata` —
> `finnhub` publishes no bid/ask) is enabled before relying on it. See
> [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) §3.

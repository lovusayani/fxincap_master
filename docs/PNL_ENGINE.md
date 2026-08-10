# P&L Engine

Everything below is traced from [fxincapapi/src/lib/trading-engine.ts](../fxincapapi/src/lib/trading-engine.ts)
and [fxincapapi/src/lib/database-trading.ts](../fxincapapi/src/lib/database-trading.ts).

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

## 3. Unrealized P&L — the honest picture

There is **no server-side unrealized-P&L engine.** No worker recomputes floating P&L for open trades.

The `trades` table carries `pnl` and `pnl_percentage` columns, but:

| Column | Written by | When |
| --- | --- | --- |
| `current_price` | `updateTradeCurrentPrice()` via `POST /api/trades/price-update` | only when a client posts |
| `pnl_percentage` | same statement | only when a client posts |
| `pnl` | **nothing** | never, for open trades |

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

### ⚠ Equity is not computed

The industry definition is `equity = balance + Σ unrealized P&L`. In this codebase `equity` is only
ever written by:

- registration ([auth.ts:131,153](../fxincapapi/src/routes/auth.ts#L131)) — set to the opening balance
- admin balance edits ([admin.ts:466,1515,1678](../fxincapapi/src/routes/admin.ts#L466))

No code path adds floating P&L to it, and closing a trade updates `balance` but **not** `equity`.
Equity therefore drifts permanently out of step with balance after the first closed trade.

`TODO: verify business rule` — whether `equity` is intended to be a derived figure. If so it should be
computed on read as `balance + Σ open-trade P&L` rather than stored.

### Margin level / stop-out

Not implemented. There is no margin-level percentage, no margin call, and no stop-out liquidation
anywhere in the codebase. The only automatic close is the `FORCED_TIMEOUT` worker.

## 6. Integrity risks

| # | Risk | Detail |
| --- | --- | --- |
| 1 | `POST /api/trades/price-update` has **no `verifyToken`** | Any unauthenticated caller can set `current_price` and `pnl_percentage` on **any** `tradeId`. Because the auto-close worker closes at `current_price`, this is a direct path to manipulating realized P&L. [trades.ts:383](../fxincapapi/src/routes/trades.ts#L383) |
| 2 | `closePrice` on manual close is client-supplied | `PUT /api/trades/:id/close` accepts the price from the request body with no bounds check against a server-side quote |
| 3 | `entryPrice` on open is client-supplied | Same class of issue at the other end of the trade |
| 4 | `trades.pnl` never updated for open trades | Any consumer trusting that column reads a stale value |
| 5 | `equity` never recomputed | User-visible figure diverges from reality |
| 6 | `getAccountInfo().totalPnL` not scoped to `account_id` | Demo P&L leaks into real-account reporting |

Items 1–3 together mean the P&L of a trade is, end to end, determined by values the client chose.
None of these were changed in this documentation pass; fixing them alters live trading behaviour and
requires explicit approval.

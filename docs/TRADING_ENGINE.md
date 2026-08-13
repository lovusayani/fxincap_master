# Trading Engine

Authoritative implementation: [fxincapapi/src/lib/trading-engine.ts](../fxincapapi/src/lib/trading-engine.ts).
Routes: [fxincapapi/src/routes/trades.ts](../fxincapapi/src/routes/trades.ts),
[orders.ts](../fxincapapi/src/routes/orders.ts), [positions.ts](../fxincapapi/src/routes/positions.ts).

> The parallel engine in [fxincaptrade/server/lib/trading-engine.ts](../fxincaptrade/server/lib/trading-engine.ts)
> is legacy MySQL-era code running against a `pg` pool and is non-functional. Ignore it.
> See [ARCHITECTURE.md](./ARCHITECTURE.md) §3.

## 1. Flow

```
Order (optional)                    Trade (position)
──────────────                      ────────────────
POST /api/orders                    POST /api/trades/open
  status='pending'                    status='OPEN'
  margin_reserved locked              locked_balance locked
        │                                   │
        │ DELETE /api/orders/:id            ├── PUT /api/trades/:id/close   (manual)
        │  → margin released                ├── SL/TP worker                (automatic)
        ▼                                   └── auto-close timeout worker   (automatic)
    cancelled                                       │
                                                    ▼
                                          status='CLOSED' + trade_history row
                                          balance += final_pnl
```

**Orders never become trades.** There is no matching engine, no fill logic, and no code path that
transitions an `orders` row to a `trades` row. A pending order only reserves margin until it is
cancelled. `TODO: verify business rule` — whether pending orders are meant to convert on price touch.

## 2. Contract size

```ts
function getContractSize(symbol: string): number
```

| Symbol matches | Contract size |
| --- | --- |
| contains `BTC` | 1 |
| contains `ETH` | 1 |
| starts with `XAU` | 100 |
| starts with `XAG` | 5000 |
| everything else | 100000 |

Matching is substring/prefix based on the uppercased symbol, so `XAUUSD` → 100 and `BTCUSDT` → 1.
There is no per-symbol table in the database driving this; it is code.

## 3. Notional and required margin

```
notional = contractSize(symbol) × volume × price
margin   = round(notional / leverage, 2)
```

`getRequiredMargin()` returns `0` for any non-finite or non-positive input. This is a silent
zero-margin path: a malformed `leverage` yields a free trade rather than a rejection.
`TODO: verify business rule`.

**Worked example** — 0.10 lots XAUUSD at 4535.00, leverage 100:

```
notional = 100 × 0.10 × 4535.00 = 45,350.00
margin   = 45,350.00 / 100      =    453.50
```

## 4. Validation on open — `validateTradeOpen()`

In order:

1. `symbol`, `side`, `volume`, `entryPrice` all present.
2. `side ∈ {BUY, SELL}`.
3. `volume > 0` and `entryPrice > 0`.
4. `1 ≤ leverage ≤ 100`.
5. Directional SL/TP sanity:
   - BUY: `stopLoss < entryPrice`, `takeProfit > entryPrice`
   - SELL: `stopLoss > entryPrice`, `takeProfit < entryPrice`
   - Falsy SL/TP (including `0`) skips the check.
6. `availableBalance ≥ requiredMargin`.

Not validated: `entryPrice` against any live market price, symbol against the `symbols` table,
minimum/maximum volume, or market hours.

## 5. Account resolution — `resolveActiveAccountId()`

Every balance mutation targets exactly one account row:

```sql
SELECT selected_trading_mode FROM user_profiles WHERE user_id = $1     -- 'demo' | 'real', default 'demo'
SELECT id FROM user_accounts
 WHERE user_id = $1 AND trading_mode = $2
   AND is_active = true AND account_status = 'active'
 LIMIT 1
```

The code comment records why this exists: an earlier version matched on `user_id` alone and mutated
demo and real balances together.

If no row matches, the operation is rejected with *"No active trading account found. Please select an
account in Settings."* — it does not fall back to any other account.

## 6. Balance locking

`lockBalance(accountId, amount, conn?)` — conditional, single statement:

```sql
UPDATE user_accounts
   SET locked_balance    = locked_balance + $1,
       available_balance = GREATEST(0, GREATEST(available_balance, balance - locked_balance) - $2)
 WHERE id = $3
   AND GREATEST(available_balance, balance - locked_balance) >= $4
```

`rowCount === 0` ⇒ insufficient funds ⇒ the enclosing transaction rolls back. The
`GREATEST(available_balance, balance - locked_balance)` term exists because `available_balance` was
not populated on historical accounts; it self-heals to the computed value.

`unlockBalance()` is the inverse and is floored at 0 on both columns:

```sql
UPDATE user_accounts
   SET locked_balance    = GREATEST(0, locked_balance - $1),
       available_balance = GREATEST(0, available_balance + $2)
 WHERE id = $3
```

## 7. Opening — `createTrade()`

Single transaction:

```
BEGIN
  lockedBalance = getRequiredMargin(symbol, volume, entryPrice, leverage)
  accountId     = resolveActiveAccountId(userId, conn)        -- rollback if null
  INSERT INTO trades (user_id, account_id, symbol, side, volume, entry_price,
                      take_profit, stop_loss, leverage, locked_balance, status='OPEN')
        RETURNING id
  lockBalance(accountId, lockedBalance, conn)                 -- rollback if it fails
COMMIT
logTradeAction(tradeId, userId, 'TRADE_OPENED', …)            -- outside the transaction
```

Note that `current_price` is **not** initialised on insert; it stays `NULL` until the client posts a
price update.

## 8. Closing — `closeTrade(tradeId, closePrice, reason)`

```
BEGIN
  SELECT … FROM trades WHERE id = $1 AND status = 'OPEN'      -- rollback if absent
  finalPnL = calculatePnL(side, symbol, volume, entry_price, closePrice)
  UPDATE trades SET status='CLOSED', close_price, final_pnl, closed_at=NOW(), closing_reason
  INSERT INTO trade_history (…, duration_seconds = NOW() - opened_at, closed_reason)
  settlementAccountId = trades.account_id ?? resolveActiveAccountId(user_id, conn)
  unlockBalance(settlementAccountId, locked_balance, conn)
  UPDATE user_accounts SET balance += finalPnL, available_balance += finalPnL
COMMIT
logTradeAction(tradeId, …, 'TRADE_CLOSED', …)
```

The `account_id ?? resolveActiveAccountId(...)` fallback is explicitly for trades opened before the
`account_id` column existed.

### Closing reasons written to `trades.closing_reason`

| Value | Source |
| --- | --- |
| `MANUAL_CLOSE` | default argument of `closeTrade()` |
| `STOP_LOSS_HIT` | `checkAndExecuteStopLossTakeProfit()` |
| `TAKE_PROFIT_HIT` | `checkAndExecuteStopLossTakeProfit()` |
| `FORCED_TIMEOUT` | `autoCloseExpiredTrades()` |

## 9. Stop loss / take profit

`checkAndExecuteStopLossTakeProfit(tradeId, bid, ask)` uses **executable** prices, per the code
comment ("a single mid price misses real fill prices and can skip valid triggers"):

| Side | Exit price used | SL fires when | TP fires when |
| --- | --- | --- | --- |
| BUY | `bid` | `bid ≤ stop_loss` | `bid ≥ take_profit` |
| SELL | `ask` (falls back to `bid`) | `ask ≥ stop_loss` | `ask ≤ take_profit` |

`tradePriceLevel()` treats `null`, `''`, non-finite and `≤ 0` as "no level set".

### ✅ The worker defect that stopped it — fixed

`processAllStopLossTakeProfit()` used to read the quote envelope one level too high:

```ts
const data = await res.json() as { bid?: unknown; ask?: unknown };
bid = Number(data.bid);                               // undefined → NaN
if (!Number.isFinite(bid) || bid <= 0) continue;      // ← always taken
```

fxincapws responds `{ success, quote: { bid, ask, … }, provider }`, so `data.bid` was always
`undefined` and **every symbol was skipped — server-side SL/TP never executed.**

The worker now obtains prices through
[`getServerQuote()`](../fxincapapi/src/lib/market-price.ts), which parses the envelope correctly and
tolerates both shapes. Regression tests: `src/lib/market-price.test.ts`.

The same bug existed in the frontend HTTP quote fallback
([useMarketStream.ts](../fxincaptrade/client/hooks/useMarketStream.ts)) and is also fixed.

Manual/administrative entry points:

- `POST /api/trades/admin/check-sl-tp` — body supplies `bid`/`ask` directly.
- `POST /api/trades/admin/process-sl-tp-all` — invokes the (now working) sweep.

Both previously had **no authentication at all**; both now require an internal service token
(`x-internal-token`) or active administrator credentials. See [SECURITY.md](./SECURITY.md) §2.

## 10. Auto-close on timeout

`autoCloseExpiredTrades(timeoutMinutes)`:

```sql
SELECT id, current_price, entry_price FROM trades
 WHERE status = 'OPEN' AND EXTRACT(EPOCH FROM (NOW() - opened_at)) >= $1
```

Close price = `current_price ?? entry_price`. When the client has never posted a price update,
`current_price` is `NULL` and the trade closes **at its entry price for exactly zero P&L**.

The timeout comes from `getAutoCloseTimeoutMinutes()`
([trade-settings.ts](../fxincapapi/src/lib/trade-settings.ts)), admin-editable via
`POST /api/admin/trade-settings`. `autoCloseExpiredTrades` falls back to **2 minutes** if the value is
non-finite or ≤ 0. A two-minute default forced-close is aggressive for a trading platform —
`TODO: verify business rule`.

## 11. Orders

`POST /api/orders` reserves margin without creating a position:

1. `getRequiredMargin(symbol, volume, price, leverage)` — same formula as trades, default leverage 100.
2. Reject when `availableBalance ≤ 0` or `requiredMargin > availableBalance`.
3. Resolve `symbol_id` from the `symbols` table (`NULL` when unknown — not an error).
4. `BEGIN` → resolve account → `lockBalance` → `INSERT INTO orders (status='pending', margin_reserved)` → `COMMIT`.

`DELETE /api/orders/:id` cancels a `pending` order and releases `margin_reserved`. Any other status
is rejected.

The `orders` table is created lazily at module load by `ensureOrdersTable()`, which also runs
`ALTER TABLE … ADD COLUMN IF NOT EXISTS` for `symbol`, `leverage` and `margin_reserved`. `account_id`
is **not** self-migrated — the code comment explains the DB role lacks `REFERENCES` privilege, so it
comes from [migrations/001_multi_account_support.sql](../fxincapapi/migrations/001_multi_account_support.sql).

## 12. Positions

[positions.ts](../fxincapapi/src/routes/positions.ts) exposes a separate `positions` table
(`GET /`, `GET /open`, `POST /`, `POST /close`, `GET/:id`, `PUT/:id`, `DELETE/:id`). The trading UI
uses `/api/trades/*`; `positions` is a parallel, largely unused model retained from the earlier
schema. `TODO: verify business rule` — whether `positions` still carries live production rows.

## 13. Known trading-engine risks — status

| # | Finding | Status |
| --- | --- | --- |
| 1 | SL/TP worker read `data.bid` instead of `data.quote.bid` — SL/TP never fired | ✅ **FIXED** (§9) |
| 2 | `entryPrice` client-supplied, never validated | ✅ **FIXED** — server resolves the entry price |
| 3 | `POST /api/trades/admin/*` had no authentication | ✅ **FIXED** — internal service token or admin |
| 4 | `getRequiredMargin()` returned 0 on malformed input | ✅ **FIXED** — returns `null`; callers reject |
| 5 | Auto-close closed at entry price when `current_price` was NULL | ✅ **FIXED** — settles at the live server price, or skips |
| 6 | Orders never convert to trades | ⬜ open (may be intended) |
| 7 | `equity` never recomputed from open P&L | ✅ **FIXED** — see [PNL_ENGINE.md](./PNL_ENGINE.md) §5 |
| 8 | Auto-close still falls back to a **2-minute** timeout when unconfigured | ⬜ open — `TODO: verify business rule` |

Fixed on branch `fix/security-and-pnl`. The 2-minute default (item 8) was left alone: changing it is
a business-rule decision, not a security fix.

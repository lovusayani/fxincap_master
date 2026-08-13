# Testing

## 1. Current state: there are no tests

```
$ git ls-files | grep -E '\.(test|spec)\.(ts|tsx|js|jsx|mjs)$'
(no output)
```

Zero test files across all five services. Two of them declare a test runner anyway:

| Service | Declared script | Runner installed | Result |
| --- | --- | --- | --- |
| fxincapapi | `"test": "vitest"` | vitest ^1.6.1 | no test files |
| fxincaptrade | `"test": "vitest --run"` | vitest ^3.2.4 | `No test files found, exiting with code 1` |
| fxincap, fxincapadmin, fxincapws | none | — | — |

There is also no CI — the repository contains no workflow files, so nothing runs automatically on
push or pull request.

**Every change to this platform is currently verified by hand.**

## 2. What can be checked today

| Check | Command | Status |
| --- | --- | --- |
| API typecheck | `cd fxincapapi && ./node_modules/.bin/tsc --noEmit` | PASS |
| API build | `cd fxincapapi && ./node_modules/.bin/tsc` | PASS |
| Trade typecheck | `cd fxincaptrade && ./node_modules/.bin/tsc --noEmit` | PASS |
| Trade build | `cd fxincaptrade && npm run build` | PASS |
| Trade format | `cd fxincaptrade && ./node_modules/.bin/prettier --check .` | FAIL — 95 files, cosmetic |
| Admin build | `cd fxincapadmin/client && ./node_modules/.bin/vite build` | PASS |
| Marketing build | `cd fxincap && ./node_modules/.bin/next build` | PASS (types skipped by config) |
| WS syntax | `cd fxincapws && node --check src/**/*.js` | PASS |
| API lint | `cd fxincapapi && ./node_modules/.bin/eslint src --ext .ts` | NOT AVAILABLE — no eslint config |

Measured results: [BASELINE.md](./BASELINE.md).

## 3. Manual smoke tests

### Market data

```bash
curl http://localhost:4040/health
# provider_status should be "ready"; check provider_error and provider_candidates

curl http://localhost:4040/quote/XAUUSD
# → {"success":true,"quote":{"bid":…,"ask":…},"provider":"twelvedata"}
# bid is nested under .quote — several callers get this wrong

npx wscat -c ws://localhost:4040/stream
> {"action":"subscribe","symbol":"XAUUSD"}
# expect a {"type":"quote",…} snapshot then repeated {"type":"last",…}
```

### API

```bash
curl http://localhost:7000/api/ping                     # {"message":"pong",…}

TOKEN=$(curl -s -X POST http://localhost:7000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:7000/api/user/balance
curl -H "Authorization: Bearer $TOKEN" http://localhost:7000/api/trades/dashboard
```

### Trading round trip (**demo account only**)

1. `PUT /api/user/trading-mode` with `{"mode":"demo"}`
2. record `balance`, `margin`, `freeMargin` from `GET /api/user/balance`
3. `POST /api/trades/open`
4. re-check the balance — `margin` should rise by `contractSize × volume × price / leverage`
5. `PUT /api/trades/:id/close`
6. confirm `balance` moved by exactly `final_pnl` and `margin` returned to its starting value

Never run this against a real-money account.

### Deposit / withdrawal

[fxincaptrade/test-deposit-withdraw.sh](../fxincaptrade/test-deposit-withdraw.sh) is a manual curl
script for that flow.

## 4. Where tests should start

The highest-value, lowest-effort targets are the pure functions in the trading engine — no database,
no network:

```ts
// fxincapapi/src/lib/trading-engine.ts
getContractSize(symbol)                                   // 1 / 100 / 5000 / 100000
getRequiredMargin(symbol, volume, entryPrice, leverage)   // incl. the 0-on-bad-input path
calculatePnL(side, symbol, volume, entryPrice, current)   // long, short, break-even, sign
```

Cases worth locking down, all drawn from findings in [PNL_ENGINE.md](./PNL_ENGINE.md) and
[TRADING_ENGINE.md](./TRADING_ENGINE.md):

| Case | Expectation |
| --- | --- |
| `getContractSize("XAUUSD")` | 100 |
| `getContractSize("BTCUSDT")` | 1 |
| `getContractSize("EURUSD")` | 100000 |
| `getRequiredMargin("XAUUSD", 0.1, 4535, 100)` | 453.50 |
| `getRequiredMargin(…, leverage = 0)` | currently 0 — **document or fix** |
| `calculatePnL("BUY", "XAUUSD", 0.1, 4535, 4540)` | pnl 50.00 |
| `calculatePnL("SELL", "XAUUSD", 0.1, 4535, 4540)` | pnl −50.00 |
| `calculatePnL(…, current === entry)` | pnl 0, pct 0 |

Then, with a test database:

- `lockBalance` rejects when free margin is insufficient (`rowCount === 0`)
- `createTrade` rolls back fully when `lockBalance` fails
- `closeTrade` moves `balance` by exactly `final_pnl` and restores `locked_balance`
- `resolveActiveAccountId` picks the right account per `selected_trading_mode`
- `checkAndExecuteStopLossTakeProfit` fires at the correct bid/ask boundaries for BUY and SELL

The SL/TP boundary tests would have caught the `data.quote.bid` defect described in
[TRADING_ENGINE.md](./TRADING_ENGINE.md) §9.

## 5. Suggested CI

Nothing exists today. A minimal pipeline on pull requests:

```
for each of the 5 services:
  pnpm install --frozen-lockfile
  typecheck (where a tsconfig exists)
  build
fxincapapi: vitest run
```

`--frozen-lockfile` in CI also catches the lockfile drift that would otherwise fail the production
deploy.

## 6. Honest summary

| Dimension | State |
| --- | --- |
| Unit tests | none |
| Integration tests | none |
| E2E tests | none |
| CI | none |
| Type safety | good in fxincapapi and fxincaptrade; disabled in fxincap; absent in fxincapadmin and fxincapws |
| Lint | configured only in fxincap; declared-but-broken in fxincapapi; formatting-only in fxincaptrade |

For a platform that moves customer money, this is the largest engineering gap after the security
findings in [SECURITY.md](./SECURITY.md).

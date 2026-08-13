# Troubleshooting

Commands assume you are in the repository root on the server unless stated otherwise.

## 1. Triage

```bash
pm2 status                          # all six processes online?
pm2 logs --lines 100                # recent errors across everything

curl http://127.0.0.1:7000/api/ping   # API
curl http://127.0.0.1:4040/health     # market data
curl http://127.0.0.1:5001/health     # admin
curl http://127.0.0.1:3000/api/ping   # trade
```

A healthy `fxincap-ws` reports `"provider_status":"ready"` with a non-null `provider_loaded_at`.

## 2. Prices are not updating in the trading UI

The most common class of incident. Work down the chain.

**Step 1 — is a provider active?**

```bash
curl -s http://127.0.0.1:4040/health
```

| Symptom | Cause | Fix |
| --- | --- | --- |
| `provider_status:"error"`, `provider_error:"apiKey is required"` | no API key in `ws_api_keys` | set it in Admin → Server Settings |
| `provider_error:"No supported providers configured…"` | nothing enabled, or only `binance` is | `binance` is excluded from the runtime set — enable `finnhub` or `twelvedata` |
| `provider:"finnhub"`, status `ready`, but no prices | **expected** — see step 2 | switch to `twelvedata` |
| `provider_candidates: []` | the DB query failed | check DB credentials in `fxincapws/.env` |

**Step 2 — Finnhub emits no bid/ask.**

`FinnhubProvider` produces `{symbol, last, ts}` with no `bid`, and the frontend drops any message
without a `bid`. If Finnhub is the active provider, prices will not render and `/quote/:symbol`
returns 404. This is a known defect, not a misconfiguration —
[MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) §3.

Workaround: enable `twelvedata` in Admin → Server Settings.

**Step 3 — is the quote endpoint working?**

```bash
curl -s http://127.0.0.1:4040/quote/XAUUSD
```

Remember the bid is nested: `.quote.bid`, not `.bid`.

**Step 4 — can the browser reach port 4040?**

The client connects to `ws(s)://<page-hostname>:4040/stream` unless `VITE_WS_STREAM_URL` was set at
**build** time. Check the browser console for a failed WebSocket upgrade. On an HTTPS page the
browser demands `wss://`, so port 4040 must be TLS-terminated or proxied.

**Step 5 — restart.**

```bash
pm2 restart fxincap-ws && pm2 logs fxincap-ws --lines 50
```

## 3. Stop loss / take profit never triggers

**This is a known code defect.** `processAllStopLossTakeProfit()` reads `data.bid` from the
fxincap-ws response, but the payload nests it under `data.quote.bid`, so every symbol is skipped.
See [TRADING_ENGINE.md](./TRADING_ENGINE.md) §9.

Confirm it is the defect and not configuration:

```bash
pm2 logs fxincap-api | grep "SL/TP"      # "closed N trade(s)" lines should appear and don't
curl -s "$WS_QUOTE_BASE_URL/quote/EURUSD"   # returns a quote fine
```

Manual close is unaffected. A fix requires a code change plus staging verification.

## 4. Trades cannot be opened

| Error message | Meaning | Fix |
| --- | --- | --- |
| `No active trading account found. Please select an account in Settings.` | no `user_accounts` row matches `selected_trading_mode` + `is_active` + `account_status='active'` | activate an account via `PUT /api/user/accounts/:id/activate`, or check `user_profiles.selected_trading_mode` |
| `Insufficient balance. Required: X, Available: Y` | free margin < required margin | check `locked_balance` — stale locks from cancelled orders inflate it |
| `Leverage must be between 1 and 100` | client sent leverage > 100 | `user_profiles.leverage` defaults to 500 in the schema but is clamped to 100 on read |
| `Stop loss must be below entry price for BUY` | directional SL/TP validation | correct the levels |
| `Insufficient balance to lock` | the conditional `lockBalance` UPDATE matched 0 rows | balance changed between validation and the transaction — retry |

Investigate a specific account:

```sql
SELECT id, trading_mode, is_active, account_status, balance, locked_balance, available_balance
  FROM user_accounts WHERE user_id = 'YOUR_USER_ID';

SELECT selected_trading_mode FROM user_profiles WHERE user_id = 'YOUR_USER_ID';

-- margin actually held by open positions
SELECT COALESCE(SUM(locked_balance),0) FROM trades
 WHERE user_id = 'YOUR_USER_ID' AND status = 'OPEN';
```

If `locked_balance` exceeds the sum of open-trade margin plus pending-order `margin_reserved`, a lock
leaked. Do **not** hand-edit balances on production without a record — use the admin endpoints.

## 5. Balances look wrong

| Symptom | Explanation |
| --- | --- |
| `equity` ≠ `balance` and never converges | `equity` is a stored column that is never recomputed — [PNL_ENGINE.md](./PNL_ENGINE.md) §5 |
| open trade shows `pnl: 0` | `trades.pnl` is never written for open trades; the UI must compute it from the live price |
| `freeMargin` = 0 while `balance` > 0 | `available_balance` was never populated; the API self-heals via `max(available, balance − locked)` on read but the column stays stale |
| demo P&L appears in real-account totals | `getAccountInfo().totalPnL` sums all closed trades regardless of `account_id` |

## 6. Deployment did not happen after a push

```bash
pm2 logs fxincap-deploy-webhook --lines 100
```

| Symptom | Cause | Fix |
| --- | --- | --- |
| nothing in the log | GitHub never called | GitHub → Settings → Webhooks → Recent Deliveries |
| `401 invalid_signature` | `DEPLOY_WEBHOOK_SECRET` ≠ the GitHub webhook secret | align them; do not create a second webhook |
| delivered but ignored | pushed branch ≠ `DEPLOY_BRANCH` | confirm `.deploy.env` sets `DEPLOY_BRANCH=main`; the code default `dev` is unusable |
| `ERROR: no .git in …` | deploy directory is not a git clone | see [DEPLOYMENT.md](./DEPLOYMENT.md) §9 |
| deploy starts then fails at install | `--frozen-lockfile` mismatch | run `pnpm install` locally and commit the lockfile |
| webhook process missing | not started | `bash run-prod.sh` (needs `DEPLOY_WEBHOOK_SECRET` in `.deploy.env`) |

## 7. A service will not start

```bash
pm2 logs <name> --lines 100
pm2 describe <name>          # confirm cwd, script, env
```

| Symptom | Cause |
| --- | --- |
| `Cannot find module 'dist/index.js'` | build never ran — `bash install-prod.sh` |
| `Cannot find module 'dist/server/start.js'` | fxincaptrade SSR build missing — `pnpm build` in that directory |
| `ERR_REQUIRE_ESM` on an ecosystem file | a `.js` PM2 config inside a `"type":"module"` package — use the `.cjs` variant |
| `EADDRINUSE` | port already bound — `lsof -i :<port>`; note staging uses the same ports |
| restarts in a loop | `max_memory_restart: 500M` exceeded, or a crash on boot — read the log |

## 8. Database connection failures

```bash
pm2 logs fxincap-api | grep -i "database\|postgres"
```

| Message | Cause | Fix |
| --- | --- | --- |
| `password authentication failed for user "…"` | wrong or missing `PGPASSWORD` | set it. ⚠ If you did not configure `PGHOST`, the service is dialling a **hard-coded production host** — [SECURITY.md](./SECURITY.md) §3 |
| `self-signed certificate in certificate chain` | strict TLS without a CA bundle | set `PGSSL_REJECT_UNAUTHORIZED=false`, or supply `PGSSL_CA` |
| `permission denied for table …` | app role lacks rights | some migrations must run as the cluster owner — [DATABASE.md](./DATABASE.md) §7 |
| `relation "…" does not exist` | a manual migration was not applied | apply from `fxincapapi/migrations/` |
| `must be owner of table` during a migration | running as the app role | run as `doadmin` |

## 9. Admin UI issues

| Symptom | Cause |
| --- | --- |
| `503 {"error":"Admin API unavailable"}` | admin server cannot reach fxincapapi — check `ADMIN_API_URL`. ⚠ it defaults to the legacy `https://api.suimfx.world` |
| `503 {"error":"WS service unavailable"}` | cannot reach fxincapws — check `WS_SERVICE_URL` |
| `401 Unauthorized — ADMIN_TOKEN … must match WS_ADMIN_TOKEN` | token mismatch between fxincapws `ADMIN_TOKEN` and the admin server's `WS_ADMIN_TOKEN` (note both are trimmed) |
| provider list empty with `success:false` | fxincapws could not query `ws_api_keys` — check its DB config |
| admin login fails after a fresh deploy | `JWT_SECRET` differs between `adminAuth.ts`'s fallback and `verifyToken`'s fallback when unset — set it explicitly |

## 10. Email not sending

```bash
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:7000/api/health/email-test
```

Settings resolve from the `adm_settings` table **before** environment variables. Check Admin →
Server Settings → Email Keys, and confirm which provider (SendGrid vs SMTP) is selected. Use the
"send test email" button there.

## 11. Emergency commands

```bash
pm2 restart all                       # restart everything
pm2 reload all                        # reload (fork mode: still a restart)
bash run-prod.sh                      # re-register every process from scratch
DEPLOY_ALLOW_NO_GIT=1 bash deploy-prod.sh   # rebuild without pulling

# roll back to a known-good commit
git log --oneline -10
git reset --hard <sha> && bash install-prod.sh && bash run-prod.sh
```

`git reset --hard` discards any local edit to a tracked file in the deploy directory. `.deploy.env`
and per-service `.env` files are gitignored and survive.

## 12. When to escalate rather than fix

Do not patch these on a live server — they need a reviewed change and a staging test:

- the SL/TP `data.quote.bid` defect (§3)
- anything touching authentication or the admin authorization gap
- database schema changes
- provider swap or normalization changes

See [SECURITY.md](./SECURITY.md) for the prioritized list.

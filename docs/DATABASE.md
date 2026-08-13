# Database

## 1. Engine

**PostgreSQL**, a DigitalOcean managed cluster, TLS required (`sslmode=require`, port `25060`).
All services connect to the **same database**.

Clients:

| Service | Module | Config |
| --- | --- | --- |
| fxincapapi | `pg` | [src/lib/database.ts](../fxincapapi/src/lib/database.ts) — supports `DATABASE_URL` **or** discrete `PG*` vars |
| fxincaptrade | `pg` | [shared/database.ts](../fxincaptrade/shared/database.ts) and [server/db.js](../fxincaptrade/server/db.js) |
| fxincapws | `pg` | [src/config.js](../fxincapws/src/config.js) + [src/db.js](../fxincapws/src/db.js) — accepts `PG*` **or** legacy `DB_*` |

`fxincapadmin` has no database client; it proxies everything to fxincapapi.

### MySQL residue

The repository still contains MySQL-era artefacts. None of them are on a live path, but they make the
schema files misleading:

- [src/lib/schema.sql](../fxincapapi/src/lib/schema.sql) is **MySQL DDL** (`ENUM(...)`, `INDEX` inside
  `CREATE TABLE`, `DEFAULT (UUID())`, `ON UPDATE CURRENT_TIMESTAMP`). It will not execute on
  PostgreSQL as written. It is a historical reference, not a runnable migration.
- Same for `migrations/001_admin_auth_schema.sql` and `migrations/create_beneficiaries_table.sql`.
- `migrations/001_multi_account_support.sql`, `002_adm_settings.sql` and `004_trade_indexes.sql` **are**
  PostgreSQL and are the real, runnable migrations.
- `mysql2` is still a dependency of fxincapapi and fxincaptrade.

`TODO: verify on production server` — how the live schema was actually created, since the MySQL DDL
cannot have produced it.

## 2. How tables come into existence

Three mechanisms coexist:

| Mechanism | Where | Tables |
| --- | --- | --- |
| **Runtime `CREATE TABLE IF NOT EXISTS`** | inside route/lib modules, executed on first use | `orders`, `trade_logs`, `trade_history`, `account_types`, `deposit_offers`, `ib_applications`, `ib_levels`, `ib_partners`, `ib_settings`, `mam_applications`, `mam_followers`, `mam_masters`, `platform_config`, `promo_codes`, `style_settings`, `style_settings_extras`, `trade_settings`, `user_account_settings`, `user_email_verifications` |
| **Runtime seed on boot** | [fxincapws/src/db.js](../fxincapws/src/db.js) `initSettingsTable()` | `ws_api_keys` (+ indexes + 3 seed rows) |
| **Manual SQL migrations** | `fxincapapi/migrations/*.sql`, run by hand with `psql` | `adm_settings`, multi-account columns, trade indexes |

There is **no migration runner and no migration ledger.** `fxincapapi/migrations` has no ordering
guarantee (two different files are numbered `001`) and nothing records which migrations have been
applied. [migrate.js](../fxincapapi/migrate.js) runs only `001_admin_auth_schema.sql` — the MySQL one —
and imports from `./dist/lib/database.js`, so it requires a prior build.

Some `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements run at module load, e.g.
`ensureOrdersTable()` in [orders.ts:29-31](../fxincapapi/src/routes/orders.ts#L29-L31). One column,
`orders.account_id`, is explicitly *not* self-migrated because the application DB role lacks
`REFERENCES` privilege — it must come from `001_multi_account_support.sql`.

## 3. Core tables

### `users`
Identity. `id` (UUID string), `email` (unique), `password_hash` (bcrypt), `first_name`, `last_name`,
`phone`, `country_code`, `status` (`active|suspended|banned|pending`), `email_verified`.

### `user_profiles`
One row per user. Drives two critical behaviours:

- `selected_trading_mode` — `demo` | `real`. Chooses which account every trade settles against
  (`resolveActiveAccountId()`).
- `leverage` — schema default `500`, but the API clamps it to `1..100` on read
  ([user_v2.ts](../fxincapapi/src/routes/user_v2.ts)) and `validateTradeOpen()` rejects `> 100`.
  The stored default is therefore unreachable. `TODO: verify business rule`.

Also KYC status, address, ID document fields.

### `user_accounts` — the money table
`id`, `user_id`, `account_number` (unique), `trading_mode`, `currency`, `account_status`, and:

| Column | Meaning | Maintained by |
| --- | --- | --- |
| `balance` | deposits − withdrawals + Σ realized P&L | `closeTrade()`, admin funds |
| `locked_balance` | margin held by open trades + pending orders | `lockBalance()` / `unlockBalance()` |
| `available_balance` | free margin | same, incrementally |
| `equity` | **stored, never derived** — see [PNL_ENGINE.md](./PNL_ENGINE.md) §5 | registration + admin only |
| `margin_used`, `margin_free`, `margin_level` | legacy columns from the original schema | rarely written |
| `account_type_id`, `leverage`, `is_active` | added by `001_multi_account_support.sql` | multi-account feature |

Multi-account rules from that migration:

- the old `UNIQUE (user_id, trading_mode)` constraint is **dropped** — a user may hold several
  accounts per mode;
- a partial unique index enforces **at most one `is_active` account per (user, mode)**:
  `idx_user_accounts_one_active_per_mode`.

### `trades` — authoritative position record
`id` (bigint), `user_id`, `account_id`, `symbol`, `side` (`BUY|SELL`), `volume`, `entry_price`,
`current_price`, `take_profit`, `stop_loss`, `leverage`, `locked_balance`, `pnl`, `pnl_percentage`,
`status` (`OPEN|CLOSED|CANCELLED`), `close_price`, `final_pnl`, `opened_at`, `closed_at`,
`closing_reason`.

Caveats: `pnl` is never written for open trades, and `current_price` is written only by the
unauthenticated `POST /api/trades/price-update`. See [PNL_ENGINE.md](./PNL_ENGINE.md) §3.

### `trade_history`
Append-only closed-trade ledger written inside the close transaction: `open_price`, `close_price`,
`profit`, `profit_percentage`, `leverage`, `open_time`, `close_time`, `duration_seconds`,
`closed_reason`.

### `trade_logs`
Audit trail (`TRADE_OPENED`, `TRADE_CLOSED`) with `old_value`/`new_value` JSONB. Created lazily by
`logTradeAction()`.

### `orders`
Pending orders only. `status` (`pending|cancelled`), `margin_reserved`, `symbol_id` → `symbols.id`.
Never transitions to a trade — see [TRADING_ENGINE.md](./TRADING_ENGINE.md) §1.

### `positions`
Parallel position model from the original schema, exposed by `/api/positions/*` but not used by the
trading UI. `TODO: verify business rule` — whether it holds live rows.

### `symbols`
Instrument catalogue: `code`, `name`, `category`, `digits`, `min_volume`, `max_volume`, `bid`, `ask`,
`spread`. **The trading engine does not consult it** — contract sizes are hard-coded in
`getContractSize()` and volume limits are not enforced. It is used only to resolve `orders.symbol_id`.

### `ws_api_keys` — market-data provider config
See [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) §2. Holds provider API keys in
plaintext.

### `adm_settings`
Key/value store for integration credentials (`sendgrid_api_key`, `sendgrid_from`, `firebase_*`) with
an `is_secret` flag. Read/written by [adm-settings.ts](../fxincapapi/src/lib/adm-settings.ts),
[email-settings.ts](../fxincapapi/src/lib/email-settings.ts), [smtp-settings.ts](../fxincapapi/src/lib/smtp-settings.ts).
Secrets are masked before being returned to the admin UI, but stored in plaintext.

## 4. Feature tables

| Domain | Tables |
| --- | --- |
| Admin auth | `admin_users`, admin devices/sessions/verification (see `001_admin_auth_schema.sql`) |
| Funds | `fund_requests`, `transactions`, `payment_methods`, `bank_accounts`, `beneficiaries` |
| KYC | `kyc_documents` |
| Notifications | `notifications`, `notification_preferences` |
| Support | `support_tickets` |
| IB | `ib_profiles`, `ib_clients`, `ib_commissions`, `ib_partners`, `ib_applications`, `ib_levels`, `ib_settings` |
| MAM | `mam_accounts`, `mam_subscriptions`, `mam_masters`, `mam_followers`, `mam_applications` |
| PAMM | `pamm_accounts`, `pamm_investments` |
| Platform | `platform_settings`, `platform_config`, `account_tiers`, `account_types`, `user_account_settings`, `trade_settings`, `deposit_offers`, `promo_codes`, `style_settings`, `style_settings_extras`, `audit_log`, `statistics` |
| Email | `user_email_verifications` |
| Auth | `password_resets` |

## 5. Indexes

Explicit performance indexes live in
[migrations/004_trade_indexes.sql](../fxincapapi/migrations/004_trade_indexes.sql):

| Index | Purpose |
| --- | --- |
| `idx_trades_user_status` | open-trades and history filters |
| `idx_trades_user_closed_at` (partial: `CLOSED,CANCELLED`) | history endpoint ordering |
| `idx_trades_user_opened_at` (partial: `OPEN`) | open-trades ordering |
| `idx_trades_stats_covering` | statistics query resolved from the index alone |
| `idx_trades_open_sltp` (partial) | SL/TP scanner |

fxincapws creates `idx_ws_provider` and `idx_ws_enabled` at boot.

## 6. Seed / backfill data

- `ws_api_keys` — three provider rows seeded on every fxincapws boot (`ON CONFLICT DO NOTHING`).
- `adm_settings` — five key rows with `NULL` values.
- [scripts/backfill-selected-trading-mode-for-real-accounts.sql](../scripts/backfill-selected-trading-mode-for-real-accounts.sql)
  — one-time: sets `selected_trading_mode='real'` for users who already hold a real account.

## 7. Production considerations

1. **Two DB roles.** Some migrations must run as the cluster owner (`doadmin`); the app role lacks
   `ALTER`/`REFERENCES` on `user_accounts`, `user_profiles` and `trades`. Documented at the top of
   `001_multi_account_support.sql`.
2. **Runtime DDL on a production database.** Several modules issue `CREATE TABLE` / `ALTER TABLE` at
   import time on every process start. This works but means schema changes can appear from a deploy
   without any migration being run deliberately.
3. **No migration ledger.** Applying migrations is a manual, unrecorded step.
4. **Two DB hosts appear in the repository** as fallback defaults — `kaka1fxincap-…/fxincapmain` and
   `forex-final-db-…/suim_fx|defaultdb`. Only one can be live. See [SECURITY.md](./SECURITY.md) §3 —
   hard-coded fallbacks mean a service with a missing `.env` will silently target a real host.
5. **Provider API keys and integration secrets are stored in plaintext** in `ws_api_keys` and
   `adm_settings`.

No credentials appear in this document. Connection variables are listed in
[ENVIRONMENT.md](./ENVIRONMENT.md).

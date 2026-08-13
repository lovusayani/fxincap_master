# Admin Back-Office

Service: `fxincap-admin`, port **5001**, directory [fxincapadmin/](../fxincapadmin/).

## 1. Shape

A pnpm workspace with two packages ([pnpm-workspace.yaml](../fxincapadmin/pnpm-workspace.yaml)):

| Package | Stack | Role |
| --- | --- | --- |
| `client` | Vite + React 18 + react-router-dom, Tailwind + styled-components | The SPA |
| `server` | Express 4 + `http-proxy-middleware` + morgan | Serves `client/dist` and proxies API calls |

Production start chain:

```
pm2 → pnpm run start
    → NODE_ENV=production pnpm --filter ./server run start
    → node server/src/index.js        (PORT=5001 injected by PM2)
```

In development (`NODE_ENV=development`) the same server instead proxies `/` to the Vite dev server on
port 5173.

## 2. The proxy layer — why the server exists

The admin server holds no business logic. Its job is to attach credentials **server-side** so they
never appear in the browser bundle ([server/src/index.js](../fxincapadmin/server/src/index.js)).
Order matters — the first matching prefix wins:

| # | Prefix | Target env var | Default | Header injected |
| --- | --- | --- | --- | --- |
| 1 | `/api/ws-admin/*` | `WS_SERVICE_URL` | `https://ws.fxincap.com` | `x-admin-token: WS_ADMIN_TOKEN` |
| 2 | `/api/admin/server-settings` | `LOCAL_ADMIN_API_URL` | falls back to `ADMIN_API_URL` | `authorization: Bearer ADMIN_API_TOKEN` |
| 3 | `/api/admin-auth/*` | `LOCAL_ADMIN_API_URL` | " | `authorization: Bearer ADMIN_API_TOKEN` |
| 4 | `/api/admin/*` | `ADMIN_API_URL` | **`https://api.suimfx.world`** | `authorization: Bearer ADMIN_API_TOKEN` |

`/api/ws-admin/*` strips its prefix and enables WebSocket upgrade (`ws: true`), so
`/api/ws-admin/stream` reaches fxincapws `/stream` and the admin UI can test the live feed from the
browser without exposing port 4040.

> ⚠ **`ADMIN_API_URL` defaults to `https://api.suimfx.world`** — a legacy domain. Production must set
> this explicitly; if the env var is ever missing, every admin API call goes to the wrong host.
> `TODO: verify on production server` that `ADMIN_API_URL` is set.

Proxy failures return `503 { "error": "Admin API unavailable" }` / `"WS service unavailable"` rather
than an HTML error page — deliberate, so the SPA always parses JSON.

The same four prefixes are mirrored in [client/vite.config.js](../fxincapadmin/client/vite.config.js)
for local development, with `ADMIN_LOCAL_API_URL` defaulting to `http://127.0.0.1:7000` and
`WS_SERVICE_URL` to `http://127.0.0.1:4040`.

## 3. Pages

From [client/src/pages/](../fxincapadmin/client/src/pages/):

**Authentication** — `Login`, `Register`, `VerifyEmail`, `ForgotPassword`, `ResetPassword`,
`LockScreen`.

**Members & traders** — `MemberList`, `MemberProfile`, `TradersList`, `TraderAccountsPanel`,
`SubAgentsList`, `UserKycStatus`.

**Money** — `Wallet`, `AllPendings`, `PendingDepositDetail`, `PendingWithdrawalDetail`, `Offers`.

**Configuration** — `ServerSettings`, `UserSettings`, `TradeSetting`, `ForexCharges`, `AccountTypes`,
`GroupSetting`, `MiscellaneousSettings`.

**Programs** — `IBProgram`, `MamPam`.

## 4. Server Settings — the market-data control panel

[client/src/pages/ServerSettings.jsx](../fxincapadmin/client/src/pages/ServerSettings.jsx) is the most
operationally significant page. It provides:

**Provider management**
- Lists providers from `GET /api/ws-admin/admin/providers` (the `ws_api_keys` table).
- Edits API key + enabled flag via `POST /api/ws-admin/admin/providers/:provider`.
- Enabling one provider disables all others in the same DB transaction, then fxincapws hot-swaps the
  runtime provider — **no restart required**.

**Connectivity testing**
- Direct browser WebSocket probes against `wss://ws.finnhub.io`,
  `wss://ws.twelvedata.com/v1/quotes/price` and `wss://stream.binance.com:9443/ws`, with the stored
  API key appended. The target list is a hard-coded `socketTargets` array — a new provider needs an
  entry there (see [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) §8 step 3).
- Internal stream test against `wss://<admin-host>/api/ws-admin/stream` for a chosen symbol.
- Single-quote test via `GET /api/ws-admin/quote/:symbol`.
- Health polling of `GET /api/ws-admin/health`.

> Building a `wss://…?apikey=<key>` URL in the browser means the **provider API key is delivered to
> the admin user's browser** by `GET /admin/providers`. It is not in the JS bundle, but it is in the
> API response. See [SECURITY.md](./SECURITY.md).

**Email configuration** — SendGrid API key / from-address, or SMTP host/port/secure/user/password,
with a provider selector and a "send test email" action. Secrets are returned masked
(`maskEmailApiKey`, `maskSmtpPassword`) and stored in `adm_settings`.

**Destructive operations** — `reset-user` and `reset-all-users`, both behind a typed confirmation
string, an acknowledgement checkbox and a modal.

## 5. Other admin capabilities

| Area | Backing endpoints |
| --- | --- |
| Fund approvals | `GET /api/admin/funds`, `PUT /funds/:id/approve\|reject` — credits/debits balances |
| KYC review | `GET /api/admin/kyc-documents`, `PUT /:id/approve\|reject` |
| Balance adjustment | `PUT /api/admin/wallet-report/:userId/balance` |
| Trader control | ban / unban / change password / deduct funds / **login-as** |
| Account types | CRUD on `account_types` — drives what accounts users may open |
| Trade settings | auto-close timeout (`trade_settings`) |
| Branding | logo upload (PNG ≤ 2 MB, fixed dimensions) + `style-settings` |
| IB | applications, levels, settings, commission structure |
| MAM/PAM | master approval, follower list, statistics |

## 6. Security posture

The proxy design correctly keeps secrets out of the browser bundle. The weaknesses are downstream:

1. **fxincapapi does not enforce admin role** on `/api/admin/*` — see
   [AUTHENTICATION.md](./AUTHENTICATION.md) §4. The admin UI is a convenience layer, not a
   security boundary.
2. `ADMIN_API_TOKEN` is injected but never verified by fxincapapi.
3. `WS_ADMIN_TOKEN` and fxincapws `ADMIN_TOKEN` both default to `changeme-admin-token`.
4. `GET /api/admin/style-settings` and its POST counterpart are unauthenticated on the API side.
5. Provider API keys are returned in cleartext to the admin browser.

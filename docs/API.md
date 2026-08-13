# REST API Reference — fxincapapi

Base URL: `https://api.fxincap.com` (production) · `http://localhost:7000` (local dev).
Mounted in [fxincapapi/src/index.ts](../fxincapapi/src/index.ts). Only endpoints that exist in the
source are listed.

## Conventions

- **Auth: JWT** means the route is wrapped in `verifyToken` and requires
  `Authorization: Bearer <token>`. See [AUTHENTICATION.md](./AUTHENTICATION.md).
- **Auth: none** means the route is reachable without any credential.
- Success envelope is `{ "success": true, ... }`; errors are `{ "success": false, "error": "..." }`.
  A few older routes return bare arrays/objects — noted where they do.
- Status codes in use: `200`, `201`, `400`, `401`, `404`, `500`, `502`. There is no global error
  handler; unhandled exceptions become `500` with the raw `error.message`.
- Unmatched paths return `404 { "error": "Endpoint not found" }`.

---

## Health & meta

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/ping` | none | `{ message: "pong", timestamp, version }` |
| GET | `/api/docs` | none | static endpoint-count summary |
| GET | `/api/health/email-test` | JWT | email delivery probe |

The fxincap-ws service has its own `/health` — see [WEBSOCKET.md](./WEBSOCKET.md) §8.

## Authentication — `/api/auth`

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/register` | none | `email, password, firstName, lastName, phone?, countryCode?` |
| POST | `/login` | none | `email, password` → `{ token, user }` |
| POST | `/verify` | JWT | — (validates the current token) |
| POST | `/change-password` | JWT | `currentPassword, newPassword` |
| POST | `/verification-status` | none | `email` |
| POST | `/verify-email` | none | `email, code` |
| POST | `/resend-verification` | none | `email` |
| POST | `/verify-later` | none | `email` — defers email verification |

Password policy enforced at registration: upper, lower, digit and special character
([auth.ts](../fxincapapi/src/routes/auth.ts)).

## Admin authentication — `/api/admin-auth`

Separate identity store (`admin_users`) with device tracking and session locking.

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/register` | none |
| POST | `/login` | none |
| POST | `/verify-email` | none |
| POST | `/resend-verification` | none |
| POST | `/lock-session` | none |
| POST | `/unlock-session` | none |
| POST | `/forgot-password` | none |
| POST | `/verify-temp-password` | none |
| POST | `/reset-password` | none |
| POST | `/logout` | none |
| GET | `/session/:sessionId` | none |

## User — `/api/user`

Implemented in [user_v2.ts](../fxincapapi/src/routes/user_v2.ts). All routes require JWT.

**Profile & account**

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/profile` | profile + `{ balance, equity }` |
| PUT | `/profile` | |
| POST | `/profile-picture` | multipart `profile_picture` |
| GET | `/balance` | `?mode=demo\|real`; see response shape below |
| PUT | `/trading-mode` | `{ mode: "demo" \| "real" }` — sets `user_profiles.selected_trading_mode` |
| GET | `/accounts` | all trading accounts |
| POST | `/accounts` | open an account from an account type |
| PUT | `/accounts/:id/activate` | make this the active account for its mode |
| GET | `/account-types` | |
| GET | `/account-activation-settings` | |
| POST | `/activate-real-account` | |
| GET | `/limits` | |

`GET /api/user/balance` response:

```json
{ "success": true,
  "balance": { "tradingMode": "real", "accountNumber": "…", "balance": 0, "equity": 0,
               "margin": 0, "freeMargin": 0, "currency": "USD", "leverage": 100 } }
```

`margin` = `locked_balance`, `freeMargin` = `available_balance`. When no active account exists for
the mode the endpoint returns all-zero values with `success: true` rather than a 404.

**Funds**

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/bank-accounts` · POST `/bank-accounts` | |
| GET | `/beneficiaries` · POST `/beneficiary` | bank or crypto |
| POST | `/fund-request` | multipart `screenshot` — deposit/withdrawal request |
| GET | `/fund-requests` | |
| GET · POST | `/fund-request/verify` | **Auth: none** — email-link verification |
| GET | `/deposit-payment-config` · `/deposit-offers` | |
| POST | `/deposit/validate-promo` | |

**KYC**

| Method | Path |
| --- | --- |
| GET · POST | `/kyc` |
| POST | `/kyc/upload` (multipart `document`) |
| POST | `/kyc/submit` |
| DELETE | `/kyc/document` |

**IB (user side)**

| Method | Path |
| --- | --- |
| GET | `/ib/status` |
| POST | `/ib/apply` |

**MAM/PAM copy trading (user side)**

| Method | Path |
| --- | --- |
| GET | `/mampam/masters` |
| POST | `/mampam/apply` |
| POST | `/mampam/follow/:masterId` |
| DELETE | `/mampam/unfollow/:followId` |
| GET | `/mampam/subscriptions` |
| GET | `/mampam/trades` |

> `user_v2.ts` declares `/beneficiaries`, `/beneficiary` and `/accounts` **twice**. Express uses the
> first registration; the later duplicates are unreachable.
> [routes/user.ts](../fxincapapi/src/routes/user.ts) is a re-export shim for backward compatibility.

## Trading — `/api/trades`

| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| POST | `/open` | JWT | `{ symbol, side, volume, entryPrice, takeProfit?, stopLoss?, leverage? }` |
| GET | `/open` | JWT | open trades for the user |
| GET | `/:id` | JWT | |
| PUT | `/:id/close` | JWT | `{ closePrice }` |
| PUT | `/:id/modify` | JWT | modify SL/TP |
| GET | `/history/all` | JWT | |
| GET | `/account/balance` | JWT | |
| GET | `/account/info` | JWT | balance, locked, available, totalPnL |
| GET | `/dashboard` | JWT | open trades + stats + account |
| GET | `/stats/summary` | JWT | win rate, avg win/loss, total P&L |
| POST | `/price-update` | **none** ⚠ | `{ tradeId, currentPrice }` |
| POST | `/admin/check-sl-tp` | **none** ⚠ | `{ tradeId, bid, ask }` |
| POST | `/admin/process-sl-tp-all` | **none** ⚠ | runs the SL/TP sweep |

⚠ These three write trade state without authentication. See [SECURITY.md](./SECURITY.md) §1.

`POST /open` errors: `400` on validation failure or insufficient margin, `401` without a token.

## Orders — `/api/orders`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/` | JWT | pending orders |
| GET | `/:id` | JWT | |
| POST | `/` | JWT | `{ symbol, type, side, volume, price, leverage? }` → `201`; reserves margin |
| DELETE | `/:id` | JWT | cancel a pending order, release margin |

## Positions — `/api/positions`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/` · `/open` · `/:id` | JWT |
| POST | `/` · `/close` | JWT |
| PUT | `/:id` | JWT |
| DELETE | `/:id` | JWT |

Parallel to `/api/trades`; not used by the trading UI.

## History — `/api/history`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/` | JWT |

## Market data — `/api/prices`

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/crypto?ids=bitcoin,ethereum` | none | CoinGecko passthrough, max 30 ids, `502` on upstream failure |
| GET | `/` | none | **hard-coded** EURUSD/GBPUSD/USDJPY, bare array |
| GET | `/:symbol` | none | **hard-coded** stub |

Live prices do **not** come from here. They come from fxincap-ws — see [WEBSOCKET.md](./WEBSOCKET.md).

## Payments — `/api/payment`

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/deposit` · `/withdraw` | JWT |
| GET | `/status/:paymentId` · `/methods` · `/history` | JWT |
| POST | `/webhook` | none (provider callback) |

## Broker — `/api/broker`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/accounts` · `/accounts/:accountId` · `/symbols` | JWT |
| POST | `/accounts` · `/sync` | JWT |

## Notifications — `/api/notifications`

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/` | JWT |
| POST | `/mark-read` · `/preferences` | JWT |
| DELETE | `/:notificationId` | JWT |

## Support — `/api/support`

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/` | none |
| GET | `/:userId` | none |

## Email — `/api/email`

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/send` | none |

## IB — `/api/ib`

All JWT.

| Method | Path |
| --- | --- |
| GET | `/profile` · `/clients` · `/clients/:clientId` · `/commissions` · `/stats` · `/referral-link` |
| POST | `/profile` · `/withdraw` |

## MAM — `/api/mam`

All JWT.

| Method | Path |
| --- | --- |
| GET | `/accounts` · `/accounts/:accountId` · `/accounts/:accountId/positions` · `/accounts/:accountId/stats` · `/managers` |
| POST | `/accounts` · `/copy-trade` |
| PUT | `/accounts/:accountId` |

## PAMM — `/api/pamm`

All JWT.

| Method | Path |
| --- | --- |
| GET | `/accounts` · `/accounts/:accountId` · `/accounts/:accountId/investors` · `/accounts/:accountId/performance` |
| POST | `/accounts` · `/invest` · `/withdraw` |
| PUT | `/accounts/:accountId` |

## Admin — `/api/admin`

69 endpoints in [admin.ts](../fxincapapi/src/routes/admin.ts).

> ⚠ **Authorization gap.** Every one of these is guarded by `verifyToken` only — the *user* JWT
> middleware. There is no role, `user_type` or `admin_users` membership check anywhere in the file.
> Any authenticated end user's token is accepted. See [SECURITY.md](./SECURITY.md) §1.

**Users & traders**

| Method | Path |
| --- | --- |
| GET | `/users` · `/users/:userId` · `/traders` · `/traders/stats` · `/sub-agents` |
| PUT | `/users/:userId` · `/traders/:userId/ban` · `/traders/:userId/unban` |
| POST | `/traders/:userId/change-password` · `/traders/:userId/deduct-fund` · `/traders/:userId/login-as` |
| DELETE | `/users/:userId` |
| GET | `/traders/:userId/trading-accounts` |

**Trading accounts**

| Method | Path |
| --- | --- |
| GET | `/trader-accounts` |
| PUT | `/trader-accounts/:id` · `/trader-accounts/:id/ban` · `/trader-accounts/:id/activate` |
| DELETE | `/trader-accounts/:id` |
| GET · POST | `/account-types` |
| PUT · DELETE | `/account-types/:id` |
| GET · POST | `/user-account-settings` |

**Funds & KYC**

| Method | Path |
| --- | --- |
| GET | `/funds` · `/funds/:id` |
| PUT | `/funds/:requestId/approve` · `/funds/:requestId/reject` |
| GET | `/kyc-documents` · `/kyc-documents/:id` |
| PUT | `/kyc-documents/:id/approve` · `/kyc-documents/:id/reject` |
| GET | `/wallet-report` |
| PUT | `/wallet-report/:userId/balance` |

**Trading oversight**

| Method | Path |
| --- | --- |
| GET | `/trades` · `/positions` · `/analytics` · `/reports` |
| GET · POST | `/trade-settings` (auto-close timeout) |

**Platform settings**

| Method | Path |
| --- | --- |
| GET · POST | `/email-settings` |
| POST | `/email-settings/test` |
| GET · POST | `/style-settings` (**Auth: none** on both) |
| POST | `/logo-upload` (multipart PNG ≤ 2 MB) |
| DELETE | `/logo-delete` |
| GET · POST · PUT · DELETE | `/deposit-offers[/:id]` |
| POST | `/server-settings/reset-user` · `/server-settings/reset-all-users` |

**IB administration**

| Method | Path |
| --- | --- |
| GET | `/ib/stats` · `/ib/list` · `/ib/applications` · `/ib/levels` · `/ib/settings` |
| POST | `/ib/applications/:id/approve` · `/ib/applications/:id/reject` · `/ib/levels` |
| PUT | `/ib/settings` |

**MAM/PAM administration**

| Method | Path |
| --- | --- |
| GET | `/mampam/stats` · `/mampam/masters` · `/mampam/applications` · `/mampam/followers` |
| POST | `/mampam/applications/:id/approve` · `/mampam/applications/:id/reject` |
| PUT | `/mampam/masters/:id/status` |

---

## Other services' HTTP surfaces

### fxincap-ws (port 4040)
See [WEBSOCKET.md](./WEBSOCKET.md) §7.

### fxincap-trade (port 3000)
Serves the SPA. Its `/api/*` routes duplicate fxincapapi against a broken database layer and are not
called by the shipped client — see [ARCHITECTURE.md](./ARCHITECTURE.md) §3.

### fxincap-admin (port 5001)
`GET /health`, `GET /api/info`, plus the four proxy prefixes in [ADMIN.md](./ADMIN.md) §2.

### deploy webhook (port 9010)
`POST /hooks/deploy` — HMAC-SHA256 verified. See [DEPLOYMENT.md](./DEPLOYMENT.md).

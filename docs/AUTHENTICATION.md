# Authentication & Authorization

## 1. Three independent auth systems

| System | Identity store | Token | Used by |
| --- | --- | --- | --- |
| **User auth** | `users` | JWT signed with `JWT_SECRET` | fxincaptrade SPA → fxincapapi |
| **Admin auth** | `admin_users` | JWT signed with `JWT_SECRET`, plus device + session records | fxincapadmin SPA → fxincapapi `/api/admin-auth` |
| **Service tokens** | none (env vars) | shared secrets | admin server → fxincapapi and fxincapws |

The marketing site (`fxincap`) declares `better-auth` as a dependency but has no authenticated
routes — it is a single static landing page.

## 2. User authentication

**Registration** — [fxincapapi/src/routes/auth.ts](../fxincapapi/src/routes/auth.ts)

1. Normalize email (trim + lowercase), validate against `emailRegex`.
2. Password must contain upper, lower, digit and special characters.
3. Hash with `bcryptjs`.
4. Create `users`, `user_profiles`, and a `user_accounts` row.
5. Issue an email verification code (`user_email_verifications`), which the user may defer via
   `POST /api/auth/verify-later`.

**Login** → `{ token, user }`. The JWT payload carries `id` (or legacy `userId`) and `email`.

**Middleware** — the only authorization primitive in the API:

```ts
export async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success:false, error:"No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    const id = decoded.id || decoded.userId;
    if (!id) return res.status(401).json({ success:false, error:"Invalid token payload" });
    req.user = { id, email: decoded.email };
    next();
  } catch {
    res.status(401).json({ success:false, error:"Invalid or expired token" });
  }
}
```

Three properties worth stating plainly:

1. **It proves identity, never role.** `req.user` has no role, tier or admin flag.
2. **It falls back to the literal secret `"secret"`** when `JWT_SECRET` is unset. A service booted
   without its `.env` will happily verify tokens signed with `"secret"`.
3. There is no token revocation, refresh rotation or blocklist in fxincapapi. `fxincaptrade`'s legacy
   server has a `/api/auth/refresh-token` route; fxincapapi does not.

## 3. Admin authentication

[fxincapapi/src/services/adminAuth.ts](../fxincapapi/src/services/adminAuth.ts) +
[routes/adminAuth.ts](../fxincapapi/src/routes/adminAuth.ts). Considerably richer than user auth:

- registration with 6-digit email verification, 30-minute expiry, 60-second resend cooldown
- login issuing a 24 h access token and a 7 day refresh token
- device fingerprinting (`userAgent + ip + timestamp`, base64, truncated to 255 chars)
- session lock / unlock (the admin UI has a `LockScreen` page)
- forgot-password → temporary password (12 chars) → verify → reset, 15-minute expiry

`JWT_SECRET` falls back to the literal `'your-super-secret-jwt-key-change-in-production'`
([adminAuth.ts:11](../fxincapapi/src/services/adminAuth.ts#L11)) — a different fallback from
`verifyToken`'s `"secret"`, so an unconfigured deployment produces admin tokens that its own
`verifyToken` cannot validate.

## 4. ⚠ The authorization gap

**All 69 `/api/admin/*` endpoints are protected by `verifyToken` — the user middleware — and nothing
else.** There is no check that the caller is an admin:

```
$ grep -cE "user_type|is_admin|requireAdmin" fxincapapi/src/routes/admin.ts
0
```

Consequences, assuming a caller holds any ordinary user JWT:

- read every user record, trade and fund request
- `PUT /api/admin/wallet-report/:userId/balance` — set any account's balance
- `POST /api/admin/traders/:userId/change-password`
- `POST /api/admin/traders/:userId/login-as` — impersonate any trader
- `POST /api/admin/server-settings/reset-all-users`
- `POST /api/admin/email-settings` — read/rotate email credentials

The only thing standing between a logged-in user and these endpoints today is that
`https://api.fxincap.com/api/admin/*` is not linked from the trading UI. That is obscurity, not
access control.

**This was not changed in this documentation pass** — the task brief explicitly forbids modifying
authentication. It is the single highest-priority follow-up. The minimal fix is a `requireAdmin`
middleware that looks the caller up in `admin_users` (or checks `users.user_type`) and is applied to
`app.use("/api/admin", …)` in [index.ts:127](../fxincapapi/src/index.ts#L127).

### Additional unauthenticated write endpoints

| Endpoint | Effect |
| --- | --- |
| `POST /api/trades/price-update` | sets `current_price` + `pnl_percentage` on any trade id |
| `POST /api/trades/admin/check-sl-tp` | can close a trade at a caller-supplied bid/ask |
| `POST /api/trades/admin/process-sl-tp-all` | triggers the sweep |
| `GET`/`POST` `/api/admin/style-settings` | platform branding |
| `POST /api/email/send` | send mail through the platform's provider |
| `GET /admin/settings` on fxincap-ws | returns the active provider **and its API key** |

## 5. Service-to-service credentials

| Secret | Set on | Presented as | Checked by |
| --- | --- | --- | --- |
| `ADMIN_API_TOKEN` | fxincapadmin server | `Authorization: Bearer …` | forwarded to fxincapapi — **fxincapapi has no code that validates this token**; it only ever reads user JWTs |
| `WS_ADMIN_TOKEN` | fxincapadmin server / Vite proxy | `x-admin-token` | `ADMIN_TOKEN` in fxincapws `/admin/*` |
| `DEPLOY_WEBHOOK_SECRET` | server `.deploy.env` | `X-Hub-Signature-256` | HMAC-SHA256 + `crypto.timingSafeEqual` in `deploy/webhook-server.cjs` |
| `FINNHUB_WEBHOOK_SECRET` | fxincapws `.env` | `x-finnhub-secret` | fxincapws `/webhook/finnhub` — **skipped entirely when the env var is unset** |

Both `ADMIN_TOKEN` (fxincapws) and `WS_ADMIN_TOKEN` (admin) default to the literal
`changeme-admin-token`. If neither side is configured they match, and the fxincapws admin API is
effectively open. The token comparison itself is a plain `!==` string compare, not constant-time.

The admin proxy design is sound in intent: secrets are attached server-side so they never reach the
browser bundle ([fxincapadmin/server/src/index.js](../fxincapadmin/server/src/index.js)).

## 6. Frontend token handling

`fxincaptrade` stores the JWT in browser storage and attaches it via `Authorization: Bearer`
([client/lib/api.ts](../fxincaptrade/client/lib/api.ts), used by every page). `RequireAuth` in
[App.tsx](../fxincaptrade/client/App.tsx) gates all routes except `/login`, `/register` and
`/auto-login`. There is no httpOnly-cookie option and therefore no XSS-resistant token storage.

`fxincapadmin` keeps its token in `AuthContext`
([client/src/context/AuthContext.jsx](../fxincapadmin/client/src/context/AuthContext.jsx)) and guards
routes with `ProtectedRoute`.

## 7. Summary of findings

| # | Finding | Severity |
| --- | --- | --- |
| 1 | `/api/admin/*` requires no admin role | **Critical** |
| 2 | Trade-mutating endpoints with no auth (`price-update`, `admin/check-sl-tp`, `admin/process-sl-tp-all`) | **Critical** |
| 3 | `JWT_SECRET` falls back to a hard-coded literal in two places | High |
| 4 | `ADMIN_TOKEN` / `WS_ADMIN_TOKEN` default to `changeme-admin-token` | High |
| 5 | `GET /admin/settings` on fxincap-ws leaks the provider API key without a token | High |
| 6 | `ADMIN_API_TOKEN` is sent but never verified anywhere | Medium |
| 7 | Admin token comparison is not constant-time | Low |
| 8 | No token revocation or refresh rotation | Low |

# Security Audit

Scope: static review of the repository at commit `0b7e87b`. Findings are ordered by severity.
No secret values are reproduced here.

## Remediation status

The audit itself changed nothing. A follow-up task (branch `fix/security-and-pnl`) remediated the
application-level findings:

| # | Finding | Status |
| --- | --- | --- |
| §1 | `/api/admin/*` accepted any user JWT | ✅ **FIXED** — `requireAdmin` at the mount point |
| §2 | Three unauthenticated trade-mutating endpoints | ✅ **FIXED** — `requireInternalService` |
| §3 | Hard-coded production DB coordinates | ✅ **FIXED** — fail-fast env validation |
| §4 | Insecure default secrets | ✅ **FIXED** — required, no fallbacks |
| §5 | `GET /admin/settings` leaked the provider API key | ✅ **FIXED** — token gate + redaction |
| §6.1 | Client-supplied prices settled trades | ✅ **FIXED** — server-authoritative prices |
| §6.7 | Provider API keys returned to the admin browser | ✅ **FIXED** — redacted |
| §6.11 | Admin token compared non-constant-time | ✅ **FIXED** — `timingSafeEqual` |
| §7 | **Customer KYC documents in git history** | ⚠️ **OPEN** — see [SECURITY_INCIDENT_KYC_HISTORY.md](./SECURITY_INCIDENT_KYC_HISTORY.md) |
| §6.2–6.6, 6.8–6.10, 6.12–6.13 | Remaining medium findings | ⬜ open — see §6 |

> ⚠️ **Deployment prerequisite.** The fail-fast validation means fxincapapi and fxincap-ws now
> **refuse to start** when a required variable is missing. Before deploying that branch, confirm the
> server `.env` files define: `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `PGHOST`, `PGUSER`,
> `PGPASSWORD`, `PGDATABASE` (fxincapapi) and `ADMIN_TOKEN`, `PGHOST`, `PGUSER`, `PGPASSWORD`,
> `PGDATABASE` (fxincap-ws). See [ENVIRONMENT.md](./ENVIRONMENT.md).

The original findings follow, retained as the record of what was found.

---

## 0. Credential scan result

A scan of every tracked file for live credential formats — `sk_live`/`sk_test`, `AKIA…`,
`-----BEGIN … PRIVATE KEY`, `dop_v1_`, `ghp_…`, `xox[baprs]-`, `SG.…`, and generic
`key|secret|password|token = "<12+ chars>"` assignments — returned **no live credentials**.

The three hits were all benign:
- `fxincapapi/src/lib/email-settings.ts` — the *name* of a settings key (`"sendgrid_api_key"`)
- `fxincapapi/src/lib/smtp-settings.ts` — likewise (`"smtp_password"`)
- `fxincapws/README.md` — the placeholder `changeme-admin-token` / `REPLACE_WITH_YOUR_…`

No `.env` file is tracked; `git ls-files | grep .env` returns only `.example` templates. Commit
`1d95474 "Remove committed secrets for deploy"` indicates secrets were committed historically — see
§7.

**Conclusion: no credential rotation is required as a result of this audit.** The findings below are
about missing authorization and unsafe defaults, not leaked keys.

> This applies to **credentials only**. A separate and more serious exposure — real customer identity
> documents in git history — is documented in §7. Read that section first.

---

## 1. CRITICAL — Admin API has no authorization check

**Where:** [fxincapapi/src/routes/admin.ts](../fxincapapi/src/routes/admin.ts) — all 69 endpoints.

All admin routes use `verifyToken`, the *user* JWT middleware, which sets `req.user = { id, email }`
and performs no role check. `grep -cE "user_type|is_admin|requireAdmin" admin.ts` → `0`.

Any authenticated end user's token is therefore accepted for:

- `PUT /api/admin/wallet-report/:userId/balance` — set any account balance
- `POST /api/admin/traders/:userId/login-as` — impersonate any trader
- `POST /api/admin/traders/:userId/change-password`
- `POST /api/admin/server-settings/reset-all-users`
- `GET/POST /api/admin/email-settings` — read and rotate email credentials
- full read of every user, trade, fund request and KYC document

**Remedy:** add a `requireAdmin` middleware that resolves `req.user.id` against `admin_users` (or
`users.user_type`), and apply it at the mount point:
`app.use("/api/admin", verifyToken, requireAdmin, adminRoutes)` in
[index.ts:127](../fxincapapi/src/index.ts#L127). Verify no legitimate admin flow depends on a user
token first.

## 2. CRITICAL — Unauthenticated trade-mutating endpoints

| Endpoint | Effect |
| --- | --- |
| `POST /api/trades/price-update` | writes `current_price` and `pnl_percentage` for **any** `tradeId` |
| `POST /api/trades/admin/check-sl-tp` | closes a trade at a caller-supplied `bid`/`ask` |
| `POST /api/trades/admin/process-sl-tp-all` | triggers the SL/TP sweep |

[trades.ts:347](../fxincapapi/src/routes/trades.ts#L347),
[:372](../fxincapapi/src/routes/trades.ts#L372),
[:383](../fxincapapi/src/routes/trades.ts#L383) — none is wrapped in `verifyToken`.

Because the auto-close worker closes trades at `current_price`, `/price-update` is a direct route to
manipulating realized P&L on someone else's trade.

**Remedy:** `verifyToken` + ownership check on `/price-update`; a service-token or loopback-only
guard on the two `/admin/*` routes.

## 3. HIGH — Production infrastructure hard-coded as fallback defaults

A real managed-PostgreSQL hostname, port, database name and username appear as literal `||` fallbacks
in five files:

| File | Constant |
| --- | --- |
| [fxincapws/src/config.js](../fxincapws/src/config.js) | host / port / user / database |
| [fxincapapi/src/lib/database.ts](../fxincapapi/src/lib/database.ts) | same |
| [fxincaptrade/shared/database.ts](../fxincaptrade/shared/database.ts) | same |
| [fxincaptrade/server/db.js](../fxincaptrade/server/db.js) | same |
| [fxincapws/ecosystem.config.cjs](../fxincapws/ecosystem.config.cjs) | a **second**, different cluster |

Passwords are always `process.env.PGPASSWORD \|\| ""`, so no password is exposed. But:

1. The hostname, port, database and username of live infrastructure are public in a GitHub
   repository — half of a credential pair and a ready-made target list.
2. A service started without its `.env` silently attempts to reach production. **This is
   reproducible:** booting fxincapws locally with no configuration produced
   `password authentication failed for user "…"` against the real managed host (see
   [BASELINE.md](./BASELINE.md) §4).

**Remedy:** replace every fallback with fail-fast validation —
`const host = required("PGHOST")` that throws on boot. This changes production configuration
behaviour, so it needs approval and a staging test.

## 4. HIGH — Insecure default secrets

| Secret | Default | File |
| --- | --- | --- |
| `JWT_SECRET` | `"secret"` | [auth.ts](../fxincapapi/src/routes/auth.ts) `verifyToken` |
| `JWT_SECRET` | `'your-super-secret-jwt-key-change-in-production'` | [adminAuth.ts:11](../fxincapapi/src/services/adminAuth.ts#L11) |
| `ADMIN_TOKEN` | `changeme-admin-token` | [fxincapws/src/config.js](../fxincapws/src/config.js) |
| `WS_ADMIN_TOKEN` | `changeme-admin-token` | [admin server](../fxincapadmin/server/src/index.js), [Vite config](../fxincapadmin/client/vite.config.js) |
| `ADMIN_TOKEN` | `changeme-admin-token` | [fxincapws/ecosystem.config.cjs](../fxincapws/ecosystem.config.cjs) — **committed as a literal PM2 env value** |

Two independent `JWT_SECRET` fallbacks mean an unconfigured deployment mints admin tokens its own
`verifyToken` rejects. The `changeme-admin-token` pair matches on both sides, so an unconfigured
fxincapws admin API is effectively open.

**Remedy:** fail fast on boot when any of these is unset. `TODO: verify on production server` that
real values are configured.

## 5. HIGH — `GET /admin/settings` on fxincap-ws leaks the provider API key

[fxincapws/src/server.js:370](../fxincapws/src/server.js#L370):

```js
app.get('/admin/settings', async (req, res) => {
  const settings = await getSettings();     // { provider, api_key }
  res.json({ success: true, settings });
});
```

Its three sibling `/admin/*` routes all check `x-admin-token`; this one does not, and it returns the
active provider's API key in cleartext.

**Remedy:** add the same token check as the sibling routes. Low-risk, self-contained — but it is
still an authentication change, so it is deferred to an approved change.

## 6. MEDIUM

| # | Finding | Detail |
| --- | --- | --- |
| 6.1 | Client-supplied prices | `entryPrice` on open and `closePrice` on manual close are taken from the request body with no server-side validation. Combined with §2 the entire P&L of a trade is client-determined. |
| 6.2 | `CORS_ORIGIN` empty ⇒ `origin: true` | [index.ts:61](../fxincapapi/src/index.ts#L61) allows any origin with credentials when the allowlist is unset. |
| 6.3 | Unauthenticated `POST /api/email/send` | Open relay through the platform's own SendGrid/SMTP identity. |
| 6.4 | Unauthenticated `GET/POST /api/admin/style-settings` | Any caller can rewrite platform branding. |
| 6.5 | `PGSSL_REJECT_UNAUTHORIZED` defaults to `false` | DB traffic is encrypted but the certificate chain is not verified — MITM-able. |
| 6.6 | Secrets stored in plaintext in the database | `ws_api_keys.api_key`, `adm_settings.value` where `is_secret = TRUE`. Masked on the way out, plaintext at rest. |
| 6.7 | Provider API keys returned to the admin browser | `GET /admin/providers` returns `api_key` in full so the UI can build `wss://…?apikey=…` test URLs. |
| 6.8 | `FINNHUB_WEBHOOK_SECRET` unset ⇒ check skipped | `if (FINNHUB_WEBHOOK_SECRET && secret !== …)` — an empty secret disables verification entirely. |
| 6.9 | `/stream` WebSocket is unauthenticated and unthrottled | No token, no origin check, no connection or subscription cap. |
| 6.10 | `ADMIN_API_TOKEN` never verified | The admin server injects it; fxincapapi has no code that reads it. It provides no protection. |
| 6.11 | Admin token compared with `!==` | Not constant-time. |
| 6.12 | Runtime DDL against production | Several modules run `CREATE TABLE`/`ALTER TABLE` at import time. |
| 6.13 | `next.config.ts` sets `typescript.ignoreBuildErrors: true` | The marketing site's build cannot fail on a type error. |

## 7. 🚨 CRITICAL — Customer identity documents are in git history

**This is the most serious finding in the audit. It is a personal-data exposure, not a credential
leak, and it cannot be resolved by rotating anything.**

### What was found

The repository's **root commit** `1d95474` ("Remove committed secrets for deploy", 2026-03-31) added
**382 user-uploaded files** under `fxincapapi/uploads/`:

| Directory | Files | Content |
| --- | --- | --- |
| `uploads/kyc-documents/` | **210** | customer identity documents submitted for KYC |
| `uploads/deposit-screenshots/` | **158** | payment/bank transfer screenshots attached to deposit requests |
| `uploads/profile-pictures/` | 5 | user profile photos |
| `uploads/logos/`, `uploads/mails/` | 9 | platform assets (benign) |

Filenames embed the owning user's UUID, e.g.
`kyc-<user-uuid>-<timestamp>-<random>.jpg`, so each document is directly attributable to a specific
customer account. Individual files reach 4.3 MB; several exceed 1 MB.

Commit `52fc638` (2026-04-02) deleted 380 of them from the working tree, and `.gitignore` now
correctly excludes `uploads/**`. The current working tree contains only `.gitkeep` files.

### Why deletion did not fix it

Removing a file in a later commit does not remove it from history. The blobs remain fully reachable:

```
$ git rev-list --objects --all | grep kyc-documents | head -1
$ git cat-file -s <blob>      # → 140027   (still retrievable)
```

Every clone, fork, mirror, CI cache and the production server's own working copy contains these
objects. Anyone with read access to the repository — at any point since 2026-03-31 — can recover
every document with `git log --all --diff-filter=D` and `git show`.

### Immediate actions (in this order)

1. **Determine repository visibility now.** `https://github.com/lovusayani/fxincap_master` — if it is
   or ever was **public**, treat this as a confirmed personal-data breach with an unbounded audience,
   including search-engine and archival caches.
2. **Restrict access immediately** if public: make the repository private and audit the fork list,
   collaborator list and deploy keys.
3. **Assess notification obligations.** Identity documents and payment screenshots are exactly the
   categories that trigger data-protection breach notification in most jurisdictions (GDPR Art. 33/34
   and equivalents). This is a legal determination, not an engineering one — escalate it.
4. **Rewrite history to purge the blobs.** `git filter-repo --path fxincapapi/uploads --invert-paths`
   (or BFG). This rewrites every commit hash and requires a force-push.
5. **After the rewrite:** every clone must be re-cloned, including the production deploy directory.
   The deploy flow does `git reset --hard origin/<branch>`, which will *not* recover from a rewritten
   history — plan a re-clone on the server (see [DEPLOYMENT.md](./DEPLOYMENT.md)).
6. **Ask GitHub Support to purge cached views**, and delete/re-create forks. A force-push alone does
   not remove unreachable objects from GitHub's servers.
7. **Verify the upload path stays out of git**: `.gitignore` already covers `uploads/**` with a
   `!uploads/.gitkeep` exception. Confirm production writes uploads outside the repo, or to a path
   that stays ignored.

**This audit did not perform the history rewrite** — rewriting history and force-pushing were
explicitly excluded from this task, and a rewrite here has production-deployment consequences that
must be scheduled. It requires your explicit approval.

### Credentials in history

Separately from the PII issue: no `.env` file (other than `.example` templates) was ever added in any
commit on any branch —

```
$ git log --all --diff-filter=A --name-only --pretty=format: | grep -iE '\.env($|\.)' | sort -u
.deploy.env.example
fxincap/.env.example
fxincapadmin/client/.env.example
fxincapapi/.env.example
fxincaptrade/.env.example
fxincaptrade/.env.production.example
```

Despite its message, `1d95474` is the repository's **root commit** — it adds files only. The history
appears to be a clean-slate import made *after* secrets were stripped. **No credential rotation is
required on account of git history.** Enabling GitHub secret scanning and push protection is still
recommended.

See [GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md).

## 8. Other infrastructure disclosure

| File | Content |
| --- | --- |
| [server-setup.sh](../server-setup.sh) | a server IP address, the deploy username, and a CI/CD **public** key. Public keys are not secret; the IP + username pair is a reconnaissance aid. |
| [deploy-remote.ps1](../deploy-remote.ps1) | an SSH host alias and a server-side script path |
| `*/script.sh`, `fxincap/clean_pm2_logs.sh` | absolute server paths under a legacy brand's directory layout |
| [fxincapapi/tmp_*.{js,cjs,mjs}](../fxincapapi/) | production DB host/user plus a developer's absolute local path — **deleted in this pass**, see [REPOSITORY_CLEANUP.md](./REPOSITORY_CLEANUP.md) |

## 9. Priority order

0. **Check repository visibility and contain the KYC/deposit-document exposure (§7)** — before anything else
1. Add admin authorization (§1)
2. Authenticate the three trade-mutating endpoints (§2)
3. Verify real `JWT_SECRET` / `ADMIN_TOKEN` values in production, then remove the fallbacks (§4)
4. Add the token check to `GET /admin/settings` (§5)
5. Replace hard-coded DB fallbacks with fail-fast validation (§3)
6. Purge `fxincapapi/uploads` from git history and re-clone every working copy (§7)
7. Set an explicit `CORS_ORIGIN` allowlist; authenticate `/api/email/send` and `style-settings` (§6)
8. Turn on `PGSSL_REJECT_UNAUTHORIZED` with a CA bundle (§6.5)

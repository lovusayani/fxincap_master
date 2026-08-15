# Development Workflow

The one loop this project uses: **develop locally → test → push to `main` → auto-deploy**.

Read this before your first change. Everything else in `docs/` explains the system;
this explains how to work on it.

---

## 1. The loop

```
local branch  →  test locally  →  PR into main  →  merge  →  webhook  →  production
```

Merging to `main` deploys. There is no separate "release" step, and no staging
environment — `main` is production.

## 2. Environments

| | Location | Branch |
| --- | --- | --- |
| Local | your machine | feature branch |
| GitHub | `lovusayani/fxincap_master` | `main` |
| Production | `kaka:/var/www/fxincap-production` | `main` |

All three must sit on the same commit once a deploy finishes. Check with:

```bash
git rev-parse --short HEAD                                   # local
git ls-remote origin refs/heads/main                         # github
ssh kaka 'cd /var/www/fxincap-production && git rev-parse --short HEAD'   # live
```

## 3. Making a change

```bash
git checkout main
git pull --ff-only origin main       # always start from current main
git checkout -b feat/what-you-are-doing
# … work …
```

**Never commit directly to `main`.** A push to `main` deploys to production
immediately, skipping review and testing.

## 4. Testing before you push

Run whatever covers the app you touched. All of these must pass:

```bash
cd fxincapapi   && npx tsc --noEmit && npx vitest --run     # 16 tests
cd fxincapws    && node --test src/providers/infoway.test.js # 27 tests
cd fxincapadmin/client && npx vite build
cd fxincaptrade && npm run build
```

There is **no build gate in the deploy pipeline** — `deploy-prod.sh` will happily
build and restart broken code. Local testing is the only gate that exists.

## 5. Shipping

```bash
git push -u origin feat/what-you-are-doing
gh pr create --base main --fill
```

Merge the PR when it's ready. That fires the webhook and deploys.

## 6. What a deploy actually does

`main` receives a push → GitHub POSTs to `https://ncapfx.com/hooks/deploy`
(HMAC-SHA256 signed) → `deploy/webhook-server.cjs` on port 9010 verifies the
signature → runs `deploy-prod.sh`:

1. `git fetch` + **`git reset --hard origin/main`** — any uncommitted change on the
   server is destroyed. Never edit files directly on production.
2. `install-prod.sh` — `pnpm install` and build for all five apps
3. `run-prod.sh` — `pm2 delete` + `pm2 start` for the five app processes

Step 3 deletes processes rather than reloading, so **every deploy causes a brief
outage**. Deploy accordingly.

## 7. Watching a deploy

```bash
ssh kaka 'pm2 logs fxincap-deploy-webhook --lines 50 --nostream'
ssh kaka 'pm2 list'
```

Delivery failures appear in GitHub under **Settings → Webhooks → Recent Deliveries**.

## 8. Verifying after deploy

```bash
ssh kaka 'cd /var/www/fxincap-production && git rev-parse --short HEAD'   # matches main?
ssh kaka 'pm2 list | grep fxincap'                                       # all online, restarts low?
for u in https://ncapfx.com https://trade.ncapfx.com https://admin.ncapfx.com; do
  curl -s -o /dev/null -w "$u -> %{http_code}\n" "$u"
done
```

A service that starts and immediately dies almost always means a missing environment
variable — both `fxincapapi` and `fxincapws` call `process.exit(1)` on missing config
by design. Check `pm2 logs <name> --err`.

## 9. Rolling back

```bash
git revert -m 1 <merge-commit>     # revert on main
git push origin main               # redeploys the previous state
```

Prefer this over resetting history. `main` is shared and its history must not be
rewritten.

## 10. Environment variables

`.env` files live **only on the server** and are never committed. Templates are
`*.env.example`. Adding a new required variable means adding it to the server
*before* the code that requires it is merged, or the deploy will crash-loop.

Currently required, per `fxincapapi/src/lib/env.ts` and `fxincapws/src/config.js`:

- **fxincapapi** — `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `PGHOST`, `PGUSER`,
  `PGPASSWORD`, `PGDATABASE`
- **fxincapws** — `ADMIN_TOKEN`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- **deploy** — `DEPLOY_BRANCH`, `DEPLOY_WEBHOOK_SECRET`, `VITE_API_URL` in `.deploy.env`

## 11. Rules

- `main` is production — never push to it directly
- Never edit files on the production server; `git reset --hard` erases them
- Never commit a secret; `.env` stays gitignored
- Never force-push a shared branch
- Database changes must be additive migrations, not destructive DDL
- Test locally before opening a PR — nothing downstream will catch it for you

# Deployment — DigitalOcean Production

> **The production deployment is live. Nothing in this document was changed during the audit.**
> This describes the deployment exactly as the repository defines it. Facts that cannot be
> established from the repository are marked `TODO: verify on production server`.
>
> Consolidated from the previous root `DEPLOYMENT.md`.

## 1. Model

Deployment is **push-to-deploy via a GitHub webhook**, not GitHub Actions. There are no workflow
files in the repository.

```
 developer                GitHub                      production server
 ─────────                ──────                      ─────────────────
 git push  ──────────────► push event
                              │
                              │  POST https://fxincap.com/hooks/deploy
                              │  X-Hub-Signature-256: sha256=…
                              ▼
                       nginx (TLS) ──► deploy/webhook-server.cjs   :9010
                                          │  HMAC-SHA256 verify (timingSafeEqual)
                                          │  ref === refs/heads/$DEPLOY_BRANCH ?
                                          ▼
                                     deploy-prod.sh
                                          │  git fetch --prune origin
                                          │  git reset --hard origin/$DEPLOY_BRANCH
                                          ├─► install-prod.sh   pnpm install + build ×5
                                          └─► run-prod.sh       pm2 delete + start ×5, pm2 save
```

## 2. Server prerequisites

From [server-setup.sh](../server-setup.sh) and [install-prod.sh](../install-prod.sh):

| Requirement | Notes |
| --- | --- |
| Linux (Ubuntu/Debian family) | `apt-get`, NodeSource repo |
| Node.js 18+ | `server-setup.sh` installs the 18.x NodeSource line. `TODO: verify on production server` which version actually runs. |
| pnpm | `npm install -g pnpm` — the only supported package manager |
| PM2 (global) | `pm2 startup` + `pm2 save` for boot persistence |
| git | required — `deploy-prod.sh` aborts without a `.git` directory |
| nginx | TLS termination and reverse proxy. `TODO: verify on production server` — no nginx config for the main sites is in the repo; only [fxincaptrade/deploy/nginx-trade.example.conf](../fxincaptrade/deploy/nginx-trade.example.conf) |
| PostgreSQL | DigitalOcean managed cluster, external |

## 3. Processes and ports

`run-prod.sh` and `ecosystem.production.portable.cjs` agree:

| PM2 name | cwd | Port | Command |
| --- | --- | --- | --- |
| `fxincap-app` | `fxincap` | 4000 | `pnpm start` |
| `fxincap-admin` | `fxincapadmin` | 5001 | `pnpm run start` |
| `fxincap-api` | `fxincapapi` | 7000 | `node dist/index.js` |
| `fxincap-trade` | `fxincaptrade` | 3000 | `node dist/server/start.js` |
| `fxincap-ws` | `fxincapws` | 4040 (`WS_PORT`) | `node src/server.js` |
| `fxincap-deploy-webhook` | repo root | 9010 (`DEPLOY_PORT`) | `node deploy/webhook-server.cjs` |

Common PM2 settings: `exec_mode: fork`, `instances: 1`, `autorestart: true`, `watch: false`,
`max_memory_restart: 500M` (300M for the webhook), logs under `logs/`.

**Two ways to start exist and they are not equivalent:**

- `run-prod.sh` — imperative `pm2 delete` + `pm2 start`. **This is what the webhook actually runs.**
- `ecosystem.production.portable.cjs` — declarative, for `pm2 startOrReload`. Not referenced by any
  script in the deploy path.

`run-prod.sh` deletes the five app processes on every deploy, so each deploy causes a brief outage
rather than a rolling reload. The webhook process itself is restarted with `--update-env` instead of
deleted, so it survives.

## 4. Domains

| Domain | Serves | Evidence |
| --- | --- | --- |
| `fxincap.com` | marketing site + `/hooks/deploy` | `.deploy.env.example`, `DEPLOYMENT.md` |
| `api.fxincap.com` | fxincapapi | `.deploy.env.example` `VITE_API_URL` |
| `trade.fxincap.com` | fxincaptrade | `fxincaptrade/.env.production.example` |
| `admin.fxincap.com` | fxincapadmin | `fxincapapi/.env.example` `VERIFICATION_URL` |
| `ws.fxincap.com` | fxincapws | admin server `WS_SERVICE_URL` default |

**Legacy `suimfx.world` domains** still appear as code defaults and in log-cleanup scripts:
`api.suimfx.world` (⚠ the admin server's `ADMIN_API_URL` default), `trade.suimfx.world`,
`dashboard.suimfx.world`, `admin.suimfx.world`, `terminal.suimfx.world`.
`TODO: verify on production server` whether any still resolve.

**Two deployment layouts appear in the repository:**

- `/var/www/...` — `server-setup.sh`, `DEPLOYMENT.md` examples (the portable/monorepo layout)
- `/home/<user>/htdocs/<domain>` — per-service `ecosystem.config.cjs` files, `script.sh` log cleaners
  (a CloudPanel-style per-site layout)

`TODO: verify on production server` which layout is live. The per-service ecosystem files are kept
for that reason.

## 5. Server-side configuration

```bash
cd /path/to/repo
bash setup-server-deploy-env.sh   # creates .deploy.env from the example, chmod 600, never overwrites
nano .deploy.env                  # DEPLOY_WEBHOOK_SECRET, DEPLOY_BRANCH, VITE_API_URL
```

`run-prod.sh` **exits with an error** if `DEPLOY_WEBHOOK_SECRET` is unset. Per-service `.env` files
are separate — see [ENVIRONMENT.md](./ENVIRONMENT.md).

## 6. GitHub webhook

Already configured — **do not create a second one**.

| Setting | Value |
| --- | --- |
| Payload URL | `https://fxincap.com/hooks/deploy` |
| Content type | `application/json` |
| Secret | must equal `DEPLOY_WEBHOOK_SECRET` in `.deploy.env` |
| Events | push only |
| Branch filter | must match `DEPLOY_BRANCH` in `.deploy.env` — this must be `main`, not the `dev` code default (see below) |

`webhook-server.cjs` behaviour:
- rejects a missing/short/invalid signature (`crypto.timingSafeEqual`);
- ignores pushes whose `ref !== refs/heads/$DEPLOY_BRANCH`;
- guards against concurrent deploys with an `isDeployRunning` flag;
- spawns `bash deploy-prod.sh` with `stdio: "inherit"`, so deploy output lands in the PM2 log.

> ### ⚠ `DEPLOY_BRANCH` defaults to `dev`, but `dev` cannot deploy
>
> `DEPLOY_BRANCH` defaults to **`dev`** in `webhook-server.cjs`, `run-prod.sh`,
> `ecosystem.production.portable.cjs` and `.deploy.env.example`. That default is **unusable**:
>
> ```
> $ git merge-base main origin/dev
> 1d95474            # the ROOT commit — main and dev share nothing else
>
> $ git log --oneline main..origin/dev
> 9ba7440 chore: final webhook completion check      ← empty
> 16baaa2 chore: webhook e2e final verification      ← empty
> 11d5962 chore: trigger dev deploy webhook test     ← empty
>
> $ git cat-file -e origin/dev:deploy-prod.sh   → ABSENT
> $ git cat-file -e origin/dev:install-prod.sh  → ABSENT
> $ git cat-file -e origin/dev:run-prod.sh      → ABSENT
> $ git cat-file -e origin/dev:deploy/          → ABSENT
> ```
>
> `origin/dev` is the root commit plus three **empty** webhook-test commits. It contains none of the
> deploy chain. A deploy from `dev` would `git reset --hard origin/dev`, delete `deploy-prod.sh`,
> `install-prod.sh`, `run-prod.sh` and `deploy/webhook-server.cjs` from the server, and permanently
> break deployment.
>
> **Therefore the live `.deploy.env` almost certainly sets `DEPLOY_BRANCH=main`** — production has
> been deploying successfully, which is impossible from `dev`. Treat **`main` as the deployment
> branch**. `TODO: verify on production server`: `grep DEPLOY_BRANCH /path/to/repo/.deploy.env`.
>
> **Never set `DEPLOY_BRANCH=dev`** and never push to `dev` expecting a deploy, until `dev` is either
> deleted or fast-forwarded to `main`.

## 7. Build

`install-prod.sh`:

1. sources `.deploy.env`, exports `VITE_API_URL` (default `https://api.fxincap.com`);
2. requires `node` and `pnpm`;
3. creates `logs/` and the four upload directories;
4. `pnpm install --frozen-lockfile` in each of the five services;
5. `pnpm build` in fxincap, fxincapadmin, fxincapapi, fxincaptrade — **fxincapws has no build step**.

`--frozen-lockfile` means a `pnpm-lock.yaml` out of sync with `package.json` **fails the deploy**.
Always commit lockfile changes.

`VITE_API_URL` is inlined into the fxincaptrade bundle at build time — changing it requires a rebuild,
not just a restart.

## 8. Manual deployment

```bash
cd /path/to/repo
export DEPLOY_BRANCH=main   # NOT dev — see §6
bash deploy-prod.sh
```

Rebuild without pulling (emergency only):

```bash
DEPLOY_ALLOW_NO_GIT=1 bash deploy-prod.sh
```

## 9. Push-to-live requires a git clone

`deploy-prod.sh` runs `git fetch` + `git reset --hard origin/$DEPLOY_BRANCH`. If the deploy directory
has no `.git`, deploys cannot pull new code and the script exits with an error.

One-time migration, preserving `.deploy.env`:

```bash
sudo -i -u <deploy-user>
cd /var/www
cp fxincap-production/.deploy.env /tmp/fxincap.deploy.env.SAVE
mv fxincap-production fxincap-production.bak-$(date +%Y%m%d)
git clone -b dev --single-branch https://github.com/lovusayani/fxincap_master.git fxincap-production
cp /tmp/fxincap.deploy.env.SAVE fxincap-production/.deploy.env
chmod 600 fxincap-production/.deploy.env
cd fxincap-production && bash deploy-prod.sh
```

`git reset --hard` **discards local modifications on the server every deploy.** Never hand-edit
tracked files in the deploy directory; `.deploy.env` and the per-service `.env` files survive because
they are gitignored.

## 10. Monitoring

```bash
pm2 status
pm2 logs                        # all
pm2 logs fxincap-api
pm2 logs fxincap-deploy-webhook # deploy output
pm2 monit
```

Health endpoints:

| Service | Check |
| --- | --- |
| fxincapapi | `curl http://127.0.0.1:7000/api/ping` |
| fxincapws | `curl http://127.0.0.1:4040/health` — inspect `provider_status`, `provider_error`, `ws_clients` |
| fxincapadmin | `curl http://127.0.0.1:5001/health` |
| fxincaptrade | `curl http://127.0.0.1:3000/api/ping` |
| fxincap | `TODO: verify on production server` — no health route |

Logs live in `logs/` at the repo root (`*-error.log`, `*-out.log`). Log rotation is
`TODO: verify on production server` — the repo's only rotation is the ad-hoc `script.sh` files that
target legacy paths. Consider `pm2 install pm2-logrotate`.

## 11. Restart / rollback

```bash
pm2 restart fxincap-api        # single service
pm2 restart all
bash run-prod.sh               # full re-registration
```

**Rollback** — there is no versioned release directory and no rollback script. The only mechanism is
git:

```bash
cd /path/to/repo
git log --oneline -10
git reset --hard <known-good-sha>
bash install-prod.sh
bash run-prod.sh
```

Note this leaves the deploy directory detached from `origin/$DEPLOY_BRANCH`; the next webhook deploy
will reset it forward again. To roll back durably, revert on GitHub and let the webhook deploy the
revert.

There is **no database rollback**. Migrations are manual and unversioned — see
[DATABASE.md](./DATABASE.md) §2.

## 12. Staging

`install-staging.sh`, `run-staging.sh` and `ecosystem.staging.portable.cjs` exist and mirror
production on the same ports with `NODE_ENV=staging` and no webhook process. `run-staging.sh` uses
`pm2 startOrReload` (declarative) rather than `run-prod.sh`'s delete-and-start.

`TODO: verify on production server` whether a staging environment is deployed. Because the ports are
identical, staging cannot run on the same host as production.

## 13. Deployment-related files kept deliberately

| File | Why |
| --- | --- |
| `deploy-prod.sh`, `install-prod.sh`, `run-prod.sh` | the live deploy chain |
| `deploy/webhook-server.cjs` | PM2 process `fxincap-deploy-webhook` |
| `.deploy.env.example`, `setup-server-deploy-env.sh` | server configuration |
| `ecosystem.production.portable.cjs` | alternative declarative start |
| `ecosystem.*.portable.cjs`, `install-staging.sh`, `run-staging.sh` | staging path |
| `fxincap*/ecosystem.config.cjs` | per-service PM2 configs for the `/home/*/htdocs` layout |
| `server-setup.sh` | one-time provisioning reference |
| `fxincaptrade/deploy/nginx-trade.example.conf` | only nginx reference in the repo |

## 14. Known deployment risks

| # | Risk |
| --- | --- |
| 1 | `run-prod.sh` deletes processes before starting → downtime on every deploy |
| 2 | Two divergent PM2 definitions (imperative script vs ecosystem file) can drift apart |
| 3 | Two divergent directory layouts (`/var/www` vs `/home/*/htdocs`) |
| 4 | `DEPLOY_BRANCH` defaults to `dev`, a vestigial branch holding none of the deploy chain — using the default would permanently break deployment (§6) |
| 5 | No rollback script, no release versioning, no database rollback |
| 6 | `git reset --hard` silently discards any server-side edit to a tracked file |
| 7 | If git history is ever rewritten (see [SECURITY.md](./SECURITY.md) §7), the deploy directory must be **re-cloned** — `git reset --hard` will not recover |

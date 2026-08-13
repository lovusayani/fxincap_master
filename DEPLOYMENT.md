# Deployment

**This document has moved to [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).**

That version is consolidated and expanded: the webhook chain, PM2 processes and ports, domains,
server-side configuration, build steps, monitoring, restart and rollback procedures, staging, and the
known deployment risks.

This file is kept at the repository root because [deploy-prod.sh](deploy-prod.sh) refers to
`DEPLOYMENT.md` by name in its error output.

## Quick reference

```
git push → GitHub → POST https://fxincap.com/hooks/deploy   (HMAC-SHA256 verified)
                  → deploy/webhook-server.cjs :9010
                  → deploy-prod.sh    git fetch && git reset --hard origin/$DEPLOY_BRANCH
                      → install-prod.sh    pnpm install --frozen-lockfile + build ×5
                      → run-prod.sh        pm2 delete + start ×5, pm2 save
```

| PM2 process | Port |
| --- | --- |
| `fxincap-app` | 4000 |
| `fxincap-admin` | 5001 |
| `fxincap-api` | 7000 |
| `fxincap-trade` | 3000 |
| `fxincap-ws` | 4040 |
| `fxincap-deploy-webhook` | 9010 |

Server configuration lives in a gitignored `.deploy.env` (`DEPLOY_WEBHOOK_SECRET`, `DEPLOY_BRANCH`,
`VITE_API_URL`) — create it with `bash setup-server-deploy-env.sh`.

Manual deploy:

```bash
cd /path/to/repo
bash deploy-prod.sh
```

Do **not** register a second GitHub webhook. The existing one at
`https://fxincap.com/hooks/deploy` is the only one required.

### Push-to-live requires a git clone

`deploy-prod.sh` runs `git reset --hard origin/$DEPLOY_BRANCH`. If the deploy directory has no
`.git`, deploys cannot pull new code — see
[docs/DEPLOYMENT.md §9](docs/DEPLOYMENT.md) for the one-time migration.

Emergency rebuild without pulling:

```bash
DEPLOY_ALLOW_NO_GIT=1 bash deploy-prod.sh
```

### Troubleshooting

```bash
pm2 logs fxincap-deploy-webhook   # deploy output; 401 = secret mismatch
pm2 status
```

Full runbook: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

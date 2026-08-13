# ADR-0003 — PM2 + GitHub webhook deployment on a single DigitalOcean host

**Status:** Accepted (documented retrospectively, 2026-08-10)

## Context

Five Node.js services must run continuously on one DigitalOcean droplet, survive crashes and reboots,
and be updatable by the developer without a manual SSH session for every change.

The repository's root commit contained GitHub Actions workflows (`ci-production.yml`,
`ci-staging.yml`) and SSH deploy secrets. Those were later removed; the current `DEPLOYMENT.md`
explicitly labels the SSH/rsync path "legacy reference only".

## Decision

**Process management: PM2.** Six processes in fork mode, one instance each, `autorestart: true`,
`max_memory_restart: 500M`, logs to `logs/`, persisted with `pm2 save` + `pm2 startup`.

**Deployment: a self-hosted GitHub webhook receiver.**

```
git push → GitHub push event
         → POST https://fxincap.com/hooks/deploy  (X-Hub-Signature-256)
         → nginx → deploy/webhook-server.cjs :9010
         → HMAC-SHA256 verify + branch check
         → deploy-prod.sh
              git fetch --prune && git reset --hard origin/$DEPLOY_BRANCH
              install-prod.sh   (pnpm install --frozen-lockfile + build ×5)
              run-prod.sh       (pm2 delete + start ×5, pm2 save)
```

Server-side configuration lives in a gitignored `.deploy.env` holding `DEPLOY_WEBHOOK_SECRET`,
`DEPLOY_BRANCH` and `VITE_API_URL`.

## Why

1. **No CI runner to pay for or maintain.** The webhook receiver is ~100 lines of Node with no
   dependencies beyond the standard library.
2. **No deploy credentials leave the server.** GitHub Actions SSH deployment requires a private key
   stored as a repository secret. The webhook inverts that: GitHub holds only a shared HMAC secret,
   and the server pulls. Nothing outside the droplet can execute code on it.
3. **`git reset --hard` is unambiguous.** The deploy directory is always exactly a commit — no
   partial rsync, no drift.
4. **PM2 fits the shape of the workload.** Long-lived Node processes needing restart-on-crash,
   boot persistence, memory ceilings and log capture. Kubernetes or Docker Swarm would be
   disproportionate for one droplet.
5. **`--frozen-lockfile` makes builds reproducible** and turns lockfile drift into a loud deploy
   failure rather than a silent dependency change.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| GitHub Actions + SSH/rsync | Requires a private deploy key in GitHub secrets; was tried and abandoned |
| Docker + registry | Adds image builds, a registry and orchestration for five processes on one host |
| Manual `ssh` + `git pull` | What `deploy-remote.ps1` does; no signature verification, no audit trail, and it auto-generates meaningless commit messages |
| systemd units | Would work, but PM2 gives log capture, memory limits and `pm2 status` in one tool |
| A PaaS (App Platform, Render) | Five services × managed pricing, and the WebSocket service needs long-lived upstream connections |

## Consequences

**Positive**
- Push-to-deploy with no external CI dependency.
- Signature-verified, branch-filtered, and guarded against concurrent runs.
- One command (`bash run-prod.sh`) rebuilds the entire process topology.
- `pm2 save` + `pm2 startup` survive a droplet reboot.

**Negative**
1. **Downtime on every deploy.** `run-prod.sh` does `pm2 delete` before `pm2 start` — not a rolling
   reload. All five services drop simultaneously.
2. **No build gate.** The webhook builds and restarts whatever was pushed. A broken commit reaches
   production; there are no tests and no CI to stop it.
3. **No rollback mechanism.** No release directories, no versioned artefacts. Rolling back means
   `git reset --hard <sha>` + rebuild, which also detaches the directory from its branch.
4. **Two competing PM2 definitions.** `run-prod.sh` (imperative, actually used) and
   `ecosystem.production.portable.cjs` (declarative, not in the deploy path) can drift apart.
5. **Two competing directory layouts.** `/var/www/...` in the root scripts versus
   `/home/<user>/htdocs/<domain>` in the per-service ecosystem files.
6. **Single point of failure.** One droplet, one webhook receiver. If port 9010 is down, deployment
   stops.
7. **Branch confusion.** `DEPLOY_BRANCH` defaults to `dev`, but `origin/dev` shares only the root
   commit with `main` and contains **none** of the deploy chain. Deploying from it would delete
   `deploy-prod.sh`, `install-prod.sh` and `run-prod.sh` from the server and break deployment
   permanently. The live `.deploy.env` must override the default to `main`.
8. **`git reset --hard` destroys server-side edits** to tracked files without warning.
9. **A future history rewrite requires a re-clone.** `git reset --hard` cannot recover from rewritten
   history — relevant given [SECURITY.md](../SECURITY.md) §7.

## Follow-ups

1. Replace `pm2 delete` + `pm2 start` with `pm2 startOrReload ecosystem.production.portable.cjs`,
   eliminating both the downtime and the duplicate definition.
2. Reconcile `main` and `dev` and settle on one deployment branch.
3. Add a build gate (even just typecheck + build) before the PM2 restart.
4. Add `pm2 install pm2-logrotate`.
5. Document the live directory layout and delete the ecosystem files for the layout not in use.

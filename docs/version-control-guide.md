# FXFX Version Control And Deployment Guide

This is the single workflow document for local development, GitHub branch maintenance, staging deployment, and production promotion.

## 1) Branch purpose

- `dev` = active development branch
- `dev` = staging deployment source branch
- `main` = stable branch after staging validation

Current intended logic:

1. Develop locally on `dev`.
2. Push `dev` to GitHub.
3. Your staging server runs from GitHub `dev`.
4. After testing is approved, promote `dev` into `main`.
5. Keep `main` clean and stable.

## 2) Daily development workflow

Before starting work:

```powershell
git checkout dev
git pull origin dev
```

After making changes:

```powershell
git add .
git commit -m "type(scope): summary"
git push origin dev
```

Examples:

- `feat(trade): add wallet promo handling`
- `fix(api): correct verification redirect`
- `chore(repo): update staging workflow docs`

## 3) Staging server workflow

Your staging server should always use the GitHub `dev` branch.

Clone the repo on the server:

```bash
git clone --branch dev https://github.com/soniadcam2025/fxtrade.git /var/www/fxincap-staging
cd /var/www/fxincap-staging
```

Run staging installation:

```bash
bash install-staging.sh
bash run-staging.sh
```

When updating staging later:

```bash
cd /var/www/fxincap-staging
git fetch origin
git checkout dev
git reset --hard origin/dev
bash install-staging.sh
bash run-staging.sh
```

## 4) Promote staging to main

Only promote after staging is verified.

From local machine:

```powershell
git checkout main
git pull origin main
git merge origin/dev
git push origin main
```

If you prefer fast-forward only:

```powershell
git checkout main
git pull origin main
git merge --ff-only origin/dev
git push origin main
```

## 5) One-time server requirements

Required on the Linux staging server:

- Node.js 20+
- pnpm 10.14.0
- PM2 installed globally

Typical installation:

```bash
npm install -g pnpm@10.14.0
npm install -g pm2
```

## 6) One-time local helper scripts

Optional local helper setup:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-git-workflow.ps1
```

Optional GitHub publish helper:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/publish-github.ps1 -RemoteUrl "https://github.com/<username>/<repo>.git"
```

Optional auto-sync task:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-autosync-task.ps1 -IntervalMinutes 10
```

The auto-sync task will:

1. Pull latest changes with rebase.
2. Auto-stage local changes.
3. Create a smart commit message.
4. Push to GitHub.

## 7) Local recovery and safety

If you create temporary local commits that are not ready for GitHub:

1. Keep them on a backup branch.
2. Do not leave `dev` diverged from `origin/dev`.
3. Re-align `dev` before continuing shared work.

Recommended pattern:

```powershell
git checkout -b backup/my-local-work
```

Then return to clean `dev`:

```powershell
git checkout dev
git pull origin dev
```

## 8) Rules for keeping the repo clean

Keep these out of shared commits unless they are intentionally part of the product:

- temporary debug files
- test screenshots
- generated release bundles
- local-only staging archives
- server-specific secrets

Development repo should contain:

- source code
- required configs
- lockfiles
- scripts needed by the team
- documentation needed to maintain the workflow

## 9) Canonical branch policy

Use this policy consistently:

1. `dev` is the branch for coding.
2. `dev` is the branch used by the staging server.
3. `main` is updated only after staging validation.
4. Do not develop directly on `main`.
5. Do not treat `main` as a scratch branch.

## 10) Quick command summary

Develop and push to staging branch:

```powershell
git checkout dev
git pull origin dev
git add .
git commit -m "type(scope): summary"
git push origin dev
```

Update staging server from GitHub `dev`:

```bash
cd /var/www/fxincap-staging
git fetch origin
git checkout dev
git reset --hard origin/dev
bash install-staging.sh
bash run-staging.sh
```

Promote approved staging code to `main`:

```powershell
git checkout main
git pull origin main
git merge --ff-only origin/dev
git push origin main
```

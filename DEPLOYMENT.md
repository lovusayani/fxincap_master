# FX Incap Monorepo - Deployment Guide

Deployments use a **GitHub webhook** hitting **`deploy/webhook-server.cjs`** on the server (PM2: `fxincap-deploy-webhook`), not GitHub Actions. Push → GitHub sends `push` → server runs **`deploy-prod.sh`** → **`install-prod.sh`** (install + build) → **`run-prod.sh`** (PM2).

Server env: copy **`.deploy.env.example`** → **`.deploy.env`** (gitignored), or run **`bash setup-server-deploy-env.sh`** once from the repo root on the server (creates **`.deploy.env`** if missing). Then set **`DEPLOY_WEBHOOK_SECRET`**, **`DEPLOY_BRANCH`**, and **`VITE_API_URL`**.

> **Note:** This assistant cannot SSH into your server. After you `git pull`, run the commands in **Final checklist** below on the machine that hosts the app.

## 📁 Repository Structure

```
fxfx/
├── fxincap/           # Main landing page (Next.js)
├── fxincapadmin/      # Admin dashboard (Vite React)
├── fxincapapi/        # API backend (Node.js)
├── fxincaptrade/      # Trading platform (Vite + Node.js)
├── fxincapws/         # WebSocket server (Node.js)
├── deploy/
│   └── webhook-server.cjs   # HTTP webhook (GitHub push → deploy-prod.sh)
├── deploy-prod.sh     # git fetch/reset + install-prod + run-prod
├── install-prod.sh    # pnpm install + build (reads .deploy.env for VITE_API_URL)
├── run-prod.sh        # PM2 start (sources .deploy.env)
├── setup-server-deploy-env.sh  # one-time: create .deploy.env from example (run on server)
└── .deploy.env.example
```

## 🚀 Deployment Strategy

### Branch Structure
- Configure **`DEPLOY_BRANCH`** in **`.deploy.env`** to match the branch this server should deploy (e.g. `dev` or `main`).

### Webhook flow

1. **Push** to the configured branch on GitHub  
2. **GitHub** POSTs to **`https://fxincap.com/hooks/deploy`** (existing webhook; nginx terminates TLS and proxies to **`deploy/webhook-server.cjs`** on **`DEPLOY_PORT`** default **9010**) with **`X-Hub-Signature-256`**  
3. **`webhook-server.cjs`** verifies the secret and runs **`deploy-prod.sh`**  
4. **`install-prod.sh`** builds all apps with **`VITE_API_URL`** from **`.deploy.env`**

### GitHub repository webhook (already configured — do not add a duplicate)

- **Payload URL:** **`https://fxincap.com/hooks/deploy`**  
- **Content type:** `application/json`  
- **Secret:** must match **`DEPLOY_WEBHOOK_SECRET`** in server **`.deploy.env`** (same secret you already set in GitHub)  
- **Events:** Just the push event  

If deliveries fail, fix **`.deploy.env`** / PM2 **`fxincap-deploy-webhook`** / nginx — do **not** register a second webhook unless you retire the old one.

## ⚙️ Legacy: SSH / rsync (optional)

If you previously used SSH-based deploy secrets, those are **not** required for the webhook path. Remove or ignore old docs that referenced GitHub Actions deploy jobs.

### Staging Secrets (push to `dev` branch) — legacy reference only
```
DEPLOY_KEY_STAGING      # Private SSH key for staging server
DEPLOY_HOST_STAGING     # Staging server hostname/IP
DEPLOY_USER_STAGING     # SSH user (e.g., deploy)
DEPLOY_PATH_STAGING     # Path where code is deployed (e.g., /var/www/fxincap)
```

### Production Secrets (push to `main` branch)
```
DEPLOY_KEY_PROD         # Private SSH key for production server
DEPLOY_HOST_PROD        # Production server hostname/IP
DEPLOY_USER_PROD        # SSH user (e.g., deploy)
DEPLOY_PATH_PROD        # Path where code is deployed (e.g., /var/www/fxincap)
```

## 🔑 Setting Up SSH Key-based Deployment

### Step 1: Generate SSH Key Pair (on your development machine)

```bash
ssh-keygen -t ed25519 -f fxincap-deploy -C "fxincap-deploy"
# Or use RSA if ed25519 not available:
# ssh-keygen -t rsa -b 4096 -f fxincap-deploy -C "fxincap-deploy"
```

This creates two files:
- `fxincap-deploy` (private key - keep secret)
- `fxincap-deploy.pub` (public key - share with server)

### Step 2: Configure Server (Linux/VPS)

```bash
# SSH into your server
ssh user@your-server.com

# Create deploy user (if not exists)
sudo useradd -m -s /bin/bash deploy

# Add public key to authorized_keys
sudo -u deploy -i bash -c 'mkdir -p ~/.ssh && echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'

# Create deployment directory
sudo mkdir -p /var/www/fxincap
sudo chown deploy:deploy /var/www/fxincap
```

### Step 3: Align secret with the existing webhook

Your payload URL is already **`https://fxincap.com/hooks/deploy`**. On the server, **`DEPLOY_WEBHOOK_SECRET`** in **`.deploy.env`** must be the **same** string as the **Secret** on that GitHub webhook.

## 📋 Server Setup Requirements

Your Linux server needs:
- Node.js 18+ (`node -v`)
- pnpm (`pnpm -v`)
- PM2 globally (`npm install -g pm2`)
- PostgreSQL (if using database)
- Git (`git --version`)

### Quick Server Setup

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2 (process manager)
npm install -g pm2

# Configure PM2 startup
pm2 startup
pm2 save
```

## 🔄 Deployment Workflow

### Manual deployment (same as webhook)

From the repo root on the server:

```bash
export DEPLOY_BRANCH=dev   # or main
bash deploy-prod.sh
```

This runs **`install-prod.sh`** (with **`VITE_API_URL`** from **`.deploy.env`**) and **`run-prod.sh`**.

### Push-to-live (git clone on server) — required once

**`deploy-prod.sh`** runs **`git fetch`** and **`git reset --hard origin/<DEPLOY_BRANCH>`**. If the deploy directory has **no `.git`**, webhook deploys **cannot** pull new code from GitHub until you fix it.

**One-time migration** (adjust paths, branch, and repo URL; keep a backup of **`.deploy.env`**):

```bash
# Example: replace YOUR_ORG, fxfx, and paths
sudo -i -u deploy   # or your deploy user
cd /var/www   # parent of your app folder

cp fxincap-production/.deploy.env /tmp/fxincap.deploy.env.SAVE
mv fxincap-production fxincap-production.bak-before-git-$(date +%Y%m%d)

git clone -b dev --single-branch https://github.com/YOUR_ORG/fxfx.git fxincap-production
# Private repo: use SSH deploy key or PAT:
# git clone -b dev git@github.com:YOUR_ORG/fxfx.git fxincap-production

cp /tmp/fxincap.deploy.env.SAVE fxincap-production/.deploy.env
chmod 600 fxincap-production/.deploy.env

cd fxincap-production
bash deploy-prod.sh    # or: bash install-prod.sh && bash run-prod.sh
```

Then:

- **`DEPLOY_BRANCH`** in **`.deploy.env`** must match the branch you push to (e.g. **`dev`**).
- GitHub **Webhook** must fire on pushes to **that** branch (usually “Just push”).

After this, **push → webhook → `deploy-prod.sh`** updates code from GitHub on every deploy.

**Emergency only** (rebuild without updating from git):  
`DEPLOY_ALLOW_NO_GIT=1 bash deploy-prod.sh`

## 📊 Monitoring deployments

### Webhook / deploy logs

```bash
pm2 logs fxincap-deploy-webhook
```

### Monitor Server (via SSH)

```bash
# Check running processes
pm2 status

# View logs
pm2 logs

# Restart specific service
pm2 restart fxincapapi

# Reload all services (no downtime)
pm2 reload all
```

## ⚠️ Common Issues

### Deployment Fails with "Permission Denied"
- Ensure SSH key is added to server's `~/.ssh/authorized_keys`
- Check file permissions: `chmod 600 ~/.ssh/authorized_keys`

### "pnpm install" fails
- Ensure pnpm is installed on server: `npm install -g pnpm`
- Check Node.js version: `node -v` (should be 18+)

### PM2 restart fails
- Ensure PM2 is installed: `npm install -g pm2`
- Check ecosystem config files exist in each sub-project
- Verify permissions on deployment directory

### Builds fail during `install-prod.sh`
- Run `pnpm install` locally and commit lockfiles
- Set **`VITE_API_URL`** in **`.deploy.env`** on the server
- Check **`pm2 logs`** for the app that failed

### `deploy-prod.sh` exits with "no .git"
- The live directory must be a **git clone** of your GitHub repo (see **Push-to-live** above), or set **`DEPLOY_ALLOW_NO_GIT=1`** only for a rebuild-without-pull.

## 🔐 Security Best Practices

1. **Never commit** **`.deploy.env`**, API keys, or webhook secrets
2. **Rotate `DEPLOY_WEBHOOK_SECRET`** if it leaks (update GitHub webhook + **`.deploy.env`**)
3. **Restrict** webhook URL (firewall / nginx TLS) and use HTTPS in production
4. **Monitor** `pm2 logs fxincap-deploy-webhook` after each push

## 📝 Deployment (webhook already at fxincap.com)

1. On the server: ensure **`.deploy.env`** exists and **`DEPLOY_WEBHOOK_SECRET`** matches GitHub (**`https://fxincap.com/hooks/deploy`**), plus **`DEPLOY_BRANCH`** and **`VITE_API_URL`**
2. **`bash run-prod.sh`** if PM2 / webhook is not running
3. Push to **`DEPLOY_BRANCH`** — GitHub calls the **existing** webhook; no new webhook needed
4. **`pm2 logs fxincap-deploy-webhook`** to confirm **`deploy-prod.sh`** ran

## Final checklist (server — only if something was missing)

Replace the path with your real deploy directory.

```bash
cd /var/www/fxfx   # or your path
git pull
bash setup-server-deploy-env.sh   # creates .deploy.env only if absent
nano .deploy.env   # DEPLOY_WEBHOOK_SECRET must match GitHub secret for https://fxincap.com/hooks/deploy
bash run-prod.sh
```

Do **not** create another GitHub webhook; keep using **`https://fxincap.com/hooks/deploy`**.

## 🆘 Need Help?

- **Webhook**: GitHub → Settings → Webhooks → Recent Deliveries
- **Server**: `pm2 logs` and logs under **`logs/`**
- **401 invalid_signature**: **`DEPLOY_WEBHOOK_SECRET`** must match GitHub webhook secret

# FX Incap Monorepo - CI/CD & Deployment Guide

This is a monorepo containing all FX Incap applications with automated CI/CD pipelines for staging and production deployments.

## 📁 Repository Structure

```
fxfx/
├── fxincap/           # Main landing page (Next.js)
├── fxincapadmin/      # Admin dashboard (Vite React)
├── fxincapapi/        # API backend (Node.js)
├── fxincaptrade/      # Trading platform (Vite + Node.js)
├── fxincapws/         # WebSocket server (Node.js)
├── .github/
│   └── workflows/
│       ├── ci-staging.yml      # Dev branch → Staging deployment
│       └── ci-production.yml    # Main branch → Production deployment
└── .gitignore
```

## 🚀 Deployment Strategy

### Branch Structure
- **`dev`** branch → Automatically deploys to **staging** environment
- **`main`** branch → Automatically deploys to **production** environment

### CI/CD Pipeline Flow

1. **Code Push** → Developer pushes to `dev` or `main` branch
2. **GitHub Actions Triggered** → Runs automated tests and builds
3. **Build** → Compiles all sub-projects
4. **Deploy** → Automatically deploys to appropriate server

## ⚙️ GitHub Secrets Configuration

Before deployments work, you must configure GitHub Secrets in your repository settings.

### Staging Secrets (push to `dev` branch)
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

### Step 3: Add Private Key to GitHub Secrets

1. Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `DEPLOY_KEY_STAGING` (or `DEPLOY_KEY_PROD`)
4. Value: Paste the **entire contents** of your private key file (`fxincap-deploy`)
5. Click **Add secret**

### Step 4: Add Server Details to GitHub Secrets

Repeat for:
- `DEPLOY_HOST_STAGING` → `your-staging-server.com`
- `DEPLOY_USER_STAGING` → `deploy`
- `DEPLOY_PATH_STAGING` → `/var/www/fxincap`

(Same for PROD variants)

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

### Manual Deployment (Advanced)

If you need to manually deploy:

```bash
# Clone the repo (first time)
git clone git@github.com:YOUR_USERNAME/fxfx.git
cd fxfx

# For staging (dev branch)
git fetch origin dev
git checkout dev
git reset --hard origin/dev

# For production (main branch)
git fetch origin main
git checkout main
git reset --hard origin/main

# Install dependencies
pnpm install

# Build all projects
pnpm build

# Start services with PM2
pm2 start ecosystem.config.js
# or restart existing
pm2 restart all
```

## 📊 Monitoring Deployments

### Check GitHub Actions Status
1. Push code to `dev` or `main`
2. Go to **Actions** tab in GitHub
3. Click on the workflow run to see logs

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

### Builds fail on GitHub Actions
- Check if `pnpm-lock.yaml` is missing (run `pnpm install` locally)
- Ensure all environment variables are set

## 🔐 Security Best Practices

1. **Never commit private keys** to the repository
2. **Use separate keys** for staging and production
3. **Rotate keys periodically** (monthly recommended)
4. **Restrict SSH** - Disable password auth, use key-only
5. **Monitor deployments** - Review GitHub Actions logs
6. **Backup before deploy** - Workflows automatically create backups

## 📝 Making Your First Deployment

1. Create a `dev` branch:
   ```bash
   git checkout -b dev
   git push -u origin dev
   ```

2. Configure GitHub Secrets (see section above)

3. Make a test commit:
   ```bash
   echo "# Deployment Test" >> README.md
   git add README.md
   git commit -m "Test staging deployment"
   git push origin dev
   ```

4. Watch GitHub Actions complete the deployment

5. When ready for production, create a PR from `dev` → `main`, merge, and auto-deploy

## 🆘 Need Help?

- **GitHub Actions Logs**: Actions tab → workflow run → logs
- **Server Logs**: `pm2 logs` or `/var/log/` on server
- **SSH Issues**: Check `~/.ssh/authorized_keys` permissions on server

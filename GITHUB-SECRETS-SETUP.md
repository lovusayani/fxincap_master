# GitHub Secrets Setup Checklist

Complete this checklist to enable automated CI/CD deployments.

## 📝 Prerequisites Checklist

- [ ] GitHub repository is private and SSH-based
- [ ] Linux servers are ready (staging and production)
- [ ] SSH access to servers is working
- [ ] `deploy` user created on servers
- [ ] SSH keys generated locally

## 🔑 SSH Key Generation

Run this on your **local machine** to generate deployment keys:

```bash
# Generate staging key
ssh-keygen -t ed25519 -f ~/.ssh/fxincap-staging -C "fxincap-staging"

# Generate production key  
ssh-keygen -t ed25519 -f ~/.ssh/fxincap-production -C "fxincap-production"
```

Then add the **public keys** to your servers (`.pub` files).

## 🔐 GitHub Secrets Configuration

Go to: **GitHub** → **Repository** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Staging Secrets (for `dev` branch)

| Secret Name | Value | Example |
|---|---|---|
| `DEPLOY_KEY_STAGING` | Content of `~/.ssh/fxincap-staging` (private key) | `-----BEGIN PRIVATE KEY-----...` |
| `DEPLOY_HOST_STAGING` | Staging server hostname or IP | `staging.example.com` |
| `DEPLOY_USER_STAGING` | SSH user on staging server | `deploy` |
| `DEPLOY_PATH_STAGING` | Full path to deployment directory | `/var/www/fxincap` |

### Production Secrets (for `main` branch)

| Secret Name | Value | Example |
|---|---|---|
| `DEPLOY_KEY_PROD` | Content of `~/.ssh/fxincap-production` (private key) | `-----BEGIN PRIVATE KEY-----...` |
| `DEPLOY_HOST_PROD` | Production server hostname or IP | `prod.example.com` |
| `DEPLOY_USER_PROD` | SSH user on production server | `deploy` |
| `DEPLOY_PATH_PROD` | Full path to deployment directory | `/var/www/fxincap` |

## ✅ Server Setup Verification

SSH into each server and verify:

```bash
# Node.js installed?
node -v  # Should be 18.x or higher

# pnpm installed globally?
pnpm -v  # Should show version

# PM2 installed?
pm2 --version

# Deploy user exists?
id deploy  # Should show deploy user info

# Deployment directory exists and is writable by deploy?
ls -ld /var/www/fxincap  # Should show deploy:deploy ownership

# Git is available?
git --version

# PostgreSQL running (if needed)?
psql --version
```

##Test Checklist

Once secrets are configured:

- [ ] Push a test commit to `dev` branch
- [ ] Verify GitHub Actions workflow runs
- [ ] Check staging server for deployed code
- [ ] Verify all apps are running: `pm2 status`
- [ ] Test staging apps in browser
- [ ] Merge to `main` and test production deployment

## 🚨 Troubleshooting

### ❌ "Permission denied (publickey)"
**Solution:** 
- Verify public key is in `/home/deploy/.ssh/authorized_keys` on server
- Check permissions: `chmod 600 ~/.ssh/authorized_keys`
- Verify deploy user owns the directory: `chown deploy:deploy ~/.ssh/`

### ❌ "pnpm: command not found"
**Solution:** Install pnpm on server:
```bash
sudo npm install -g pnpm
```

### ❌ "PM2 restart fails"
**Solution:** Check if ecosystem.config.js exists in each project:
```bash
ls -la /var/www/fxincap/*/ecosystem.config.*
```

### ❌ Artifacts not found
**Solution:** Check if builds succeeded in GitHub Actions logs

## 📞 Support

For issues:
1. Check GitHub Actions logs for detailed error messages
2. SSH into server and check `/var/www/fxincap` exists
3. Run `pm2 logs` to see application errors
4. Check SSH connectivity: `ssh -i ~/.ssh/fxincap-staging deploy@staging.example.com`

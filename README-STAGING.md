FXFX staging deploy from the dev branch

Contents
- `install-staging.sh`: installs dependencies, creates runtime directories, and builds the apps
- `run-staging.sh`: starts or reloads the staging apps with PM2
- `ecosystem.staging.portable.cjs`: portable PM2 config that runs from the cloned repo path

Server requirements
- Node.js 20+
- pnpm 10.14.0
- PM2 installed globally

Recommended path
1. Clone the `dev` branch into your staging path.
2. Copy the staging `.env` files into each app where needed.
3. From the repo root, run `bash install-staging.sh`.
4. Then run `bash run-staging.sh`.

Example
```bash
git clone --branch dev https://github.com/soniadcam2025/fxtrade.git /var/www/fxincap-staging
cd /var/www/fxincap-staging
bash install-staging.sh
bash run-staging.sh
```

Notes
- This keeps staging deploy support in the repo without committing built artifacts.
- Runtime upload directories are created automatically if missing.
- This uses `ecosystem.staging.portable.cjs` so the clone can live in any server path.
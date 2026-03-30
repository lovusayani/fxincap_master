# FXIncap CI/CD Workflows (Staging + Production)

This document contains the final cleaned GitHub Actions workflows for:
- `dev` -> Staging (`/var/www/fxincap-staging`)
- `main` -> Production (`/var/www/fxincap`)

## Required GitHub Secrets

### Staging
- `DEPLOY_KEY_STAGING`
- `DEPLOY_HOST_STAGING`
- `DEPLOY_USER_STAGING`
- `DEPLOY_PATH_STAGING`

### Production
- `DEPLOY_KEY_PROD`
- `DEPLOY_HOST_PROD`
- `DEPLOY_USER_PROD`
- `DEPLOY_PATH_PROD`

## File 1: .github/workflows/staging.yml

```yaml
name: CI/CD Staging (Dev Branch)

on:
  push:
    branches:
      - dev
  pull_request:
    branches:
      - dev

concurrency:
  group: deploy-staging-dev
  cancel-in-progress: true

env:
  DEPLOY_ENV: staging
  NODE_ENV: staging

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies (all projects)
        shell: bash
        run: |
          set -euo pipefail
          for dir in fxincap fxincapadmin fxincapapi fxincaptrade fxincapws; do
            if [ -d "$dir" ]; then
              echo "Installing $dir"
              (cd "$dir" && pnpm install --frozen-lockfile)
            else
              echo "Missing directory: $dir"
              exit 1
            fi
          done

      - name: Lint (non-blocking on staging)
        continue-on-error: true
        shell: bash
        run: |
          set -euo pipefail
          for dir in fxincap fxincaptrade; do
            if [ -f "$dir/package.json" ]; then
              if node -e "const p=require('./$dir/package.json'); process.exit(p.scripts&&p.scripts.lint?0:1)"; then
                echo "Linting $dir"
                (cd "$dir" && pnpm lint)
              else
                echo "No lint script in $dir, skipping"
              fi
            fi
          done

      - name: Build projects
        shell: bash
        run: |
          set -euo pipefail
          for dir in fxincap fxincapadmin fxincapapi fxincaptrade; do
            if node -e "const p=require('./$dir/package.json'); process.exit(p.scripts&&p.scripts.build?0:1)"; then
              echo "Building $dir"
              (cd "$dir" && pnpm build)
            else
              echo "No build script in $dir"
              exit 1
            fi
          done
          echo "fxincapws: no build step expected"

  deploy-staging:
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/dev'
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Prepare SSH
        shell: bash
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY_STAGING }}
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST_STAGING }}
        run: |
          set -euo pipefail
          install -d -m 700 ~/.ssh
          printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts

      - name: Sync code to staging
        shell: bash
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST_STAGING }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER_STAGING }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH_STAGING }}
        run: |
          set -euo pipefail
          rsync -az --delete \
            --exclude='.git' \
            --exclude='**/node_modules' \
            --exclude='**/.env' \
            --exclude='**/.env.local' \
            --exclude='**/uploads' \
            -e "ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes" \
            ./ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

      - name: Install, build, and reload PM2 (staging)
        shell: bash
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST_STAGING }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER_STAGING }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH_STAGING }}
        run: |
          set -euo pipefail
          ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes "$DEPLOY_USER@$DEPLOY_HOST" \
            "DEPLOY_PATH='$DEPLOY_PATH' bash -se" <<'EOF'
          set -euo pipefail
          cd "$DEPLOY_PATH"

          for dir in fxincap fxincapadmin fxincapapi fxincaptrade fxincapws; do
            echo "Installing $dir"
            (cd "$dir" && pnpm install --frozen-lockfile)
          done

          for dir in fxincap fxincapadmin fxincapapi fxincaptrade; do
            if node -e "const p=require('./$dir/package.json'); process.exit(p.scripts&&p.scripts.build?0:1)"; then
              echo "Building $dir"
              (cd "$dir" && pnpm build)
            fi
          done

          if [ -f ecosystem.staging.config.cjs ]; then
            pm2 startOrReload ecosystem.staging.config.cjs --env staging
          elif [ -f ecosystem.staging.config.js ]; then
            pm2 startOrReload ecosystem.staging.config.js --env staging
          else
            echo "Missing ecosystem.staging.config.cjs/js in $DEPLOY_PATH"
            exit 1
          fi

          pm2 save
          pm2 status
          EOF

      - name: Staging deployment summary
        run: echo "Staging deployment successful"
```

## File 2: .github/workflows/production.yml

```yaml
name: CI/CD Production (Main Branch)

on:
  push:
    branches:
      - main

concurrency:
  group: deploy-production-main
  cancel-in-progress: true

env:
  DEPLOY_ENV: production
  NODE_ENV: production

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies (all projects)
        shell: bash
        run: |
          set -euo pipefail
          for dir in fxincap fxincapadmin fxincapapi fxincaptrade fxincapws; do
            if [ -d "$dir" ]; then
              echo "Installing $dir"
              (cd "$dir" && pnpm install --frozen-lockfile)
            else
              echo "Missing directory: $dir"
              exit 1
            fi
          done

      - name: Lint (strict)
        shell: bash
        run: |
          set -euo pipefail
          for dir in fxincap fxincaptrade; do
            if node -e "const p=require('./$dir/package.json'); process.exit(p.scripts&&p.scripts.lint?0:1)"; then
              echo "Linting $dir"
              (cd "$dir" && pnpm lint)
            else
              echo "No lint script in $dir"
              exit 1
            fi
          done

      - name: Build projects (strict)
        shell: bash
        run: |
          set -euo pipefail
          for dir in fxincap fxincapadmin fxincapapi fxincaptrade; do
            if node -e "const p=require('./$dir/package.json'); process.exit(p.scripts&&p.scripts.build?0:1)"; then
              echo "Building $dir"
              (cd "$dir" && pnpm build)
            else
              echo "No build script in $dir"
              exit 1
            fi
          done
          echo "fxincapws: no build step expected"

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Prepare SSH
        shell: bash
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY_PROD }}
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST_PROD }}
        run: |
          set -euo pipefail
          install -d -m 700 ~/.ssh
          printf '%s\n' "$DEPLOY_KEY" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts

      - name: Sync code to production
        shell: bash
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST_PROD }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER_PROD }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH_PROD }}
        run: |
          set -euo pipefail
          rsync -az --delete \
            --exclude='.git' \
            --exclude='**/node_modules' \
            --exclude='**/.env' \
            --exclude='**/.env.local' \
            --exclude='**/uploads' \
            -e "ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes" \
            ./ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

      - name: Install, build, and reload PM2 (production)
        shell: bash
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST_PROD }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER_PROD }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH_PROD }}
        run: |
          set -euo pipefail
          ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes "$DEPLOY_USER@$DEPLOY_HOST" \
            "DEPLOY_PATH='$DEPLOY_PATH' bash -se" <<'EOF'
          set -euo pipefail
          cd "$DEPLOY_PATH"

          for dir in fxincap fxincapadmin fxincapapi fxincaptrade fxincapws; do
            echo "Installing $dir"
            (cd "$dir" && pnpm install --frozen-lockfile)
          done

          for dir in fxincap fxincapadmin fxincapapi fxincaptrade; do
            if node -e "const p=require('./$dir/package.json'); process.exit(p.scripts&&p.scripts.build?0:1)"; then
              echo "Building $dir"
              (cd "$dir" && pnpm build)
            fi
          done

          if [ -f ecosystem.production.config.cjs ]; then
            pm2 startOrReload ecosystem.production.config.cjs --env production
          elif [ -f ecosystem.production.config.js ]; then
            pm2 startOrReload ecosystem.production.config.js --env production
          elif [ -f ecosystem.config.cjs ]; then
            pm2 startOrReload ecosystem.config.cjs --env production
          elif [ -f ecosystem.config.js ]; then
            pm2 startOrReload ecosystem.config.js --env production
          else
            echo "Missing production ecosystem file in $DEPLOY_PATH"
            exit 1
          fi

          pm2 save
          pm2 status
          EOF

      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ github.run_number }}
          name: Production Release v${{ github.run_number }}
          body: |
            Production deployment from commit ${{ github.sha }}

            Apps:
            - fxincap
            - fxincapadmin
            - fxincapapi
            - fxincaptrade
            - fxincapws
          draft: false
          prerelease: false

      - name: Production deployment summary
        run: echo "Production deployment successful"
```

## Notes

- Do not use `pm2 restart all` because it also restarts unrelated apps running on the same server.
- Keep separate PM2 ecosystem files for staging and production.
- First deployment should verify all required paths and scripts exist in the monorepo.

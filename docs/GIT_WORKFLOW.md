# Two-PC Git Workflow

This repository uses two branches:

- `dev` — shared development and test branch.
- `main` — stable production branch. A merge into `main` triggers the live-server webhook.

## On either PC

Start every work session from the latest shared code:

```bash
git status
git switch dev
git pull --ff-only origin dev
```

Develop and test locally. Before leaving the PC:

```bash
git add -p
git commit -m "type(scope): describe the change"
git pull --rebase origin dev
git push origin dev
```

If the rebase reports conflicts, resolve and test again before pushing. Do not force-push `dev`.

## Automatic promotion

Every push to `dev` starts `.github/workflows/promote-dev-to-main.yml`. It runs the service tests,
type checks, and application builds. When they pass, it opens or updates a `dev` → `main` pull
request and enables automatic merge. The merge preserves the commit history.

The existing production webhook watches `main`, so a successful automatic merge deploys the merged
commit to the live server. `dev` itself must never be configured as the production deploy branch.

## Version control

All commits remain in Git history. Use clear Conventional Commit messages (`feat`, `fix`, `docs`,
`refactor`, `test`, `chore`, or `build`). For a release point, tag the production commit:

```bash
git switch main
git pull --ff-only origin main
git tag -a v2026.08.13 -m "production release 2026.08.13"
git push origin v2026.08.13
```

## Important rules

- Never develop directly on `main`.
- Before pushing from either PC, pull the latest `dev` first.
- Never commit `.env` files, passwords, tokens, or private keys.
- A merge into `main` is a production deployment; test carefully before pushing `dev`.

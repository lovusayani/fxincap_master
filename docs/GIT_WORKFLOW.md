# Git Workflow — Two-PC Development

Two development machines share this repository. **GitHub is the only synchronization channel.** The
PCs never talk to each other directly, and neither PC's local state is authoritative.

```
   PC #1  ──push──►  ┌──────────┐  ◄──push──  PC #2
   (dev)   ◄─pull──  │  GitHub  │  ──pull──►  (dev)
                     │  origin  │
                     └────┬─────┘
                          │  feature branch → Pull Request → main
                          ▼
                     ┌──────────┐
                     │   main   │  ← the deployment branch
                     └────┬─────┘
                          │  push webhook
                          ▼
                   DigitalOcean production
```

## 1. Branch model

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Integration **and deployment**. A push here reaches production. | Never commit directly. Merge only via PR. |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | All work | One branch per task, per PC |
| `origin/dev` | ⚠ **Do not use** | Root commit + 3 empty commits; contains none of the deploy chain. See §8 |
| `origin/dev-clean`, `origin/live-server-updates` | Stale, fully merged | Candidates for deletion |

**`main` deploys.** There is no separate release step: merging a PR into `main` is a production
deployment. Treat every merge as a release.

## 2. Starting work — do this every session, on both PCs

```bash
git status                      # must be clean before anything else
git branch --show-current
git fetch origin
git status                      # ahead / behind / diverged?
```

Then branch from an up-to-date `main`:

```bash
git switch main
git pull --ff-only origin main  # --ff-only refuses to create a surprise merge
git switch -c feat/short-description
```

`--ff-only` is deliberate: if it fails, your local `main` has drifted and you need to look at why
before continuing, rather than silently merging.

## 3. During work

```bash
git add -p                      # stage deliberately, not with `git add .`
git commit                      # uses .gitmessage.txt if configured (see §6)
git push -u origin feat/short-description
```

Push your feature branch **often**. An unpushed branch is invisible to the other PC and is lost if
the machine dies. Pushing a feature branch is always safe — it cannot affect `main` or production.

## 4. Finishing work

1. Rebase onto current `main` so the PR is a clean fast-forward:

   ```bash
   git fetch origin
   git rebase origin/main          # resolve conflicts here, on your branch
   git push --force-with-lease     # ONLY ever on your own feature branch
   ```

   `--force-with-lease` refuses to overwrite commits you have not seen. **Never** use plain
   `--force`, and **never** force-push `main`.

   If rebasing makes you uncomfortable, `git merge origin/main` into your branch instead. A merge
   commit in a feature branch is harmless.

2. Open a Pull Request into `main` on GitHub.
3. Merge the PR. **This deploys to production** — see [DEPLOYMENT.md](./DEPLOYMENT.md).
4. Clean up:

   ```bash
   git switch main && git pull --ff-only origin main
   git branch -d feat/short-description
   git push origin --delete feat/short-description
   ```

## 5. Switching PCs

Before leaving a machine:

```bash
git status                      # nothing uncommitted
git push origin HEAD            # everything is on GitHub
```

On arriving at the other machine:

```bash
git fetch origin
git switch main && git pull --ff-only origin main
git switch feat/whatever || git switch -c feat/whatever origin/feat/whatever
git pull --ff-only origin feat/whatever
```

**Rule: never leave uncommitted work on a PC you are walking away from.** If it is not pushed, the
other PC cannot see it and you will eventually duplicate or lose it.

For genuinely unfinishable work, commit it on the feature branch as `wip: <what remains>` and push.
A WIP commit on a feature branch costs nothing and can be amended or squashed later.

## 6. Commit messages

The repository ships a Conventional Commits template. Enable it **once per PC**:

```bash
git config commit.template .gitmessage.txt
```

```
<type>(<scope>): <short summary>

Why:
- …

What changed:
- …

Validation:
- …
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `build`, `ci`.

**Do not use [`deploy-remote.ps1`](../deploy-remote.ps1).** It runs `git add .` and commits with an
auto-generated `fc<timestamp>` message. It is the direct cause of 11 of the 15 uninformative commit
messages in this repository ([GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md) §3) and it pushes
straight to `main`, bypassing review and triggering a production deploy.

## 7. Avoiding collisions between the two PCs

| Situation | Rule |
| --- | --- |
| Two features at once | One feature branch each. Never share a branch name between PCs. |
| Same file, both PCs | Coordinate before starting. Git will merge, but a trading-engine conflict is not something to discover in a PR. |
| Same branch on both PCs | Avoid. If unavoidable, the second PC must `git pull --rebase` before every push, and only one PC may force-push. |
| Long-running branch | Rebase onto `origin/main` at least daily, or the eventual merge becomes the risky part. |
| Lockfiles (`pnpm-lock.yaml`) | Conflicts here are common and must **never** be hand-merged. Take one side, re-run `pnpm install`, and commit the regenerated file. A malformed lockfile fails the production deploy (`--frozen-lockfile`). |

## 8. ⚠ `origin/dev` is a trap

`origin/dev` branched at the **root commit** and only ever received three empty webhook-test commits.
It contains **none** of the deploy chain — no `deploy-prod.sh`, no `install-prod.sh`, no
`run-prod.sh`, no `deploy/`.

Because `deploy-prod.sh` runs `git reset --hard origin/$DEPLOY_BRANCH`, deploying from `dev` would
delete the deployment scripts from the production server and break deploys permanently.

`DEPLOY_BRANCH` defaults to `dev` throughout the codebase, so the live `.deploy.env` must already
override it to `main`. Verify this before touching deployment:

```bash
grep DEPLOY_BRANCH /path/to/repo/.deploy.env    # on the server
```

Do not push to `dev`, do not merge into it, and do not set `DEPLOY_BRANCH=dev`. Ideally delete it or
fast-forward it to `main` — with approval, since branch deletion is out of scope here.

## 9. Commands never to run on this repository

| Command | Why |
| --- | --- |
| `git push --force` (on a shared branch) | Destroys the other PC's and GitHub's history |
| `git push origin main` (direct) | Bypasses review and deploys straight to production |
| `git reset --hard` (with uncommitted work) | Silently discards work with no recovery path |
| `git clean -fd` | Deletes untracked files including `.env` files, which are gitignored |
| `git rebase` on `main` | Rewrites shared history |
| `git branch -D` on a remote-tracked branch | May discard unmerged work from the other PC |
| `filter-repo` / BFG without a plan | Rewrites every hash; the production deploy directory must then be **re-cloned**, since `git reset --hard` cannot recover from rewritten history |

The last row matters: purging the KYC documents from history ([SECURITY.md](./SECURITY.md) §7) is a
history rewrite and requires a coordinated re-clone on **both PCs and the production server**.

## 10. Recovering from a mistake

**Committed to `main` locally (not pushed)** — the exact situation this audit found and fixed:

```bash
git branch docs/my-work          # preserve the commit on a feature branch
git switch docs/my-work
git branch -f main origin/main   # move main back; nothing is lost
```

**Pushed to `main` by accident:** do **not** force-push. Revert forward instead:

```bash
git revert <sha>
```

Then check whether the bad commit already deployed (`pm2 logs fxincap-deploy-webhook`).

**Lost a commit:** `git reflog` retains it for ~90 days. `git reflog` → `git switch -c rescue <sha>`.

**Diverged `main`:** stop. Do not reconcile by force. Report the situation, inspect with
`git log --oneline --graph --all`, and resolve deliberately.

## 11. Pre-push checklist

Before opening a PR that will merge to `main` and therefore deploy:

```bash
cd fxincapapi   && ./node_modules/.bin/tsc --noEmit
cd fxincaptrade && ./node_modules/.bin/tsc --noEmit
cd fxincapws    && node --check src/server.js src/config.js src/db.js src/providers/*.js
# build every service you touched
git diff origin/main --stat        # review what you are actually shipping
```

There is no CI and there are no tests ([TESTING.md](./TESTING.md)) — this checklist is the only gate
between a feature branch and production.

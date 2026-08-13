# Security Incident — Customer Identity Documents in Git History

**Status:** OPEN — contained in the working tree, **not** remediated in history
**Severity:** Critical (personal data exposure)
**Identified:** 2026-08-10, during the repository audit
**History rewrite:** NOT performed — deliberately deferred pending approval

> This document contains no customer data: no names, no document images, no
> account identifiers, no file listings. It describes the exposure and the
> remediation plan only.

---

## 1. What happened

The repository's **root commit** `1d95474` ("Remove committed secrets for deploy",
2026-03-31) added the contents of the runtime upload directory to version
control. A later commit, `52fc638` (2026-04-02), deleted those files from the
working tree.

Deleting a file in a later commit does not remove it from history. The blobs
remain reachable in the object database of every clone, fork and mirror of this
repository.

## 2. Scope

Counts obtained from `git log --diff-filter=A --name-only`. No file contents were
opened during the audit.

| Path | Files | Data category |
| --- | --- | --- |
| `fxincapapi/uploads/kyc-documents/` | **210** | Customer identity documents submitted for KYC |
| `fxincapapi/uploads/deposit-screenshots/` | **158** | Payment / bank transfer screenshots attached to deposit requests |
| `fxincapapi/uploads/profile-pictures/` | 5 | Customer profile photographs |
| `fxincapapi/uploads/logos/`, `uploads/mails/` | 9 | Platform assets — not personal data |
| **Total added in `1d95474`** | **382** | |

**Attributability.** Upload filenames embed the owning user's UUID
(`kyc-<user-uuid>-<timestamp>-<random>.<ext>`), so each document maps to a
specific customer account. The exposure is not anonymous.

**Exposure window.** From 2026-03-31 (root commit) to the present, for anyone
with read access to the repository. `52fc638` removed the files from the working
tree only; it did not reduce historical availability.

## 3. Verification of the current working tree

Re-verified on the `fix/security-and-pnl` branch:

```
$ git ls-files | grep -i uploads
fxincapapi/uploads/.gitkeep
fxincaptrade/uploads/.gitkeep
```

Only the two directory placeholders are tracked. **No customer document is
present in the current working tree or in the current commit.**

`.gitignore` prevents recurrence:

```
uploads/**
!uploads/.gitkeep
fxincapapi/uploads/**
!fxincapapi/uploads/.gitkeep
fxincaptrade/uploads/**
!fxincaptrade/uploads/.gitkeep
```

Confirmed effective: `git ls-files | git check-ignore --stdin` returns nothing,
so no currently tracked file is newly ignored, and any new upload is excluded.

## 4. Why this is not yet remediated

Removing the blobs requires rewriting every commit from the root, which:

- changes every commit hash on every branch;
- requires a force-push, explicitly out of scope for the current work;
- **breaks the production deploy directory** — `deploy-prod.sh` runs
  `git reset --hard origin/$DEPLOY_BRANCH`, which cannot reconcile a rewritten
  history. The server must be **re-cloned**, not pulled;
- requires PC #1 and PC #2 to discard and re-clone their local copies;
- must be coordinated so no one pushes during the rewrite.

This is an operations exercise with a production outage window, not a code
change. It needs explicit approval and a scheduled slot.

## 5. Remediation plan

### Phase 1 — Containment and assessment (do first, no code required)

1. **Determine repository visibility.** Check whether
   `github.com/lovusayani/fxincap_master` is, or has ever been, **public**.
   - GitHub → repository → Settings → General → Danger Zone shows current
     visibility. Audit-log history shows past visibility changes.
   - If it was ever public, treat the audience as unbounded: search engine
     caches, archive sites and automated scrapers must be assumed to have copies.
2. **If public, make it private immediately.** This does not undo prior exposure
   but stops further access.
3. **Enumerate who had access:** collaborators, teams, deploy keys, installed
   GitHub Apps, and — critically — **forks**. A fork retains the objects even
   after the upstream is rewritten.
4. **Escalate for a data-protection assessment.** Identity documents and payment
   screenshots fall squarely within the categories that trigger breach
   notification duties (GDPR Art. 33/34 and equivalents elsewhere). Whether
   notification of the supervisory authority and of affected customers is
   required is a legal determination — it is not an engineering call. Provide
   whoever makes it with: the categories above, the counts, the exposure window,
   and the visibility finding from step 1.
5. **Record the assessment outcome** in this document before closing it.

### Phase 2 — History rewrite (requires approval and a scheduled window)

Announce a freeze; no pushes from either PC during the window.

```bash
# 1. Back up. Do this first, and verify the archive before continuing.
git clone --mirror https://github.com/lovusayani/fxincap_master.git fxincap-backup.git
tar czf fxincap-backup-$(date +%Y%m%d).tar.gz fxincap-backup.git
#    Store the archive somewhere access-controlled — it still contains the data.

# 2. Rewrite a fresh mirror.
pip install git-filter-repo
git clone --mirror https://github.com/lovusayani/fxincap_master.git fxincap-rewrite.git
cd fxincap-rewrite.git
git filter-repo --path fxincapapi/uploads --invert-paths --force

# 3. Verify the blobs are gone before publishing.
git rev-list --objects --all | grep -i "kyc-documents\|deposit-screenshots"   # must be empty

# 4. Publish (this is the irreversible step).
git push --force --mirror origin
```

### Phase 3 — Post-rewrite

1. **Delete every fork**, or ask each owner to delete it. A fork keeps the
   original objects; the rewrite does not reach it.
2. **Open a GitHub Support ticket** asking them to garbage-collect unreachable
   objects and purge cached views. A force-push alone leaves objects retrievable
   by SHA on GitHub's servers for some time.
3. **Re-clone the production deploy directory.** Do not attempt `git pull` —
   it cannot reconcile a rewritten history:

   ```bash
   cd /var/www
   cp <deploy-dir>/.deploy.env /tmp/deploy.env.SAVE      # gitignored, must be preserved
   mv <deploy-dir> <deploy-dir>.pre-rewrite
   git clone -b main https://github.com/lovusayani/fxincap_master.git <deploy-dir>
   cp /tmp/deploy.env.SAVE <deploy-dir>/.deploy.env && chmod 600 <deploy-dir>/.deploy.env
   # restore per-service .env files from the .pre-rewrite copy, then:
   cd <deploy-dir> && bash install-prod.sh && bash run-prod.sh
   ```

   Also restore `fxincapapi/uploads/` and `fxincaptrade/uploads/` from the old
   directory — those are live customer data and are not in git.
4. **Re-clone on PC #1 and PC #2.** Any un-pushed work must be exported as a
   patch (`git format-patch`) beforehand and re-applied after.
5. **Verify production** — see the validation checklist in
   [DEPLOYMENT.md](./DEPLOYMENT.md) §10.
6. Delete the `.pre-rewrite` directory and the local backup archive once
   everything is confirmed, per your retention policy.

### Phase 4 — Prevention

| Control | Status |
| --- | --- |
| `.gitignore` excludes `uploads/**` | ✅ in place and verified |
| Uploads stored outside the repository working tree | ⬜ recommended — see below |
| GitHub secret scanning + push protection enabled | ⬜ recommended |
| Pre-commit hook rejecting `uploads/` paths | ⬜ optional belt-and-braces |
| Branch protection on `main` (PR required) | ⬜ recommended, see [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) |

**Storing uploads outside the repository** is the durable fix. Today
`fxincapapi/uploads/` sits inside the deploy directory, so it is one
`.gitignore` mistake away from recurrence — and `deploy-prod.sh` runs
`git reset --hard`, which makes the working tree a hostile place for live
customer data. Move it to a path outside the clone (e.g. `/var/lib/fxincap/uploads`)
and point the service at it. That is a deployment change and is out of scope for
the current security work.

## 6. What was done in this task

| Action | Status |
| --- | --- |
| Confirmed the working tree is clean of customer documents | ✅ done |
| Confirmed `.gitignore` prevents recurrence | ✅ done |
| Documented scope, attributability and exposure window | ✅ done |
| Produced this remediation plan | ✅ done |
| Rewrote git history | ❌ **not done** — deferred, requires approval |
| Force-pushed | ❌ **not done** |
| Reproduced or transmitted any customer data | ❌ **not done** |

## 7. Related

- [SECURITY.md](./SECURITY.md) §7 — the finding in the context of the full audit
- [GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md) §4 — commit-level detail
- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) §9 — why a rewrite forces a re-clone
- [DEPLOYMENT.md](./DEPLOYMENT.md) §9 — the deploy directory's git requirements

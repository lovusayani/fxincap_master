param(
  [string]$RepoPath = "F:/app/fxfx",
  [string]$Branch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoPath)) {
  throw "RepoPath not found: $RepoPath"
}

Set-Location $RepoPath

try {
  git rev-parse --is-inside-work-tree | Out-Null
} catch {
  throw "Not a git repository: $RepoPath"
}

# Sync latest first; if rebase fails due to conflicts, stop and keep local work untouched.
try {
  git pull --rebase origin $Branch | Out-Null
} catch {
  Write-Warning "git pull --rebase failed. Resolve conflicts manually, then re-run."
  exit 1
}

# Use smart commit generator; no-op if nothing changed.
& "$PSScriptRoot/smart-commit.ps1" -RepoPath $RepoPath -Branch $Branch

# Push only if HEAD is ahead.
$ahead = git rev-list --count "origin/$Branch..HEAD"
if ([int]$ahead -gt 0) {
  git push origin $Branch
  Write-Host "Auto-sync push completed."
} else {
  Write-Host "Auto-sync: nothing to push."
}

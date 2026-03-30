param(
  [Parameter(Mandatory = $true)]
  [string]$RemoteUrl,
  [string]$RepoPath = "F:/app/fxfx",
  [string]$Branch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $RepoPath

$isGit = $false
try {
  git rev-parse --is-inside-work-tree | Out-Null
  $isGit = $true
} catch {
  $isGit = $false
}

if (-not $isGit) {
  git init
}

git branch -M $Branch
git add -A

# Create an initial commit only if needed.
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  & "$PSScriptRoot/smart-commit.ps1" -RepoPath $RepoPath -Branch $Branch
}

$hasOrigin = $false
try {
  $existing = git remote get-url origin
  if ($existing) { $hasOrigin = $true }
} catch {
  $hasOrigin = $false
}

if ($hasOrigin) {
  git remote set-url origin $RemoteUrl
} else {
  git remote add origin $RemoteUrl
}

git push -u origin $Branch
Write-Host "Published to GitHub: $RemoteUrl"

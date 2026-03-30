param(
  [string]$RepoPath = "F:/app/fxfx",
  [string]$DefaultBranch = "main"
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

git branch -M $DefaultBranch
git config commit.template .gitmessage.txt

Write-Host "Git workflow configured at $RepoPath"
Write-Host "- Default branch: $DefaultBranch"
Write-Host "- Commit template: .gitmessage.txt"

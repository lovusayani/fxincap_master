param(
  [string]$RepoPath = "F:/app/fxfx",
  [switch]$Push,
  [string]$Branch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $RepoPath)) {
  throw "RepoPath not found: $RepoPath"
}

Set-Location $RepoPath

function Get-ChangedFiles {
  $files = git diff --cached --name-only
  if (-not $files) {
    git add -A
    $files = git diff --cached --name-only
  }
  $normalized = @($files | Where-Object { $_ -and $_.Trim().Length -gt 0 })
  return $normalized
}

function Get-CommitType([string[]]$Files) {
  if ($Files -match "(^|/)docs?/|\.md$") { return "docs" }
  if ($Files -match "(^|/)test(s)?/|\.spec\.|\.test\.") { return "test" }
  if ($Files -match "(^|/)\.github/|(^|/)\.githooks/|(^|/)scripts/") { return "chore" }
  if ($Files -match "(^|/)fxincapapi/|(^|/)server/") { return "fix" }
  if ($Files -match "(^|/)fxincaptrade/|(^|/)fxincapadmin/|(^|/)fxincap/") { return "feat" }
  return "chore"
}

function Get-Scope([string[]]$Files) {
  if ($Files -match "^fxincapapi/") { return "api" }
  if ($Files -match "^fxincaptrade/") { return "trade" }
  if ($Files -match "^fxincapadmin/") { return "admin" }
  if ($Files -match "^fxincapws/") { return "ws" }
  if ($Files -match "^fxincap/") { return "web" }
  return "repo"
}

function Build-Subject([string[]]$Files) {
  $count = $Files.Count
  $sample = ($Files | Select-Object -First 3) -join ", "
  if ($count -le 3) {
    return "update $sample"
  }
  return "update $count files ($sample + more)"
}

$staged = @(Get-ChangedFiles)
if (@($staged).Count -eq 0) {
  Write-Host "No changes to commit."
  exit 0
}

$type = Get-CommitType -Files $staged
$scope = Get-Scope -Files $staged
$subject = Build-Subject -Files $staged
$message = "$type($scope): $subject"

git commit -m $message
Write-Host "Committed: $message"

if ($Push) {
  git push origin $Branch
  Write-Host "Pushed to origin/$Branch"
}

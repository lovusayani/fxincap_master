param(
  [string]$RepoPath = "F:/app/fxfx",
  [string]$TaskName = "FXFX-AutoSync",
  [int]$IntervalMinutes = 10,
  [string]$Branch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $RepoPath "scripts/auto-sync.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Auto-sync script not found: $scriptPath"
}

$cmd = "powershell -ExecutionPolicy Bypass -File `"$scriptPath`" -RepoPath `"$RepoPath`" -Branch `"$Branch`""

schtasks /Create /SC MINUTE /MO $IntervalMinutes /TN $TaskName /TR $cmd /F | Out-Null
Write-Host "Scheduled task '$TaskName' created to sync every $IntervalMinutes minutes."

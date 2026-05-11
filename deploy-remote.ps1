#!/usr/bin/env pwsh
# Run this from your local machine to deploy on the live server.
# Usage: .\deploy-remote.ps1

$msg = "fc" + (Get-Date -Format "yyyyMMddHHmmss")

Write-Host "`n>> git add ." -ForegroundColor Cyan
git add .

Write-Host "`n>> git commit -m `"$msg`"" -ForegroundColor Cyan
git commit -m $msg

Write-Host "`n>> git push origin main" -ForegroundColor Cyan
git push origin main

Write-Host "`n>> Running deploy on live server..." -ForegroundColor Cyan
ssh kaka "bash /var/www/deploy.sh"

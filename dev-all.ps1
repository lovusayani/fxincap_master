param(
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "start"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$services = @(
    @{
        Name = "incap"
        Port = 4000
        Dir = Join-Path $Root "fxincap"
        Command = "pnpm dev"
    },
    @{
        Name = "admin"
        Port = 5173
        Dir = Join-Path $Root "fxincapadmin\client"
        Command = "pnpm dev"
    },
    @{
        Name = "api"
        Port = 7000
        Dir = Join-Path $Root "fxincapapi"
        Command = "pnpm dev"
    },
    @{
        Name = "trade"
        Port = 3000
        Dir = Join-Path $Root "fxincaptrade"
        Command = "pnpm dev"
    },
    @{
        Name = "ws"
        Port = 4040
        Dir = Join-Path $Root "fxincapws"
        Command = "pnpm dev"
    }
)

function Get-PortStatus {
    param([int]$Port)

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $listener) {
        return [pscustomobject]@{
            Listening = $false
            Pid = $null
        }
    }

    return [pscustomobject]@{
        Listening = $true
        Pid = $listener.OwningProcess
    }
}

function Start-Services {
    $names = ($services | ForEach-Object { $_.Name }) -join ","
    $commands = @()

    foreach ($svc in $services) {
        $commands += ("cd /d `"{0}`" && {1}" -f $svc.Dir, $svc.Command)
    }

    Write-Host "[start] Running all services in this internal terminal (no external windows)"

    & npx --yes concurrently `
      --names $names `
      --prefix "[{name}]" `
      --prefix-colors "cyan,magenta,blue,green,yellow" `
      @commands
}

function Stop-Services {
    $ports = ($services | ForEach-Object { $_.Port }) -join " "
    Write-Host ("[stop] Killing ports: {0}" -f $ports)
    & npx --yes kill-port $ports | Out-Host
    Write-Host "[stop] Completed"
}

function Show-Status {
    foreach ($svc in $services) {
        $status = Get-PortStatus -Port $svc.Port
        if ($status.Listening) {
            Write-Host ("[status] {0,-6} : LISTENING on {1} (pid {2})" -f $svc.Name, $svc.Port, $status.Pid)
        } else {
            Write-Host ("[status] {0,-6} : DOWN on {1}" -f $svc.Name, $svc.Port)
        }
    }
}

switch ($Action) {
    "start" {
        Start-Services
    }
    "stop" {
        Stop-Services
    }
    "restart" {
        Stop-Services
        Start-Sleep -Seconds 1
        Start-Services
    }
    "status" {
        Show-Status
    }
}

param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$gameRoot = $PSScriptRoot
Set-Location -LiteralPath $gameRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Please install Node.js 22.12 or newer.' }
if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'node_modules\vite\bin\vite.js'))) {
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
$gamePort = 5175
$gameReusable = $false
$gameListeners = @(Get-NetTCPConnection -LocalPort $gamePort -State Listen -ErrorAction SilentlyContinue)
if ($gameListeners.Count -gt 0) {
    try {
        $gamePage = Invoke-WebRequest -Uri "http://127.0.0.1:$gamePort/" -UseBasicParsing -TimeoutSec 3
        $gameReusable = $gamePage.Content.Contains('REALM WARDENS')
    } catch { $gameReusable = $false }
    if (-not $gameReusable) {
        $gamePort = 5177
        while (@(Get-NetTCPConnection -LocalPort $gamePort -State Listen -ErrorAction SilentlyContinue).Count -gt 0) { $gamePort++ }
    }
}
if (-not $gameReusable) {
    if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'dist\index.html'))) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Production build failed.' }
    }
    $gameArguments = @('node_modules/vite/bin/vite.js', 'preview', '--host', '0.0.0.0', '--port', "$gamePort", '--strictPort')
    $gameProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList $gameArguments -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $gameRoot 'server.log') -RedirectStandardError (Join-Path $gameRoot 'server-error.log') -PassThru
    $gameReady = $false
    for ($gameAttempt = 0; $gameAttempt -lt 40; $gameAttempt++) {
        Start-Sleep -Milliseconds 200
        try {
            $gamePage = Invoke-WebRequest -Uri "http://127.0.0.1:$gamePort/" -UseBasicParsing -TimeoutSec 2
            if ($gamePage.StatusCode -eq 200 -and $gamePage.Content.Contains('REALM WARDENS')) { $gameReady = $true; break }
        } catch {}
    }
    if (-not $gameReady) { throw "The game server did not become ready. Inspect server-error.log. PID: $($gameProcess.Id)" }
}
Write-Host "REALM WARDENS: http://127.0.0.1:$gamePort/"
$gameAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'VMware|vEthernet|Loopback' }
foreach ($gameAddress in $gameAddresses) { Write-Host "Phone / tablet (same LAN): http://$($gameAddress.IPAddress):$gamePort/" }
if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$gamePort/" }

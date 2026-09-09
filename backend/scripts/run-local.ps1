param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location -LiteralPath $projectRoot
$backendPython = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $backendPython)) {
    throw 'Create backend/.venv and install backend/requirements.lock.txt first. See backend/README.md.'
}

# The isolated database runtime is optional; Docker or a configured PostGIS works too.
$pgCtlPath = Join-Path $projectRoot '.local/pgsql/bin/pg_ctl.exe'
$pgDataPath = Join-Path $projectRoot '.local/pgdata'
$backendEnvPath = Join-Path $projectRoot 'backend/.env'
$databaseConfigured = $false
if (Test-Path -LiteralPath $backendEnvPath) {
    $databaseLine = Get-Content -LiteralPath $backendEnvPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($databaseLine) {
        $databaseValue = (($databaseLine -split '=', 2)[1]).Trim().Trim('"').Trim("'")
        $databaseConfigured = -not [string]::IsNullOrWhiteSpace($databaseValue)
    }
}
if ($databaseConfigured -and (Test-Path -LiteralPath $pgCtlPath) -and (Test-Path -LiteralPath $pgDataPath)) {
    $pgReadyPath = Join-Path $projectRoot '.local/pgsql/bin/pg_isready.exe'
    & $pgReadyPath -h 127.0.0.1 -p 55432 -q
    if ($LASTEXITCODE -ne 0) {
        Start-Process -FilePath $pgCtlPath -ArgumentList '-D .local/pgdata -l .local/postgres.log start -w' -WindowStyle Hidden
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            Start-Sleep -Milliseconds 250
            & $pgReadyPath -h 127.0.0.1 -p 55432 -q
            if ($LASTEXITCODE -eq 0) { break }
        }
        if ($LASTEXITCODE -ne 0) { throw 'Local PostGIS did not start. See .local/postgres.log.' }
    }
}

try {
    $existingApi = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2
    if ($existingApi.app -eq 'PRANA Air Quality API') {
        Write-Output "PRANA is already running at http://127.0.0.1:$Port/docs"
        exit 0
    }
} catch { }
$env:PORT = "$Port"
$env:HOST = '0.0.0.0'
& $backendPython -m backend.scripts.serve
exit $LASTEXITCODE

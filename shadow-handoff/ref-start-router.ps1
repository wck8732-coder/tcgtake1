param([switch]$Background)
# Start (or restart) the project router on 127.0.0.1:8000 with a pidfile so
# repeated -Background runs never leak orphan uvicorn processes.
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PYTHONUNBUFFERED = "1"
$pidfile = Join-Path $projectRoot "router.pid"

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "router.py"))) {
    throw "router.py not found in $projectRoot"
}

# --- stop any existing listener so only one uvicorn owns :8000 ---
if (Test-Path -LiteralPath $pidfile) {
    $oldPid = (Get-Content -LiteralPath $pidfile | Select-Object -First 1).Trim()
    if ($oldPid -and $oldPid -match '^\d+$') {
        Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidfile -Force -ErrorAction SilentlyContinue
}
# Also stop any other uvicorn already bound to :8000 (orphan cleanup).
$bound = (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($bound) {
    Stop-Process -Id ([int]$bound) -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 400
}

if ($Background) {
    $proc = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "router:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    Set-Content -LiteralPath $pidfile -Value $proc.Id
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/v1/health" -TimeoutSec 2
            if ($health.status -eq "ok") { Write-Host "Router ready (pid $($proc.Id)): http://127.0.0.1:8000/v1"; exit 0 }
        } catch { }
    }
    throw "Router did not become ready on port 8000"
}

# Foreground: run the router; remove the pidfile on exit.
Remove-Item -LiteralPath $pidfile -Force -ErrorAction SilentlyContinue
python -m uvicorn router:app --host 127.0.0.1 --port 8000
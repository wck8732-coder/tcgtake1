param([switch]$Background)
# Fallback router starter — mirrors start-router.ps1 but on :8002 with router-fallback.py
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PYTHONUNBUFFERED = "1"
$pidfile = Join-Path $projectRoot "router-fallback.pid"

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "router-fallback.py"))) {
    throw "router-fallback.py not found in $projectRoot"
}

# --- stop any existing listener so only one owns :8002 ---
if (Test-Path -LiteralPath $pidfile) {
    $oldPid = (Get-Content -LiteralPath $pidfile | Select-Object -First 1).Trim()
    if ($oldPid -and $oldPid -match '^\d+$') {
        Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidfile -Force -ErrorAction SilentlyContinue
}
$bound = (Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($bound) {
    Stop-Process -Id ([int]$bound) -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 400
}

if ($Background) {
    $proc = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "router-fallback:app", "--host", "127.0.0.1", "--port", "8002" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    Set-Content -LiteralPath $pidfile -Value $proc.Id
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8002/v1/health" -TimeoutSec 2
            if ($health.status -eq "ok") { Write-Host "Fallback router ready (pid $($proc.Id)): http://127.0.0.1:8002/v1"; exit 0 }
        } catch { }
    }
    throw "Fallback router did not become ready on port 8002"
}

# Foreground
Remove-Item -LiteralPath $pidfile -Force -ErrorAction SilentlyContinue
python -m uvicorn router-fallback:app --host 127.0.0.1 --port 8002

param([switch]$Background)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:PYTHONUNBUFFERED = "1"

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "router.py"))) {
    throw "router.py not found in $projectRoot"
}

if ($Background) {
    Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "router:app", "--host", "127.0.0.1", "--port", "8000" -WorkingDirectory $projectRoot -WindowStyle Hidden
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/v1/health" -TimeoutSec 2
            if ($health.status -eq "ok") { Write-Host "Router ready: http://127.0.0.1:8000/v1"; exit 0 }
        } catch { }
    }
    throw "Router did not become ready on port 8000"
}

python -m uvicorn router:app --host 127.0.0.1 --port 8000

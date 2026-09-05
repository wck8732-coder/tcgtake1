param([switch]$NoStart, [switch]$Quiet)
# Fallback smoke test — mirrors router-smoke.ps1 but on :8002
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Base = "http://127.0.0.1:8002"
$Pass = @(); $Fail = @()

$Secret = ""
foreach ($f in @((Join-Path $Root ".env"), "C:\Users\Blayne\AppData\Local\hermes\router\.env", "C:\Users\Blayne\AppData\Local\hermes\.env")) {
    if (Test-Path -LiteralPath $f) {
        $line = Get-Content -LiteralPath $f | Where-Object { $_ -match '^\s*ROUTER_SHARED_SECRET\s*=' } | Select-Object -First 1
        if ($line) { $Secret = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'"); if ($Secret) { break } }
    }
}
$Headers = @{}
if ($Secret) { $Headers["Authorization"] = "Bearer $Secret" }

function Out($m){ if (-not $Quiet) { Write-Host $m } }

function Check($name, [scriptblock]$body){
    try {
        & $body | Out-Null
        $script:Pass += $name
        Out "  PASS  $name"
    } catch {
        $script:Fail += $name
        Out "  FAIL  $name :: $($_.Exception.Message)"
    }
}

$bound = (Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if (-not $bound -and -not $NoStart) {
    Out "Fallback router not up; starting via start-fallback-router.ps1..."
    powershell -ExecutionPolicy Bypass -File (Join-Path $Root "start-fallback-router.ps1") -Background | Out-Null
    $bound = (Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue).OwningProcess
}
if (-not $bound) { Out "ERROR: no fallback router listening on :8002 (use -NoStart to skip autostart)"; exit 2 }
Out "Fallback router listener pid: $bound"

Check "health" { Invoke-RestMethod -Uri "$Base/v1/health" -TimeoutSec 10 | Out-Null }

Check "status-no-token -> 401" {
    try { Invoke-RestMethod -Uri "$Base/v1/router/status" -TimeoutSec 10; throw "expected 401 but got 200" }
    catch { if ("$($_.Exception.Response.StatusCode.value__)" -ne "401") { throw "expected 401 got $($_.Exception.Response.StatusCode.value__)" } }
}
Check "status-with-token -> 200" {
    $s = Invoke-RestMethod -Uri "$Base/v1/router/status" -Headers $Headers -TimeoutSec 10
    if ("$($s.status)" -ne "ok") { throw "status not ok" }
}

function Post-Chat([bool]$stream){
    $payload = @{ model="hermes-router-auto"; stream=$stream; messages=@(@{role="user"; content="Reply with the single word: pong"}) }
    Invoke-RestMethod -Method Post -Uri "$Base/v1/chat/completions" -Headers $Headers -ContentType "application/json; charset=utf-8" -Body ($payload | ConvertTo-Json -Depth 12) -TimeoutSec 60
}
function Post-Responses([bool]$stream){
    $payload = @{ model="hermes-router-auto"; stream=$stream; input=@(@{role="user"; content="Reply with the single word: pong"}) }
    Invoke-RestMethod -Method Post -Uri "$Base/v1/responses" -Headers $Headers -ContentType "application/json; charset=utf-8" -Body ($payload | ConvertTo-Json -Depth 12) -TimeoutSec 60
}
function Post-Messages([bool]$stream){
    $payload = @{ model="hermes-router-auto"; max_tokens=16; stream=$stream; messages=@(@{role="user"; content="Reply with the single word: pong"}) }
    Invoke-RestMethod -Method Post -Uri "$Base/v1/messages" -Headers $Headers -ContentType "application/json; charset=utf-8" -Body ($payload | ConvertTo-Json -Depth 12) -TimeoutSec 60
}

Check "chat non-stream"      { Post-Chat $false    | Out-Null }
Check "chat stream"          { Post-Chat $true     | Out-Null }
Check "responses non-stream" { Post-Responses $false | Out-Null }
Check "responses stream"     { Post-Responses $true  | Out-Null }
Check "messages non-stream"  { Post-Messages $false  | Out-Null }
Check "messages stream"      { Post-Messages $true   | Out-Null }

Out ""
Out "RESULT: $($Pass.Count) passed, $($Fail.Count) failed"
if ($Fail.Count) { $Fail | ForEach-Object { Out "  FAILED: $_" }; exit 1 }
exit 0

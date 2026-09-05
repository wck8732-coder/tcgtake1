# tcg-context.ps1
# Reads the TCG project's key docs and asks Qwen3.8-27B (via Ollama API, thinking disabled).
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\tcg-context.ps1
#   powershell -ExecutionPolicy Bypass -File .\tcg-context.ps1 -Question "What is the current state of the set rebalance?"
param(
    [string]$Question = "Summarize this project: current version, architecture, source-of-truth rules, factions/types/keywords, build/verify commands, and next planned work items."
)

$Root = "C:\Users\Shadow\Documents\GitHub\tcgtake1"
$Docs = @(
    "$Root\README.md",
    "$Root\tcg-web-prototype\AGENTS.md",
    "$Root\tcg-web-prototype\notesfc.txt",
    "$Root\tcg-web-prototype\SESSION_HISTORY.md",
    "$Root\tcg-web-prototype\DECKBUILDER_PLAN.md"
)

$Header = @"
You are an assistant for the TCG Master Project (repo: $Root).
Only reference the files provided. Do not mention GPU usage, inference speed, or any local LLM tooling.
Answer the question at the end strictly from this context. Be concise. Do not include a thinking/analysis chain.
"@

$FilesBlock = @()
foreach ($Path in $Docs) {
    if (Test-Path -LiteralPath $Path) {
        $FilesBlock += "`n===== FILE: $Path ====="
        $FilesBlock += (Get-Content -LiteralPath $Path -Raw)
    } else {
        $FilesBlock += "`n===== FILE MISSING: $Path ====="
    }
}

$Prompt = $Header + ($FilesBlock -join "`n") + "`n`n===== QUESTION =====`n" + $Question

Write-Host "Sending ~$([math]::Round($Prompt.Length/1KB,1)) KB of project context to smtek/Qwen3.8-27B:Q3_K_XL-16gb..." -ForegroundColor Cyan

$Body = @{
    model = "smtek/Qwen3.8-27B:Q3_K_XL-16gb"
    messages = @(
        @{ role = "user"; content = $Prompt }
    )
    stream = $false
    think = $false
} | ConvertTo-Json -Depth 6

$TmpFile = Join-Path $env:TEMP "tcg_ollama_body.json"
[System.IO.File]::WriteAllText($TmpFile, $Body, [System.Text.UTF8Encoding]::new($false))

try {
    $Response = Invoke-RestMethod -Uri "http://localhost:11434/api/chat" -Method Post -ContentType "application/json" -InFile $TmpFile
    $Response.message.content
} catch {
    Write-Error "Ollama request failed: $($_.Exception.Message)"
    exit 1
} finally {
    Remove-Item -LiteralPath $TmpFile -ErrorAction SilentlyContinue
}
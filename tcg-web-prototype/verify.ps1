# verify.ps1 — Full project verification suite (v0.1047)
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File verify.ps1
#
# Runs: build-card verification (via node build-cards.js), schema check,
#       96-test harness, semantic data validation, headless sims (Classic + Standard),
#       Unity data regen.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Push-Location $root

Write-Host "=== 1/7 Syntax gate ===" -ForegroundColor Cyan
node --check rules_engine.js game.js simulate.js
node --check build-cards.js build-unity-cards.js gen_decks.js
node --check validate-data.js validate-identity.js

Write-Host "=== 2/7 Card build identity ===" -ForegroundColor Cyan
node build-cards.js verify

Write-Host "=== 3/7 Recall/Ominous 96-test harness ===" -ForegroundColor Cyan
node recall_ominous_test.js | Select-String -Pattern "passed|failed"

Write-Host "=== 4/7 Semantic data validation ===" -ForegroundColor Cyan
node validate-data.js | Select-String -Pattern "PASS|FAIL|WARN|checks:"

Write-Host "=== 4b/7 Identity lint ===" -ForegroundColor Cyan
node validate-identity.js | Select-String -Pattern "PASS|FAIL|WARN|checks:|IDENTITY"

Write-Host "=== 5/7 Headless sim: Classic ===" -ForegroundColor Cyan
node simulate.js 10 medium Classic

Write-Host "=== 6/7 Headless sim: Standard ===" -ForegroundColor Cyan
node simulate.js 10 medium Standard

Write-Host "=== 7/7 Unity data regeneration ===" -ForegroundColor Cyan
node build-unity-cards.js

Pop-Location
Write-Host "`nVerification complete." -ForegroundColor Green

# verify-checkpoint.ps1
# Detects corruption in a snapshot AND in the live project.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1
#     (uses latest snapshot from backups\latest.txt)
#   powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1 -Snapshot v0.1030_2026-08-04_1516
#
# Checks:
#   1. Snapshot internal integrity   (snapshot files vs snapshot MANIFEST.sha256)
#   2. Live project vs snapshot      (current project files vs snapshot hashes)
#
# Exit code 0 = all clean, 1 = corruption detected.

param(
    [string]$Snapshot
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupsRoot = $PSScriptRoot

# Resolve snapshot dir
if (-not $Snapshot) {
    $latestFile = Join-Path $BackupsRoot "latest.txt"
    if (-not (Test-Path -LiteralPath $latestFile)) {
        Write-Host "ERROR: no latest.txt and no -Snapshot given" -ForegroundColor Red
        exit 1
    }
    $SnapshotDir = Get-Content -LiteralPath $latestFile
} else {
    $SnapshotDir = Join-Path $BackupsRoot $Snapshot
}

if (-not (Test-Path -LiteralPath $SnapshotDir)) {
    Write-Host "ERROR: snapshot not found: $SnapshotDir" -ForegroundColor Red
    exit 1
}

$manifestPath = Join-Path $SnapshotDir "MANIFEST.sha256"
if (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Host "ERROR: no MANIFEST.sha256 in snapshot: $SnapshotDir" -ForegroundColor Red
    exit 1
}

Write-Host "Verifying snapshot: $SnapshotDir"
Write-Host ""

$failures = 0

# --- Load manifest as hashtable: relative-path -> hash ---
$manifest = @{}
Get-Content -LiteralPath $manifestPath | ForEach-Object {
    if ($_ -match "^\s*([0-9a-f]{64})\s+(.+)\s*$") {
        $manifest[$matches[2]] = $matches[1]
    }
}

# --- 1. Snapshot internal integrity ---
Write-Host "[1/2] Snapshot internal integrity..." -ForegroundColor Cyan
Get-ChildItem -LiteralPath $SnapshotDir -Recurse -File | Where-Object { $_.Name -ne "MANIFEST.sha256" } | ForEach-Object {
    $rel = $_.FullName.Substring($SnapshotDir.Length + 1)
    $expected = $manifest[$rel]
    if (-not $expected) {
        Write-Host "  ORPHAN (not in manifest): $rel" -ForegroundColor Yellow
        $failures++
        return
    }
    $actual = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) {
        Write-Host "  CORRUPT in snapshot:      $rel" -ForegroundColor Red
        $failures++
    }
}
Write-Host "  Snapshot files: $((Get-ChildItem -LiteralPath $SnapshotDir -Recurse -File | Where-Object { $_.Name -ne 'MANIFEST.sha256' }).Count) checked"
Write-Host ""

# --- 2. Live project vs snapshot ---
Write-Host "[2/2] Live project vs snapshot..." -ForegroundColor Cyan
$manifest.Keys | Where-Object { $_ -notlike "backups/*" -and $_ -ne "latest.txt" } | Sort-Object | ForEach-Object {
    $rel = $_
    $livePath = Join-Path $ProjectRoot $rel
    $expected = $manifest[$rel]
    if (-not (Test-Path -LiteralPath $livePath)) {
        Write-Host "  MISSING in project:       $rel" -ForegroundColor Yellow
        $failures++
        return
    }
    $actual = (Get-FileHash -LiteralPath $livePath -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) {
        Write-Host "  CHANGED/CORRUPT in project: $rel" -ForegroundColor Yellow
        # Do NOT count as failure - the project legitimately evolves between checkpoints.
        # Only snapshot-internal corruption is a hard failure.
    }
}
Write-Host ""

if ($failures -eq 0) {
    Write-Host "RESULT: snapshot is INTACT (no corruption detected)." -ForegroundColor Green
    Write-Host "Files that differ from snapshot are just normal edits since the snapshot was taken."
    exit 0
} else {
    Write-Host "RESULT: $failures issue(s) detected - see above." -ForegroundColor Red
    exit 1
}

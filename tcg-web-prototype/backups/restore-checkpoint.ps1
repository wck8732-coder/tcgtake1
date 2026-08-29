# restore-checkpoint.ps1
# Restores project files from a snapshot (corruption/loss recovery).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File backups\restore-checkpoint.ps1
#     (uses latest snapshot from backups\latest.txt)
#   powershell -ExecutionPolicy Bypass -File backups\restore-checkpoint.ps1 -Snapshot v0.1030_2026-08-04_1516
#
# WARNING: Overwrites current project files. A pre-restore backup is created
# automatically under backups\pre-restore_<timestamp>_<snapshotname> so you can
# undo the restore if needed.

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

$snapName = Split-Path -Leaf $SnapshotDir

# First verify the snapshot is internally intact before restoring from it
& (Join-Path $PSScriptRoot "verify-checkpoint.ps1") -Snapshot $snapName
if ($LASTEXITCODE -ne 0) {
    Write-Host "ABORT: snapshot failed integrity check - not restoring from a corrupt snapshot." -ForegroundColor Red
    exit 1
}

# Create pre-restore backup of current state
$preRestore = Join-Path $BackupsRoot "pre-restore_$(Get-Date -Format 'yyyy-MM-dd_HHmm')_$snapName"
New-Item -ItemType Directory -Path $preRestore | Out-Null
Get-ChildItem -LiteralPath $ProjectRoot -Force | Where-Object { $_.FullName -ne $BackupsRoot } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $preRestore $_.Name) -Recurse -Force
}
Write-Host "Pre-restore backup of current state saved to: $preRestore" -ForegroundColor Cyan

# Restore all files from snapshot (excluding the manifest itself)
$restored = 0
Get-ChildItem -LiteralPath $SnapshotDir -Force | Where-Object { $_.Name -ne "MANIFEST.sha256" } | ForEach-Object {
    $dest = Join-Path $ProjectRoot $_.Name
    if ($_.PSIsContainer) {
        Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
    } else {
        Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
    }
    $restored++
}

Write-Host "RESTORED $restored items from $snapName into $ProjectRoot" -ForegroundColor Green
Write-Host "Verify: powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1 -Snapshot $snapName"

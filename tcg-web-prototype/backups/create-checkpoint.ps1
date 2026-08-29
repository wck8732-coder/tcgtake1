# create-checkpoint.ps1
# Creates a versioned snapshot of the project (excluding the backups folder and
# .opencode — tool state, secrets, node_modules) with a SHA256 manifest.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File backups\create-checkpoint.ps1 -Name v0.1040
#   (If -Name omitted, uses "snapshot")
#
# Output:
#   backups\<Name>_<yyyy-MM-dd>_<HHmm>\   (copies of all project files)
#   backups\<Name>_<yyyy-MM-dd>_<HHmm>\MANIFEST.sha256
#   backups\latest.txt                     (path to most recent snapshot)

param(
    [string]$Name = "snapshot"
)

$ErrorActionPreference = "Stop"

$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$BackupsRoot  = $PSScriptRoot
$Stamp        = Get-Date -Format "yyyy-MM-dd_HHmm"
$SnapshotDir  = Join-Path $BackupsRoot "$Name`_$Stamp"

if (Test-Path -LiteralPath $SnapshotDir) {
    Write-Host "ERROR: snapshot dir already exists: $SnapshotDir" -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Path $SnapshotDir | Out-Null

$copied = 0
Get-ChildItem -LiteralPath $ProjectRoot -Force | ForEach-Object {
    # Skip the backups folder itself and .opencode (tool state / secrets / node_modules)
    if ($_.FullName -eq $BackupsRoot) { return }
    if ($_.Name -eq '.opencode') { return }

    $dest = Join-Path $SnapshotDir $_.Name
    if ($_.PSIsContainer) {
        Copy-Item -LiteralPath $_.FullName -Destination $dest -Recurse -Force
    } else {
        Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
    }
    $copied++
}

# Generate SHA256 manifest (relative paths, LF-separated)
$manifestLines = @()
Get-ChildItem -LiteralPath $SnapshotDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($SnapshotDir.Length + 1)
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()
    $manifestLines += "$hash  $rel"
}
# Sort by path for stable diffing
$manifestPath = Join-Path $SnapshotDir "MANIFEST.sha256"
[System.IO.File]::WriteAllLines($manifestPath, ($manifestLines | Sort-Object))

# Record latest
Set-Content -Path (Join-Path $BackupsRoot "latest.txt") -Value $SnapshotDir -NoNewline

Write-Host "SNAPSHOT CREATED: $SnapshotDir"
Write-Host "Files copied:      $copied"
Write-Host "Manifest entries:  $($manifestLines.Count)"
Write-Host ""
Write-Host "Verify it:  powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1 -Snapshot $($SnapshotDir | Split-Path -Leaf)"

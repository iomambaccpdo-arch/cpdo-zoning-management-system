# Department Head laptop: replace local data with the office export package.
# Close the CPDO app windows first. Right-click -> Run with PowerShell, or double-click import-sync-package.bat

$ErrorActionPreference = "Stop"
$ScriptFileDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$commonPath = [System.IO.Path]::GetFullPath((Join-Path $ScriptFileDir "..\sync-common.ps1"))
. $commonPath

$ScriptsDir = Get-CpdoScriptsRoot -ScriptFileDir $ScriptFileDir

Write-Host ""
Write-Host "CPDO - Import sync package (Department Head laptop)" -ForegroundColor Cyan
Write-Host ""

$config = Get-CpdoSyncConfig -ScriptsDir $ScriptsDir
$projectRoot = if ($config.ProjectRoot) { $config.ProjectRoot } else { Get-CpdoProjectRoot -ScriptsDir $ScriptsDir }
$db = Get-CpdoDatabaseSettings -ProjectRoot $projectRoot
$documentsDest = Get-CpdoDocumentsPath -ProjectRoot $projectRoot
$packageDir = $config.PackageDir
$backupFile = Join-Path $packageDir "server.backup"
$documentsSrc = Join-Path $packageDir "documents"
$manifestPath = Join-Path $packageDir "MANIFEST.json"

if (-not (Test-Path -LiteralPath $backupFile)) {
    $msg = "Missing backup file: $backupFile`nRun export on the office PC first, or check SyncFolder in sync-config.ps1."
    throw $msg
}

Write-Host "WARNING: This replaces ALL local CPDO data with the office copy." -ForegroundColor Yellow
Write-Host "Close Laravel and frontend windows before continuing."
Write-Host ""
$confirm = Read-Host "Type YES to import"
if ($confirm -ne "YES") {
    Write-Host "Cancelled."
    exit 0
}

if (Test-Path -LiteralPath $manifestPath) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    Write-Host ('Package from: {0} at {1}' -f $manifest.computer, $manifest.exportedAt)
    Write-Host ""
}

$pgRestore = Find-CpdoPostgresTool -ToolName "pg_restore"

Write-Host "Project:  $projectRoot"
Write-Host ('Database: {0} on {1}:{2}' -f $db.Database, $db.Host, $db.Port)
Write-Host "Package:  $packageDir"
Write-Host ""

if ($db.Password) {
    $env:PGPASSWORD = $db.Password
}

try {
    Write-Host "Restoring PostgreSQL (harmless warnings are OK)..."
    & $pgRestore -U $db.Username -h $db.Host -p $db.Port -d $db.Database --clean --if-exists $backupFile 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "pg_restore reported errors. If the app still fails, in pgAdmin run:" -ForegroundColor Yellow
        Write-Host ('  DROP DATABASE {0}; CREATE DATABASE {0};' -f $db.Database)
        Write-Host "Then run this import again."
        throw "pg_restore failed (exit $LASTEXITCODE)."
    }

    Write-Host "Copying PDF documents..."
    if (-not (Test-Path -LiteralPath $documentsDest)) {
        New-Item -ItemType Directory -Force -Path $documentsDest | Out-Null
    }
    Get-ChildItem -LiteralPath $documentsDest -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
    if (Test-Path -LiteralPath $documentsSrc) {
        Copy-Item -Path (Join-Path $documentsSrc "*") -Destination $documentsDest -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "Import finished." -ForegroundColor Green
    Write-Host "Start the app with scripts\For Opening the System\start-cpdo-system.bat"
    Write-Host "Then open http://localhost:9000"
    Write-Host ""
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

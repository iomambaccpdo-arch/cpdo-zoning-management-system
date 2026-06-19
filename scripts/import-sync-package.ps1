# Department Head laptop: replace local data with the office export package.
# Close the CPDO app windows first. Right-click -> Run with PowerShell, or double-click import-sync-package.bat

$ErrorActionPreference = "Stop"
$ScriptFileDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$commonPath = [System.IO.Path]::GetFullPath((Join-Path $ScriptFileDir "sync-common.ps1"))
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

if (-not (Test-CpdoPostgresServiceRunning)) {
    throw "PostgreSQL service is not running. Start it in services.msc (postgresql-x64-*) then run import again."
}

if (-not (Test-CpdoDatabaseConnection -Db $db)) {
    Write-Host ""
    Write-Host "Cannot connect with server\.env on THIS laptop." -ForegroundColor Red
    Write-Host "Fix DB_PASSWORD (password for PostgreSQL on the DH laptop), ensure database exists, then retry."
    Write-Host "Run scripts\check-database.bat for details."
    throw "Database connection failed before import."
}

if ($db.Password) {
    $env:PGPASSWORD = $db.Password
}

try {
    Ensure-CpdoDatabaseExists -Db $db

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

    $artisanDir = Join-Path $projectRoot "server"

    Write-Host "Applying any pending Laravel migrations..."
    Push-Location $artisanDir
    try {
        php artisan migrate --force 2>&1 | ForEach-Object { Write-Host $_ }
        if ($LASTEXITCODE -ne 0) {
            throw "php artisan migrate --force failed (exit $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }

    $userCount = Get-CpdoDatabaseUserCount -Db $db
    if ($userCount -lt 1) {
        Write-Host ""
        Write-Host "WARNING: No users found after import. Login will fail." -ForegroundColor Yellow
        Write-Host "Re-run import after DROP DATABASE server; CREATE DATABASE server; in pgAdmin."
    } else {
        Write-Host "Verified: $userCount login account(s) in database."
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

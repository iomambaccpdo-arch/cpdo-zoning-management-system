# Office PC (source): export database + PDF files for the Department Head laptop.
# Right-click -> Run with PowerShell, or double-click export-sync-package.bat

$ErrorActionPreference = "Stop"
$ScriptFileDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$commonPath = [System.IO.Path]::GetFullPath((Join-Path $ScriptFileDir "..\sync-common.ps1"))
if (-not (Test-Path -LiteralPath $commonPath)) {
    throw "Missing sync-common.ps1 at $commonPath"
}
. $commonPath

$ScriptsDir = Get-CpdoScriptsRoot -ScriptFileDir $ScriptFileDir

Write-Host ""
Write-Host "CPDO - Export sync package (office PC)" -ForegroundColor Cyan
Write-Host ""

$config = Get-CpdoSyncConfig -ScriptsDir $ScriptsDir
$projectRoot = if ($config.ProjectRoot) { $config.ProjectRoot } else { Get-CpdoProjectRoot -ScriptsDir $ScriptsDir }
$db = Get-CpdoDatabaseSettings -ProjectRoot $projectRoot
$documentsSrc = Get-CpdoDocumentsPath -ProjectRoot $projectRoot
$packageDir = $config.PackageDir
$backupFile = Join-Path $packageDir "server.backup"
$documentsDest = Join-Path $packageDir "documents"

if (-not (Test-Path -LiteralPath $documentsSrc)) {
    New-Item -ItemType Directory -Force -Path $documentsSrc | Out-Null
}

$syncRoot = Split-Path -Parent $packageDir
if (-not (Test-Path -LiteralPath $syncRoot)) {
    Write-Host "Creating sync folder: $syncRoot"
    New-Item -ItemType Directory -Force -Path $syncRoot | Out-Null
}
New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

$pgDump = Find-CpdoPostgresTool -ToolName "pg_dump"

Write-Host "Project:  $projectRoot"
Write-Host ('Database: {0} on {1}:{2}' -f $db.Database, $db.Host, $db.Port)
Write-Host "Output:   $packageDir"
Write-Host ""

if ($db.Password) {
    $env:PGPASSWORD = $db.Password
}

try {
    Write-Host "Dumping PostgreSQL..."
    & $pgDump -U $db.Username -h $db.Host -p $db.Port -F c -f $backupFile $db.Database
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed (exit $LASTEXITCODE)."
    }

    Write-Host "Copying PDF documents..."
    if (Test-Path -LiteralPath $documentsDest) {
        Remove-Item -LiteralPath $documentsDest -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $documentsDest | Out-Null
    Copy-Item -Path (Join-Path $documentsSrc "*") -Destination $documentsDest -Recurse -Force -ErrorAction SilentlyContinue

    Write-CpdoManifest -PackageDir $packageDir -Role "export" -Db $db -ProjectRoot $projectRoot

    Write-Host ""
    Write-Host "Export finished." -ForegroundColor Green
    Write-Host "Give the Department Head this folder:" -ForegroundColor Green
    Write-Host "  $packageDir"
    Write-Host ""
    Write-Host "Safely eject the USB when done."
    Write-Host "On the DH laptop, run scripts\Import\import-sync-package.bat"
    Write-Host ""
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

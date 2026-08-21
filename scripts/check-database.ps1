# Any PC: test PHP, PostgreSQL, server\.env, tables, and login accounts.
# Right-click -> Run with PowerShell, or double-click check-database.bat

$ErrorActionPreference = "Continue"
$ScriptFileDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$commonPath = [System.IO.Path]::GetFullPath((Join-Path $ScriptFileDir "sync-common.ps1"))
if (-not (Test-Path -LiteralPath $commonPath)) {
    throw "Missing sync-common.ps1 at $commonPath"
}
. $commonPath

function Write-Check {
    param(
        [bool] $Ok,
        [string] $Name,
        [string] $Detail = ""
    )

    $label = if ($Ok) { "OK  " } else { "FAIL" }
    $color = if ($Ok) { "Green" } else { "Red" }
    $line = if ($Detail) { "$label  $Name - $Detail" } else { "$label  $Name" }
    Write-Host $line -ForegroundColor $color
}

$failCount = 0

Write-Host ""
Write-Host "CPDO - Database and environment check" -ForegroundColor Cyan
Write-Host ""

$ScriptsDir = Get-CpdoScriptsRoot -ScriptFileDir $ScriptFileDir
try {
    $projectRoot = Get-CpdoProjectRoot -ScriptsDir $ScriptsDir
    Write-Check -Ok $true -Name "Project folder" -Detail $projectRoot
} catch {
    Write-Check -Ok $false -Name "Project folder" -Detail $_.Exception.Message
    Write-Host ""
    Write-Host "Fix the FAIL lines above, then run this check again." -ForegroundColor Yellow
    exit 1
}

$phpCmd = Get-Command php -ErrorAction SilentlyContinue
if ($phpCmd) {
    $phpVersion = (& php -r "echo PHP_VERSION;" 2>$null)
    Write-Check -Ok $true -Name "PHP on PATH" -Detail $(if ($phpVersion) { $phpVersion } else { $phpCmd.Source })
} else {
    Write-Check -Ok $false -Name "PHP on PATH" -Detail "Install PHP or add php.exe to PATH."
    $failCount++
}

if ($phpCmd) {
    $pdo = & php -m 2>$null | Where-Object { $_ -eq "pdo_pgsql" }
    if ($pdo) {
        Write-Check -Ok $true -Name "PHP pdo_pgsql" -Detail "Enabled"
    } else {
        Write-Check -Ok $false -Name "PHP pdo_pgsql" -Detail "Enable pdo_pgsql in php.ini (php --ini), then reopen this window."
        $failCount++
    }
}

$pgService = Test-CpdoPostgresServiceRunning
if ($pgService) {
    Write-Check -Ok $true -Name "PostgreSQL service" -Detail "Running"
} else {
    Write-Check -Ok $false -Name "PostgreSQL service" -Detail "Start it in services.msc (postgresql-x64-*) and set Startup type to Automatic."
    $failCount++
}

try {
    $db = Get-CpdoDatabaseSettings -ProjectRoot $projectRoot
    Write-Check -Ok $true -Name "server\.env" -Detail ('{0} on {1}:{2} as {3}' -f $db.Database, $db.Host, $db.Port, $db.Username)
} catch {
    Write-Check -Ok $false -Name "server\.env" -Detail $_.Exception.Message
    $failCount++
    Write-Host ""
    Write-Host "Fix the FAIL lines above, then run this check again." -ForegroundColor Yellow
    exit 1
}

try {
    $null = Find-CpdoPostgresTool -ToolName "psql"
    Write-Check -Ok $true -Name "psql tool" -Detail "Found"
} catch {
    Write-Check -Ok $false -Name "psql tool" -Detail $_.Exception.Message
    $failCount++
    Write-Host ""
    Write-Host "Fix the FAIL lines above, then run this check again." -ForegroundColor Yellow
    exit 1
}

$connected = $false
try {
    $connected = Test-CpdoDatabaseConnection -Db $db
} catch {
    $connected = $false
}

if ($connected) {
    Write-Check -Ok $true -Name "Database connection" -Detail "Connected"
} else {
    Write-Check -Ok $false -Name "Database connection" -Detail "Check DB_PASSWORD in server\.env for THIS PC, and that database '$($db.Database)' exists."
    $failCount++
}

if ($connected) {
    try {
        $tables = Get-CpdoDatabaseTableCount -Db $db
        if ($tables -gt 0) {
            Write-Check -Ok $true -Name "Database tables" -Detail "$tables public table(s)"
        } else {
            Write-Check -Ok $false -Name "Database tables" -Detail "Empty. Run Import\import-sync-package.bat or php artisan migrate --force"
            $failCount++
        }
    } catch {
        Write-Check -Ok $false -Name "Database tables" -Detail $_.Exception.Message
        $failCount++
    }

    try {
        $users = Get-CpdoDatabaseUserCount -Db $db
        if ($users -ge 1) {
            Write-Check -Ok $true -Name "Login accounts" -Detail "$users user(s)"
        } else {
            Write-Check -Ok $false -Name "Login accounts" -Detail "None. Import office data or run php artisan db:seed --force"
            $failCount++
        }
    } catch {
        Write-Check -Ok $false -Name "Login accounts" -Detail $_.Exception.Message
        $failCount++
    }
}

Write-Host ""
if ($failCount -gt 0) {
    Write-Host "Fix every FAIL line, then run this check again." -ForegroundColor Yellow
    exit 1
}

Write-Host "All checks passed." -ForegroundColor Green
Write-Host "Start the app with scripts\For Opening the System\start-cpdo-system.bat"
exit 0

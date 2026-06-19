# Shared helpers for export-sync-package.ps1 and import-sync-package.ps1

function Get-CpdoScriptsRoot {
    param([string] $ScriptFileDir)

    $dir = $ScriptFileDir
    while ($dir) {
        $common = Join-Path $dir "sync-common.ps1"
        if (Test-Path -LiteralPath $common) {
            return (Resolve-Path -LiteralPath $dir).Path
        }
        $parent = Split-Path -Parent $dir
        if (-not $parent -or $parent -eq $dir) {
            break
        }
        $dir = $parent
    }

    throw "Could not find scripts folder (sync-common.ps1)."
}

function Get-CpdoProjectRoot {
    param([string] $ScriptsDir)
    if ($env:CPDO_PROJECT_ROOT -and (Test-Path -LiteralPath $env:CPDO_PROJECT_ROOT)) {
        return (Resolve-Path -LiteralPath $env:CPDO_PROJECT_ROOT).Path
    }
    $scriptsRoot = Get-CpdoScriptsRoot -ScriptFileDir $ScriptsDir
    $parent = Split-Path -Parent $scriptsRoot
    $server = Join-Path $parent "server"
    if (Test-Path -LiteralPath (Join-Path $server "artisan")) {
        return (Resolve-Path -LiteralPath $parent).Path
    }
    throw "Could not find Laravel server folder. Set CPDO_PROJECT_ROOT or run from the project scripts folder."
}

function Get-CpdoSyncConfig {
    param([string] $ScriptsDir)

    $configPath = Join-Path $ScriptsDir "sync-config.ps1"
    $examplePath = Join-Path $ScriptsDir "sync-config.example.ps1"

    if (-not (Test-Path -LiteralPath $configPath)) {
        throw @"
Missing sync-config.ps1

Copy the example and set your USB or shared folder path:
  copy `"$examplePath`" `"$configPath`"
  notepad `"$configPath`"
"@
    }

    . $configPath

    if (-not $SyncFolder) {
        throw "sync-config.ps1 must set `$SyncFolder (e.g. E:\cpdo-sync)."
    }

    return @{
        SyncFolder   = $SyncFolder.TrimEnd('\')
        PackageDir   = Join-Path ($SyncFolder.TrimEnd('\')) "package"
        ProjectRoot  = if ($ProjectRoot) { $ProjectRoot } else { $null }
    }
}

function Read-CpdoEnvFile {
    param([string] $EnvPath)

    if (-not (Test-Path -LiteralPath $EnvPath)) {
        throw "Missing server .env file: $EnvPath`nCopy .env.example to .env and set DB_* values."
    }

    $values = @{}
    Get-Content -LiteralPath $EnvPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim()
        if ($val.StartsWith('"') -and $val.EndsWith('"')) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $values[$key] = $val
    }
    return $values
}

function Get-CpdoDatabaseSettings {
    param([string] $ProjectRoot)

    $env = Read-CpdoEnvFile -EnvPath (Join-Path $ProjectRoot "server\.env")
    $db = @{
        Host     = if ($env["DB_HOST"]) { $env["DB_HOST"] } else { "127.0.0.1" }
        Port     = if ($env["DB_PORT"]) { $env["DB_PORT"] } else { "5432" }
        Database = if ($env["DB_DATABASE"]) { $env["DB_DATABASE"] } else { "server" }
        Username = if ($env["DB_USERNAME"]) { $env["DB_USERNAME"] } else { "postgres" }
        Password = $env["DB_PASSWORD"]
    }

    if ($env["DB_CONNECTION"] -and $env["DB_CONNECTION"] -ne "pgsql") {
        throw "This sync tool only supports PostgreSQL (DB_CONNECTION=pgsql). Found: $($env['DB_CONNECTION'])"
    }

    return $db
}

function Test-CpdoPostgresServiceRunning {
    $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue |
        Where-Object { $_.Status -eq "Running" } |
        Select-Object -First 1

    return [bool] $service
}

function Ensure-CpdoDatabaseExists {
    param(
        [hashtable] $Db
    )

    $psql = Find-CpdoPostgresTool -ToolName "psql"
    $dbName = $Db.Database

    if ($Db.Password) {
        $env:PGPASSWORD = $Db.Password
    }

    try {
        $exists = (& $psql -U $Db.Username -h $Db.Host -p $Db.Port -d postgres -tAc `
            "SELECT 1 FROM pg_database WHERE datname = '$dbName'") -match "1"

        if (-not $exists) {
            Write-Host "Creating database '$dbName'..."
            & $psql -U $Db.Username -h $Db.Host -p $Db.Port -d postgres -c "CREATE DATABASE `"$dbName`";"
            if ($LASTEXITCODE -ne 0) {
                throw "CREATE DATABASE failed (exit $LASTEXITCODE)."
            }
        }
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Test-CpdoDatabaseConnection {
    param([hashtable] $Db)

    $psql = Find-CpdoPostgresTool -ToolName "psql"

    if ($Db.Password) {
        $env:PGPASSWORD = $Db.Password
    }

    try {
        & $psql -U $Db.Username -h $Db.Host -p $Db.Port -d $Db.Database -c "SELECT 1" 2>&1 | Out-Null
        return $LASTEXITCODE -eq 0
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Get-CpdoDatabaseTableCount {
    param([hashtable] $Db)

    $psql = Find-CpdoPostgresTool -ToolName "psql"

    if ($Db.Password) {
        $env:PGPASSWORD = $Db.Password
    }

    try {
        $count = & $psql -U $Db.Username -h $Db.Host -p $Db.Port -d $Db.Database -tAc `
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        return [int]$count
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Get-CpdoDatabaseUserCount {
    param([hashtable] $Db)

    $psql = Find-CpdoPostgresTool -ToolName "psql"

    if ($Db.Password) {
        $env:PGPASSWORD = $Db.Password
    }

    try {
        $count = & $psql -U $Db.Username -h $Db.Host -p $Db.Port -d $Db.Database -tAc `
            "SELECT COUNT(*) FROM users"
        return [int]$count
    }
    catch {
        return 0
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Find-CpdoPostgresTool {
    param([string] $ToolName)

    $cmd = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $roots = @(
        "${env:ProgramFiles}\PostgreSQL",
        "${env:ProgramFiles(x86)}\PostgreSQL"
    )

    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $bins = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\$ToolName.exe" } |
            Where-Object { Test-Path -LiteralPath $_ }
        if ($bins) {
            return $bins[0]
        }
    }

    throw "Could not find $ToolName. Install PostgreSQL or add its bin folder to PATH."
}

function Get-CpdoDocumentsPath {
    param([string] $ProjectRoot)
    Join-Path $ProjectRoot "server\storage\app\private\documents"
}

function Write-CpdoManifest {
    param(
        [string] $PackageDir,
        [string] $Role,
        [hashtable] $Db,
        [string] $ProjectRoot
    )

    $manifest = [ordered]@{
        role          = $Role
        exportedAt    = (Get-Date).ToString("o")
        computer      = $env:COMPUTERNAME
        database      = $Db.Database
        projectRoot   = $ProjectRoot
        cpdoSyncVersion = 1
    }
    $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PackageDir "MANIFEST.json") -Encoding UTF8
}

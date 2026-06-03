# Run once: right-click -> Run with PowerShell (or: powershell -ExecutionPolicy Bypass -File .\register-autostart.ps1)
# Creates a Startup shortcut so both servers start when this user logs into Windows.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BatPath = Join-Path $ScriptDir "start-cpdo-system.bat"

if (-not (Test-Path -LiteralPath $BatPath)) {
    Write-Error "Missing: $BatPath"
    exit 1
}

$Startup = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $Startup "CPDO Zoning System.lnk"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $BatPath
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.WindowStyle = 7
$Shortcut.Description = "Start CPDO Zoning (Laravel + frontend)"
$Shortcut.Save()

Write-Host "Created: $ShortcutPath"
Write-Host "Log off and back on (or reboot) to verify, or run start-cpdo-system.bat once to test."

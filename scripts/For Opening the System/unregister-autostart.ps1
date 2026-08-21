# Removes the Startup shortcut created by register-autostart.ps1

$ErrorActionPreference = "Stop"
$Startup = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $Startup "CPDO Zoning System.lnk"

if (Test-Path -LiteralPath $ShortcutPath) {
    Remove-Item -LiteralPath $ShortcutPath -Force
    Write-Host "Removed: $ShortcutPath"
} else {
    Write-Host "Nothing to remove: $ShortcutPath"
}

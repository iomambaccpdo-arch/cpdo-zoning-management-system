# Office PC only: schedule export-sync-package once per month (USB must use the same drive letter).
# Run once as Administrator is NOT required; runs when the logged-in user is signed in.
# Right-click -> Run with PowerShell

$ErrorActionPreference = "Stop"
$ScriptsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$ExportScript = Join-Path $ScriptsDir "Export\export-sync-package.ps1"

if (-not (Test-Path -LiteralPath $ExportScript)) {
    Write-Error "Missing: $ExportScript"
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $ScriptsDir "sync-config.ps1"))) {
    Write-Error "Create sync-config.ps1 first (copy from sync-config.example.ps1)."
    exit 1
}

$TaskName = "CPDO Export Sync Package"
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 4 -DaysOfWeek Friday -At "18:00"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ExportScript`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Trigger $trigger -Action $action -Settings $settings `
    -Description "Monthly CPDO database + documents export for Department Head laptop." | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "Runs every 4 weeks on Friday at 6:00 PM (adjust in Task Scheduler if needed)."
Write-Host "USB drive letter in sync-config.ps1 must be plugged in at run time."
Write-Host "To remove: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"

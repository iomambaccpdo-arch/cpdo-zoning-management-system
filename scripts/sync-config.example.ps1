# Copy this file to sync-config.ps1 (same folder) and edit on EACH PC.
#
#   copy sync-config.example.ps1 sync-config.ps1
#   notepad sync-config.ps1
#
# Office PC (coworker): set SyncFolder to the USB drive or a folder you copy to the DH laptop.
# Department Head laptop: set SyncFolder to where that package lives (USB letter or D:\cpdo-sync).

# Folder that contains the "package" subfolder (export writes here, import reads from here).
$SyncFolder = "E:\cpdo-sync"

# Optional — only if the project is not one level above scripts\
# $ProjectRoot = "C:\Apps\cpdo-zoning-management-system"

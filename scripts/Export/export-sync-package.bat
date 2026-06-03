@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0export-sync-package.ps1"
if errorlevel 1 pause
endlocal

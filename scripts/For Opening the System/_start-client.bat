@echo off
setlocal EnableExtensions
cd /d "%~dp0..\..\client" || (
  echo Could not find the client folder.
  pause
  exit /b 1
)

where npm >nul 2>&1 || (
  echo npm is not on PATH. Install Node.js or add it to PATH.
  echo Or edit this file and replace "npm" with the full path to npm.cmd.
  pause
  exit /b 1
)

call npm run dev
if errorlevel 1 (
  echo Frontend failed to start.
  pause
  exit /b 1
)
endlocal

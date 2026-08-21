@echo off
setlocal EnableExtensions

REM PostgreSQL must be running (set its Windows service to Automatic).
REM PHP and Node must be on PATH, or edit _start-laravel.bat / _start-client.bat with full paths.

set "ROOT=%~dp0..\.."

if not exist "%ROOT%\server\artisan" (
  echo Could not find Laravel at "%ROOT%\server".
  pause
  exit /b 1
)
if not exist "%ROOT%\client\package.json" (
  echo Could not find the frontend at "%ROOT%\client".
  pause
  exit /b 1
)

where php >nul 2>&1 || (
  echo php is not on PATH. Install PHP or add it to PATH.
  pause
  exit /b 1
)
where npm >nul 2>&1 || (
  echo npm is not on PATH. Install Node.js or add it to PATH.
  pause
  exit /b 1
)

start "CPDO Laravel API" /min "%~dp0_start-laravel.bat"

timeout /t 3 /nobreak >nul

start "CPDO Frontend" /min "%~dp0_start-client.bat"

timeout /t 6 /nobreak >nul
start "" "http://localhost:9000"

endlocal
exit /b 0

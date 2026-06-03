@echo off
setlocal EnableExtensions

REM PostgreSQL must be running (set its Windows service to Automatic).
REM PHP and Node must be on PATH, or edit _start-laravel.bat / _start-client.bat with full paths.

start "CPDO Laravel API" /min "%~dp0_start-laravel.bat"

timeout /t 3 /nobreak >nul

start "CPDO Frontend" /min "%~dp0_start-client.bat"

timeout /t 6 /nobreak >nul
start "" "http://localhost:9000"

endlocal
exit /b 0

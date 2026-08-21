@echo off
setlocal EnableExtensions
cd /d "%~dp0..\..\server" || (
  echo Could not find the server folder.
  pause
  exit /b 1
)

where php >nul 2>&1 || (
  echo php is not on PATH. Install PHP or add it to PATH.
  echo Or edit this file and replace "php" with the full path to php.exe.
  pause
  exit /b 1
)

REM Apply upload limits from server\php.ini without replacing the system php.ini.
REM Do not use php -c php.ini - that fragment would disable extensions such as pdo_pgsql.
php -d post_max_size=128M -d upload_max_filesize=64M -d max_file_uploads=50 -d memory_limit=256M -d max_execution_time=300 -d max_input_time=300 artisan serve --host=0.0.0.0 --port=8000
if errorlevel 1 (
  echo Laravel failed to start.
  pause
  exit /b 1
)
endlocal

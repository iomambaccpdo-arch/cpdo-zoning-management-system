@echo off
cd /d "%~dp0..\server" || exit /b 1
php artisan serve --host=0.0.0.0 --port=8000

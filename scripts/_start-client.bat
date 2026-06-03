@echo off
cd /d "%~dp0..\client" || exit /b 1
npm run dev

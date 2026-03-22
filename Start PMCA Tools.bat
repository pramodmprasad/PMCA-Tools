@echo off
cd /d "%~dp0"

REM Start server hidden (no window) and open browser
wscript.exe "%~dp0Start-PMCA-Server-Hidden.vbs"
timeout /t 2 /nobreak > nul
start "" "http://localhost:3000/"

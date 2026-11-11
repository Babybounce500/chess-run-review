@echo off
cd /d "%~dp0"
echo Starte Lc0-Server auf http://localhost:8791/ ...
start "" http://localhost:8791/
node lc0-server.js 8791
pause

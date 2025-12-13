@echo off
echo Starting OpenQode Web Server...
cd /d "E:\TRAE Playground\Test Ideas\OpenQode-v1.01-Preview"
npx kill-port 3000 >nul 2>&1
echo OpenQode Web Server is now running on http://localhost:3000
node server.js
pause
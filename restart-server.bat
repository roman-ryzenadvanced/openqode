@echo off
echo Killing any existing processes on port 3000...
npx kill-port 3000 >nul 2>&1

echo Starting OpenQode Web Server in background...
cd /d "E:\TRAE Playground\Test Ideas\OpenQode-v1.01-Preview"
start "OpenQode Server" cmd /c "node server.js ^& echo Server has stopped. Press any key to exit... ^& pause >nul"

echo.
echo OpenQode Web Server is now running on http://localhost:3000
echo Server is running in a separate minimized window.
echo.
pause
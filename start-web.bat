@echo off
echo ========================================
echo   OpenQode Web Interface Launcher
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if server.js exists
if not exist "%~dp0server.js" (
    echo ERROR: server.js not found!
    echo Make sure you're in the OpenQode directory.
    echo.
    pause
    exit /b 1
)

echo Starting OpenQode Web Server...
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Start the server
cd /d "%~dp0"
node server.js

pause
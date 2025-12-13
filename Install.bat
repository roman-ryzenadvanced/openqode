@echo off
title OpenQode v1.3 Installation
color 0B
echo.
echo ========================================================
echo   OpenQode v1.3 Alpha - Installation
echo   AI-Powered Coding Assistant with Qwen Integration
echo ========================================================
echo.

cd /d "%~dp0"

REM Check Node.js
echo [1/3] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo       Found: %%v

REM Install npm dependencies
echo.
echo [2/3] Installing dependencies...
echo       (This may take a minute...)
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERROR: npm install failed!
    echo Try running: npm install --legacy-peer-deps
    pause
    exit /b 1
)
echo       Done!

REM Check/Install Qwen CLI (optional)
echo.
echo [3/3] Checking Qwen CLI (optional)...
where qwen >nul 2>&1
if errorlevel 1 (
    echo       Qwen CLI not found (optional - Modern TUI doesn't need it)
    echo       To install: npm install -g @anthropic/qwen-code
) else (
    echo       Qwen CLI already installed!
)

echo.
echo ========================================================
echo   Installation Complete!
echo ========================================================
echo.
echo   To start OpenQode:
echo.
echo       OpenQode.bat
echo.
echo   Then select Option 5 for the Modern TUI!
echo.
echo ========================================================
echo.
pause

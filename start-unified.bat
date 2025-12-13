@echo off
title OpenQode Unified Startup

echo OpenQode Unified Startup v1.01
echo ===============================
echo.

REM Check if PowerShell is available
powershell -Command "Get-Command Get-Process" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell is required but not found.
    pause
    exit /b 1
)

REM Run the unified startup PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-unified.ps1"

echo.
echo OpenQode startup completed.
pause
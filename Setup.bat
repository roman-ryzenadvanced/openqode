@echo off
title OpenQode Setup
echo ========================================
echo   OpenQode v1.01 Preview - Setup
echo ========================================
echo.

echo [1/3] Checking Node.js dependencies...
if not exist "node_modules" (
    echo Dependencies not found. Installing...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies. Please install Node.js and try again.
        pause
        exit /b 1
    )
    echo Dependencies installed.
) else (
    echo Dependencies found. Skipping install.
)
echo.

echo [2/3] Checking Qwen CLI...
call npm list -g @anthropic/qwen-code >nul 2>&1
if errorlevel 1 (
    echo Qwen CLI not found globally. Installing...
    call npm install -g @anthropic/qwen-code
    if errorlevel 1 (
        echo [WARNING] Failed to install Qwen CLI. You may need to run as Administrator.
        echo Continuing anyway...
    ) else (
        echo Qwen CLI installed.
    )
) else (
    echo Qwen CLI found.
)
echo.

echo [3/3] Running Main Installer...
call Install.bat %*
echo.

echo Setup Complete! You can now run OpenQode.bat
pause

@echo off
TITLE OpenQode Classic TUI
CLS
ECHO ---------------------------------------------------
ECHO        OPENQODE CLASSIC TUI LAUNCHER (Gen 4)
ECHO ---------------------------------------------------
ECHO.

IF NOT EXIST "node_modules" (
    ECHO [INFO] First run detected! Installing dependencies...
    ECHO [INFO] This might take a minute...
    call npm install
    IF %ERRORLEVEL% NEQ 0 (
        ECHO [ERROR] Failed to install dependencies. Please install Node.js.
        PAUSE
        EXIT /B
    )
    ECHO [SUCCESS] Dependencies installed!
    ECHO.
)

ECHO [INFO] Starting Classic Interface...
ECHO.
node bin/opencode-tui.cjs
PAUSE

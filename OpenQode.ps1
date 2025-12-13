# OpenQode v1.01 Preview Edition - Main Launcher
# OpenCode + Qwen Integration Package

param(
    [string]$Model = "",
    [switch]$NoMenu = $false
)

$OpenQodeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BinaryPath = "$OpenQodeDir\bin\opencode.exe"
$LauncherPath = "$OpenQodeDir\scripts\opencode-launcher.ps1"

# Ensure OpenCode binary exists (auto-download if missing)
if (-not (Test-Path $BinaryPath)) {
    Write-Host "OpenCode binary not found at: $BinaryPath" -ForegroundColor Yellow
    Write-Host "Attempting to download OpenCode automatically..." -ForegroundColor Cyan

    $DownloadScript = Join-Path $OpenQodeDir "scripts\\download-opencode.ps1"
    if (Test-Path $DownloadScript) {
        try {
            & $DownloadScript -NonInteractive
        } catch {
            Write-Host "[ERROR] Failed to download OpenCode binary automatically." -ForegroundColor Red
            Write-Host "Run .\\scripts\\download-opencode.ps1 manually or download from:" -ForegroundColor Yellow
            Write-Host "https://github.com/sst/opencode/releases" -ForegroundColor White
            exit 1
        }
    } else {
        Write-Host "[ERROR] Download script missing. Please download opencode.exe manually from:" -ForegroundColor Red
        Write-Host "https://github.com/sst/opencode/releases" -ForegroundColor White
        exit 1
    }
}

# Display header
Write-Host "OpenQode v1.01 Preview Edition" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "OpenCode + Qwen Integration" -ForegroundColor Gray
Write-Host ""

# Always launch TUI by default
if (-not $Model) {
    $Model = "qwen/coder-model"
}

Write-Host "Launching TUI with model: $Model" -ForegroundColor Green

# Handle Qwen authentication if needed
if ($Model -like "qwen/*") {
    Write-Host "Checking Qwen authentication..." -ForegroundColor Cyan
    try {
        $authCheck = & $BinaryPath auth list 2>$null
        if ($authCheck -notmatch "qwen") {
            Write-Host "Opening browser for Qwen authentication..." -ForegroundColor Yellow
            Write-Host "If browser doesn't open automatically, please visit: https://qwen.ai" -ForegroundColor Cyan
            & $BinaryPath auth login qwen
            Write-Host "Please complete authentication in browser, then press Enter to continue..."
            Read-Host
        } else {
            Write-Host "Already authenticated with Qwen!" -ForegroundColor Green
            Write-Host "To re-authenticate, run: .\bin\opencode.exe auth logout qwen" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Could not check authentication status" -ForegroundColor Yellow
        Write-Host "Manual authentication: .\bin\opencode.exe auth login qwen" -ForegroundColor Cyan
    }
}

Write-Host "Starting OpenCode TUI..." -ForegroundColor Green
& $BinaryPath -m $Model

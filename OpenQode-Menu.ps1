# OpenQode v1.01 Preview Edition - Model Selection Menu
# Use this when you want to choose a different model

param(
    [string]$Model = ""
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
            Write-Host "Failed to download OpenCode binary automatically." -ForegroundColor Red
            Write-Host "Run .\\scripts\\download-opencode.ps1 manually or download from:" -ForegroundColor Yellow
            Write-Host "https://github.com/sst/opencode/releases" -ForegroundColor White
        }
    } else {
        Write-Host "Download script missing. Please download opencode.exe manually from:" -ForegroundColor Red
        Write-Host "https://github.com/sst/opencode/releases" -ForegroundColor White
    }
}

# Check if binary exists
if (-not (Test-Path $BinaryPath)) {
    Write-Host "❌ OpenCode binary not found at: $BinaryPath" -ForegroundColor Red
    Write-Host "Please reinstall OpenQode package." -ForegroundColor Yellow
    exit 1
}

# Display header
Write-Host "🚀 OpenQode v1.01 Preview Edition - Model Menu" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Choose your AI model:" -ForegroundColor Gray
Write-Host ""

if ($Model) {
    # Direct launch with specified model
    Write-Host "🎯 Launching TUI with model: $Model" -ForegroundColor Green
    
    # Handle Qwen authentication if needed
    if ($Model -like "qwen/*") {
        Write-Host "🔐 Checking Qwen authentication..." -ForegroundColor Cyan
        try {
            $authCheck = & $BinaryPath auth list 2>$null
            if ($authCheck -notmatch "qwen") {
                Write-Host "🌐 Opening browser for Qwen authentication..." -ForegroundColor Yellow
                & $BinaryPath auth qwen
                Write-Host "Please complete authentication in browser, then press Enter to continue..."
                Read-Host
            } else {
                Write-Host "✅ Already authenticated with Qwen!" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️ Could not check authentication status" -ForegroundColor Yellow
        }
    }
    
    Write-Host "🚀 Starting OpenQode TUI..." -ForegroundColor Green
    & $BinaryPath -m $Model
} else {
    # Interactive menu
    & powershell -ExecutionPolicy Bypass -File $LauncherPath
}

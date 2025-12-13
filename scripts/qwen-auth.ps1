# Qwen Authentication Helper
param([switch]$Force = $false)

$OpenQodeDir = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path
$BinaryPath = "$OpenQodeDir\bin\opencode.exe"

Write-Host "Qwen Authentication Helper" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

if ($Force) {
    Write-Host "Logging out from Qwen first..." -ForegroundColor Yellow
    & $BinaryPath auth logout
}

Write-Host "Opening Qwen authentication..." -ForegroundColor Green
Write-Host "If browser doesn't open, visit: https://qwen.ai" -ForegroundColor Cyan

# Try to open browser
try {
    Start-Process "https://qwen.ai"
    Write-Host "Browser opened successfully!" -ForegroundColor Green
} catch {
    Write-Host "Could not open browser automatically" -ForegroundColor Yellow
    Write-Host "Please manually visit: https://qwen.ai" -ForegroundColor Cyan
}

Write-Host "`nRunning authentication command..." -ForegroundColor Yellow
& $BinaryPath auth login qwen

Write-Host "`nAuthentication process completed!" -ForegroundColor Green
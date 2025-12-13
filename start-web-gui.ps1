# OpenQode Web GUI Launcher with Authentication Check
# This script starts the web server and handles authentication if needed

$OpenQodeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerPath = "$OpenQodeDir\server.js"

Write-Host "OpenQode Web GUI v1.01" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Ask user for port
$Port = Read-Host "Enter port for Web GUI (default: 3000)"
if ([string]::IsNullOrWhiteSpace($Port)) {
    $Port = 3000
} elseif (-not [int]::TryParse($Port, [ref][int]$null)) {
    Write-Host "Invalid port number. Using default port 3000." -ForegroundColor Yellow
    $Port = 3000
}

Write-Host "Starting web server on port $Port..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is available
try {
    node --version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js not found"
    }
} catch {
    Write-Host "[ERROR] Node.js is required but not found." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

# Start the server in a background job
$ServerJob = Start-Job -ScriptBlock {
    param($ServerPath)
    Set-Location (Split-Path $ServerPath -Parent)
    node $ServerPath
} -ArgumentList $ServerPath

Write-Host "Web server starting in background..." -ForegroundColor Yellow
Write-Host "Opening browser at http://localhost:$Port" -ForegroundColor Green
Write-Host ""

# Wait a bit for server to start, then open browser
Start-Sleep -Seconds 3

try {
    # Open the browser
    Start-Process "http://localhost:$Port"
    
    Write-Host "Browser opened. The Web GUI will guide you through authentication if needed." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C in this window to stop the server." -ForegroundColor Gray
    Write-Host ""
    
    # Wait for the server job (this will block until the job is stopped)
    Wait-Job $ServerJob
} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
}

# Clean up the job
if ($ServerJob) {
    Stop-Job $ServerJob -ErrorAction SilentlyContinue
    Remove-Job $ServerJob -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "OpenQode Web Server stopped." -ForegroundColor Cyan
# OpenQode Web Server Startup Script
# This script starts the OpenQode web interface

Write-Host "🚀 Starting OpenQode Web Interface..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if we're in the correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json not found. Please run this script from the OpenQode directory." -ForegroundColor Red
    exit 1
}

# Check if node_modules exists, if not install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
}

# Check if web directory exists
if (-not (Test-Path "web")) {
    Write-Host "❌ Web directory not found" -ForegroundColor Red
    exit 1
}

# Start the server
Write-Host "🌐 Starting web server..." -ForegroundColor Yellow
Write-Host "📍 Server will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start the server and keep it running
try {
    node server.js
} catch {
    Write-Host "❌ Failed to start server" -ForegroundColor Red
    exit 1
}
# OpenQode Unified Startup Script
# Starts both frontend and backend with proper instance management

param(
    [int]$Port = 0
)

# Function to check and kill existing OpenQode processes
function Stop-ExistingInstances {
    Write-Host "Checking for existing OpenQode processes..." -ForegroundColor Yellow
    
    # Get all node processes and check if they're running OpenQode server.js
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        foreach ($proc in $nodeProcesses) {
            try {
                $cmdLine = $proc.CommandLine
                if ($cmdLine -and $cmdLine -like "*server.js*") {
                    Stop-Process -Id $proc.Id -Force
                    Write-Host "Stopped process ID: $($proc.Id)" -ForegroundColor Green
                }
            } catch {
                # Process might already be stopped
            }
        }
    }
}

# Function to find a free port
function Get-FreePort {
    param([int]$StartPort = 3000)
    
    $port = $StartPort
    while ($port -le 65535) {
        $portOpen = $false
        try {
            $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
            $listener.Start()
            $listener.Stop()
        } catch {
            $portOpen = $true
        }
        
        if (-not $portOpen) {
            return $port
        }
        $port++
    }
    return 3000  # Default fallback
}

# Main script starts here
$OpenQodeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerPath = Join-Path $OpenQodeDir "server.js"

Write-Host "OpenQode Unified Startup v1.01" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

if ($Port -eq 0) {
    $PortInput = Read-Host "Enter port for Web GUI (default: 3000, or press Enter for auto)"
    if ([string]::IsNullOrWhiteSpace($PortInput)) {
        $Port = 3000
        Write-Host "Using default port: $Port" -ForegroundColor Yellow
    } elseif (-not [int]::TryParse($PortInput, [ref][int]$null)) {
        Write-Host "Invalid port number. Using default port 3000." -ForegroundColor Yellow
        $Port = 3000
    } else {
        $Port = [int]$PortInput
    }
}

# Check if port is available
$FreePort = Get-FreePort $Port
if ($FreePort -ne $Port) {
    Write-Host "Port $Port is already in use. Using available port: $FreePort" -ForegroundColor Yellow
    $Port = $FreePort
} else {
    Write-Host "Using port: $Port" -ForegroundColor Green
}

# Stop existing instances
Stop-ExistingInstances

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

Write-Host ""
Write-Host "Starting OpenQode backend server on port $Port..." -ForegroundColor Green

# Start the server in a background job
$ServerJob = Start-Job -ScriptBlock {
    param($ServerPath, $Port)
    Set-Location (Split-Path $ServerPath -Parent)
    node $ServerPath $Port
} -ArgumentList $ServerPath, $Port

# Wait a moment for server to start
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verify server is running
$ServerRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port" -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    $ServerRunning = $true
    Write-Host "Server is running and responding!" -ForegroundColor Green
} catch {
    Write-Host "Server might still be starting up, continuing..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    $ServerRunning = $true  # Assume it's starting up
}

if ($ServerRunning) {
    $Url = "http://localhost:$Port"
    Write-Host "Opening OpenQode Web Interface at: $Url" -ForegroundColor Green
    Start-Process $Url
    
    Write-Host ""
    Write-Host "OpenQode is now running!" -ForegroundColor Cyan
    Write-Host "Backend: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "Frontend: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl+C in this window to stop the server." -ForegroundColor Gray
    Write-Host "Server PID: $($ServerJob.Id)" -ForegroundColor Gray
    Write-Host ""
    
    try {
        # Wait for the server job (this will block until the job is stopped)
        Wait-Job $ServerJob
    } catch {
        Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Server failed to start properly." -ForegroundColor Red
}

# Cleanup
if ($ServerJob) {
    Stop-Job $ServerJob -ErrorAction SilentlyContinue
    Remove-Job $ServerJob -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "OpenQode server stopped." -ForegroundColor Cyan
Write-Host "Goodbye!" -ForegroundColor Green
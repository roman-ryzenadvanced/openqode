# OpenCode Binary Download Script
# Downloads the required opencode.exe binary for OpenQode

param(
    [string]$BinaryUrl = "https://github.com/sst/opencode/releases/latest/download/opencode-windows-x64.exe",
    [string]$BinaryPath = "",
    [switch]$Force = $false,
    [switch]$NonInteractive = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OpenQodeDir = Split-Path -Parent $ScriptDir

if (-not $BinaryPath) {
    $BinaryPath = Join-Path $OpenQodeDir "bin\\opencode.exe"
}

# Back-compat variable names used below
$binaryUrl = $BinaryUrl
$binaryPath = $BinaryPath

Write-Host "OpenQode - Downloading OpenCode Binary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Create bin directory if it doesn't exist
$BinDir = Split-Path -Parent $BinaryPath
if (-not (Test-Path $BinDir)) {
    Write-Host "Creating bin directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

# Check if binary already exists
if (Test-Path $BinaryPath) {
    if (-not $Force) {
        Write-Host "opencode.exe already exists at: $BinaryPath" -ForegroundColor Yellow
        Write-Host "Skipping download." -ForegroundColor Gray
        return
    }

    if (-not $NonInteractive) {
        $overwrite = Read-Host "opencode.exe already exists. Overwrite? (y/N)"
        if ($overwrite -ne "y" -and $overwrite -ne "Y") {
            Write-Host "Download cancelled." -ForegroundColor Yellow
            return
        }
    } else {
        Write-Host "Overwriting existing opencode.exe..." -ForegroundColor Yellow
    }
}

Write-Host "Downloading OpenCode binary..." -ForegroundColor Green
Write-Host "URL: $binaryUrl" -ForegroundColor Gray

try {
    # Download the file
    Invoke-WebRequest -Uri $BinaryUrl -OutFile $BinaryPath -UseBasicParsing

    if (-not (Test-Path $BinaryPath)) {
        throw "Binary not found after download"
    }

    $fileSize = (Get-Item $BinaryPath).Length / 1MB
    Write-Host "Download completed successfully!" -ForegroundColor Green
    Write-Host "File size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor White
    Write-Host "Location: $BinaryPath" -ForegroundColor White
    Write-Host ""
    Write-Host "You can now run OpenQode using:" -ForegroundColor Cyan
    Write-Host "  .\\OpenQode.bat" -ForegroundColor White
    Write-Host "  .\\OpenQode.ps1" -ForegroundColor White

    if (-not $NonInteractive) {
        Write-Host ""
        Write-Host "Press any key to exit..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    return
    
    if (Test-Path $binaryPath) {
        $fileSize = (Get-Item $binaryPath).Length / 1MB
        Write-Host "✅ Download completed successfully!" -ForegroundColor Green
        Write-Host "File size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor White
        Write-Host "Location: $binaryPath" -ForegroundColor White
        Write-Host ""
        Write-Host "You can now run OpenQode using:" -ForegroundColor Cyan
        Write-Host "  .\OpenQode.bat" -ForegroundColor White
        Write-Host "  .\OpenQode.ps1" -ForegroundColor White
    } else {
        Write-Host "❌ Download failed - file not found after download" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Download failed:" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Download manually from:" -ForegroundColor Yellow
    Write-Host "https://github.com/sst/opencode/releases" -ForegroundColor White
    if (-not $NonInteractive) {
        Write-Host ""
        Write-Host "Press any key to exit..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    throw
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

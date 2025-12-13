# Clean PowerShell Profile
$profilePath = $PROFILE

Write-Host "Cleaning PowerShell profile..." -ForegroundColor Cyan

if (Test-Path $profilePath) {
    # Backup current profile
    $backupPath = "$profilePath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $profilePath $backupPath
    Write-Host "Backed up profile to: $backupPath" -ForegroundColor Green
    
    # Create clean profile
    $cleanContent = @"

# OpenQode v1.01 Preview Edition
function OpenQode {
    param([string]$Model = "")
    & "E:\TRAE Playground\Test Ideas\OpenQode-v1.01-Preview\OpenQode.ps1" -Model $Model
}

function OpenQode-Menu {
    param([string]$Model = "")
    & "E:\TRAE Playground\Test Ideas\OpenQode-v1.01-Preview\OpenQode-Menu.ps1" -Model $Model
}
"@
    
    Set-Content $profilePath $cleanContent
    
    Write-Host "Fixed PowerShell profile" -ForegroundColor Green
    Write-Host "Restart PowerShell to apply changes" -ForegroundColor Yellow
} else {
    Write-Host "No PowerShell profile found" -ForegroundColor Yellow
}
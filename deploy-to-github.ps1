# OpenQode GitHub Deployment Script
# This script will help you deploy OpenQode to GitHub

Write-Host "OpenQode v1.01 Preview - GitHub Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path ".git")) {
    Write-Host "Error: Not in a git repository!" -ForegroundColor Red
    Write-Host "Please run this script from the OpenQode-v1.01-Preview directory" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Create a new repository on GitHub" -ForegroundColor Yellow
Write-Host "1. Go to https://github.com and sign in" -ForegroundColor White
Write-Host "2. Click the '+' button in the top right and select 'New repository'" -ForegroundColor White
Write-Host "3. Name your repository: OpenQode" -ForegroundColor White
Write-Host "4. Add description: 'OpenQode v1.01 Preview - OpenCode + Qwen Integration'" -ForegroundColor White
Write-Host "5. Choose Public or Private (Public recommended)" -ForegroundColor White
Write-Host "6. DO NOT initialize with README, .gitignore, or license (we already have these)" -ForegroundColor White
Write-Host "7. Click 'Create repository'" -ForegroundColor White
Write-Host ""

Write-Host "Step 2: Copy your repository URL" -ForegroundColor Yellow
Write-Host "After creating the repository, GitHub will show you a quick setup page" -ForegroundColor White
Write-Host "Copy the HTTPS URL (it looks like: https://github.com/yourusername/OpenQode.git)" -ForegroundColor White
Write-Host ""

# Get the repository URL from user
$repoUrl = Read-Host "Enter your GitHub repository URL (HTTPS)"

if (-not $repoUrl) {
    Write-Host "Error: Repository URL is required!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Pushing to GitHub..." -ForegroundColor Yellow

# Add remote origin
Write-Host "Adding remote origin..." -ForegroundColor Green
git remote add origin $repoUrl

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Green
git push -u origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 Success! OpenQode has been deployed to GitHub!" -ForegroundColor Green
    Write-Host "Repository URL: $repoUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "What's included:" -ForegroundColor White
    Write-Host "- Complete OpenQode v1.01 Preview Edition" -ForegroundColor White
    Write-Host "- Qwen OAuth integration (2,000 free daily requests)" -ForegroundColor White
    Write-Host "- TUI-first interface" -ForegroundColor White
    Write-Host "- One-click launcher (OpenQode.bat)" -ForegroundColor White
    Write-Host "- Installation scripts and documentation" -ForegroundColor White
    Write-Host ""
    Write-Host "Security:" -ForegroundColor White
    Write-Host "- ✅ No API keys included" -ForegroundColor White
    Write-Host "- ✅ Sensitive files excluded via .gitignore" -ForegroundColor White
    Write-Host "- ✅ Safe for public repository" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Error: Failed to push to GitHub" -ForegroundColor Red
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. Your repository URL is correct" -ForegroundColor Yellow
    Write-Host "2. You have authentication set up with GitHub" -ForegroundColor Yellow
    Write-Host "3. Your repository name matches the URL" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
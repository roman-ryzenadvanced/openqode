# OpenCode Interactive Launcher with Model Selection and Agent Manager

# Clear screen for better UX
Clear-Host

# Resolve OpenQode paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OpenQodeDir = Split-Path -Parent $ScriptDir
$BinaryPath = Join-Path $OpenQodeDir "bin\\opencode.exe"
$AgentDir = Join-Path $OpenQodeDir ".opencode\\agent"
$DownloadScript = Join-Path $OpenQodeDir "scripts\\download-opencode.ps1"

# Ensure OpenCode binary exists (auto-download if missing)
if (-not (Test-Path $BinaryPath)) {
    Write-Host "OpenCode binary not found at: $BinaryPath" -ForegroundColor Yellow
    Write-Host "Attempting to download OpenCode automatically..." -ForegroundColor Cyan

    if (Test-Path $DownloadScript) {
        try {
            & $DownloadScript -NonInteractive
        } catch {
            Write-Host "Failed to download OpenCode binary automatically." -ForegroundColor Red
            Write-Host "Run .\\scripts\\download-opencode.ps1 manually or download from:" -ForegroundColor Yellow
            Write-Host "https://github.com/sst/opencode/releases" -ForegroundColor White
            exit 1
        }
    } else {
        Write-Host "Download script missing. Please download opencode.exe manually from:" -ForegroundColor Red
        Write-Host "https://github.com/sst/opencode/releases" -ForegroundColor White
        exit 1
    }
}

# Ensure agent directory exists
if (-not (Test-Path $AgentDir)) {
    New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null
}

function Show-MainMenu {
    Clear-Host
    Write-Host "🤖 OpenQode v1.01 - Main Menu" -ForegroundColor Cyan
    Write-Host "==============================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 🚀 Launch TUI (Select Model)" -ForegroundColor Green
    Write-Host "2. 🤖 Agent Manager" -ForegroundColor Yellow
    Write-Host "3. 🌐 Web Assist Dashboard" -ForegroundColor Magenta
    Write-Host "4. ❌ Exit" -ForegroundColor Red
    Write-Host ""
    
    $choice = Read-Host "Enter your choice (1-4)"
    return $choice
}

function Show-ModelMenu {
    Clear-Host
    Write-Host "🎯 Select AI Model" -ForegroundColor Cyan
    Write-Host "==================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Qwen Coder Model (Free - 2,000 req/day)" -ForegroundColor Green
    Write-Host "2. Qwen Vision Model (Free - 2,000 req/day)" -ForegroundColor Green
    Write-Host "3. OpenCode Big Pickle (Default)" -ForegroundColor Yellow
    Write-Host "4. OpenCode GPT-5 Nano" -ForegroundColor Yellow
    Write-Host "5. Grok Code" -ForegroundColor Yellow
    Write-Host "6. ← Back to Main Menu" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "Enter your choice (1-6)"
    return $choice
}

function Show-AgentManager {
    Clear-Host
    Write-Host "🤖 Agent Manager" -ForegroundColor Cyan
    Write-Host "=================" -ForegroundColor Cyan
    Write-Host ""
    
    # List existing agents
    $agents = Get-ChildItem -Path $AgentDir -Filter "*.md" -ErrorAction SilentlyContinue
    
    if ($agents.Count -gt 0) {
        Write-Host "📋 Current Agents:" -ForegroundColor Yellow
        $i = 1
        foreach ($agent in $agents) {
            $name = [System.IO.Path]::GetFileNameWithoutExtension($agent.Name)
            Write-Host "   $i. $name" -ForegroundColor White
            $i++
        }
        Write-Host ""
    } else {
        Write-Host "📋 No custom agents found." -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "1. ➕ Create New Agent" -ForegroundColor Green
    Write-Host "2. 📝 Edit Agent" -ForegroundColor Yellow
    Write-Host "3. 🗑️  Delete Agent" -ForegroundColor Red
    Write-Host "4. ← Back to Main Menu" -ForegroundColor Gray
    Write-Host ""
    
    $choice = Read-Host "Enter your choice (1-4)"
    return $choice
}

function Create-Agent {
    Clear-Host
    Write-Host "➕ Create New Agent" -ForegroundColor Cyan
    Write-Host "===================" -ForegroundColor Cyan
    Write-Host ""
    
    $name = Read-Host "Agent name (e.g., 'security', 'optimize')"
    if (-not $name) {
        Write-Host "❌ Name cannot be empty" -ForegroundColor Red
        Start-Sleep -Seconds 2
        return
    }
    
    # Sanitize name
    $name = $name.ToLower() -replace '[^a-z0-9_-]', ''
    $agentPath = Join-Path $AgentDir "$name.md"
    
    if (Test-Path $agentPath) {
        Write-Host "❌ Agent '$name' already exists" -ForegroundColor Red
        Start-Sleep -Seconds 2
        return
    }
    
    Write-Host ""
    Write-Host "Describe what this agent should do:" -ForegroundColor Yellow
    Write-Host "(Enter your prompt, then type 'END' on a new line to finish)"
    Write-Host ""
    
    $promptLines = @()
    while ($true) {
        $line = Read-Host
        if ($line -eq "END") { break }
        $promptLines += $line
    }
    
    $prompt = $promptLines -join "`n"
    
    # Create agent file
    $content = @"
# $($name.Substring(0,1).ToUpper() + $name.Substring(1)) Agent

$prompt
"@
    
    Set-Content -Path $agentPath -Value $content -Encoding UTF8
    
    Write-Host ""
    Write-Host "✅ Agent '$name' created successfully!" -ForegroundColor Green
    Write-Host "File: $agentPath" -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

function Edit-Agent {
    $agents = Get-ChildItem -Path $AgentDir -Filter "*.md" -ErrorAction SilentlyContinue
    if ($agents.Count -eq 0) {
        Write-Host "❌ No agents to edit" -ForegroundColor Red
        Start-Sleep -Seconds 2
        return
    }
    
    Write-Host ""
    Write-Host "Select agent to edit:" -ForegroundColor Yellow
    $i = 1
    foreach ($agent in $agents) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($agent.Name)
        Write-Host "$i. $name" -ForegroundColor White
        $i++
    }
    
    $choice = Read-Host "Enter number"
    $index = [int]$choice - 1
    
    if ($index -ge 0 -and $index -lt $agents.Count) {
        $agentPath = $agents[$index].FullName
        notepad $agentPath
        Write-Host "✅ Opening in Notepad..." -ForegroundColor Green
    }
}

function Delete-Agent {
    $agents = Get-ChildItem -Path $AgentDir -Filter "*.md" -ErrorAction SilentlyContinue
    if ($agents.Count -eq 0) {
        Write-Host "❌ No agents to delete" -ForegroundColor Red
        Start-Sleep -Seconds 2
        return
    }
    
    Write-Host ""
    Write-Host "Select agent to delete:" -ForegroundColor Yellow
    $i = 1
    foreach ($agent in $agents) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($agent.Name)
        Write-Host "$i. $name" -ForegroundColor White
        $i++
    }
    
    $choice = Read-Host "Enter number"
    $index = [int]$choice - 1
    
    if ($index -ge 0 -and $index -lt $agents.Count) {
        $agentPath = $agents[$index].FullName
        $agentName = [System.IO.Path]::GetFileNameWithoutExtension($agents[$index].Name)
        
        $confirm = Read-Host "Delete '$agentName'? (y/n)"
        if ($confirm -eq 'y') {
            Remove-Item $agentPath -Force
            Write-Host "✅ Agent deleted" -ForegroundColor Green
        }
    }
    Start-Sleep -Seconds 1
}

function Launch-Model($modelChoice) {
    switch ($modelChoice) {
        "1" { 
            $model = "qwen/coder-model"
            Write-Host "`n🔐 Checking Qwen authentication..." -ForegroundColor Cyan
            try {
                $authCheck = & $BinaryPath auth list 2>$null
                if ($authCheck -match "qwen") {
                    Write-Host "✅ Already authenticated!" -ForegroundColor Green
                } else {
                    Write-Host "🌐 Opening browser for Qwen authentication..." -ForegroundColor Yellow
                    & $BinaryPath auth qwen
                    Read-Host "Press Enter after completing browser auth..."
                }
            } catch {}
        }
        "2" { 
            $model = "qwen/vision-model"
            Write-Host "`n🔐 Checking Qwen authentication..." -ForegroundColor Cyan
            try {
                $authCheck = & $BinaryPath auth list 2>$null
                if ($authCheck -match "qwen") {
                    Write-Host "✅ Already authenticated!" -ForegroundColor Green
                } else {
                    Write-Host "🌐 Opening browser for auth..." -ForegroundColor Yellow
                    & $BinaryPath auth qwen
                    Read-Host "Press Enter after completing browser auth..."
                }
            } catch {}
        }
        "3" { $model = "opencode/big-pickle" }
        "4" { $model = "opencode/gpt-5-nano" }
        "5" { $model = "opencode/grok-code" }
        default { return }
    }
    
    Write-Host "`n🚀 Launching with: $model" -ForegroundColor Green
    Start-Sleep -Seconds 1
    & $BinaryPath -m $model
}

# Main loop
while ($true) {
    $mainChoice = Show-MainMenu
    
    switch ($mainChoice) {
        "1" {
            $modelChoice = Show-ModelMenu
            if ($modelChoice -ne "6") {
                Launch-Model $modelChoice
            }
        }
        "2" {
            while ($true) {
                $agentChoice = Show-AgentManager
                switch ($agentChoice) {
                    "1" { Create-Agent }
                    "2" { Edit-Agent }
                    "3" { Delete-Agent }
                    "4" { break }
                }
                if ($agentChoice -eq "4") { break }
            }
        }
        "3" {
            Write-Host "`n🌐 Opening Web Assist Dashboard..." -ForegroundColor Cyan
            Start-Process "http://127.0.0.1:15044/assist/"
            Start-Sleep -Seconds 2
        }
        "4" {
            Write-Host "`n👋 Goodbye!" -ForegroundColor Cyan
            exit 0
        }
    }
}

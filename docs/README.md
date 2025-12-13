# OpenQode v1.01 Preview Edition

**OpenCode + Qwen Integration Package**

OpenQode is a powerful integration of OpenCode with Qwen AI models, providing free access to advanced coding capabilities.

## Features

### Multiple AI Models
- Qwen Coder Model - Free 2,000 requests/day, 60 RPM
- Qwen Vision Model - Free 2,000 requests/day, 60 RPM  
- OpenCode Big Pickle - Default OpenCode model
- OpenCode GPT-5 Nano - Experimental model
- Grok Code - Grok coding model

### Automatic Authentication
- Browser-based OAuth authentication for Qwen models
- Automatic credential management and refresh
- One-time setup, persistent access

### 🔐 Qwen Authentication

When you select a Qwen model, OpenQode will automatically:
1. Check if you're authenticated with Qwen
2. Initiate OAuth authentication if needed
3. Complete the OAuth flow (may happen in background)
4. Store credentials for automatic refresh

**Authentication Notes:**
- 🌐 Browser may open automatically, or authentication may complete in background
- 🔑 If browser doesn't open, visit: https://qwen.ai
- 📱 Use `./scripts/qwen-auth.ps1` for manual authentication
- 🔄 Use `./bin/opencode.exe auth logout qwen` to reset authentication

**Qwen OAuth Benefits:**
- ✅ 2,000 free requests per day
- ✅ No token limits  
- ✅ 60 requests per minute rate limit
- ✅ Automatic credential refresh

### Enhanced Features
- Lakeview Mode - Concise, minimal output
- Sequential Thinking - Structured problem-solving
- TUI Interface - Terminal-based interaction

## Quick Start

### Option 1: TUI Default (Recommended)
```powershell
.\OpenQode.ps1
```
This will automatically launch the Terminal UI with Qwen Coder model.

### Installation (PowerShell or Batch)
If you cloned this repo without `bin/opencode.exe`, OpenQode will auto-download it during install or first run.

```powershell
.\Install.ps1
```

Or the batch alternative:
```bat
Install.bat
REM For system-wide PATH (run as Administrator):
Install.bat --systemwide
```

### Option 2: Model Selection Menu
```powershell
.\OpenQode-Menu.ps1
```
This will show a menu to choose your AI model.

### Option 3: Direct Launch with Specific Model
```powershell
# Launch with Qwen Coder (default)
.\OpenQode.ps1 -Model "qwen/coder-model"

# Launch with specific model
.\OpenQode.ps1 -Model "opencode/big-pickle"
```

### Option 4: Double-Click TUI
Simply double-click `OpenQode.bat` in Windows Explorer to start TUI immediately.

## First Time Setup

1. Run OpenQode and choose a Qwen model (option 1 or 2)
2. Your browser will open automatically
3. Complete authentication on qwen.ai
4. Return to terminal and press Enter
5. Enjoy free AI coding!

Note: If `bin/opencode.exe` is not present (for example, when cloning from GitHub), OpenQode will auto-download it during `Install.ps1` or on first run of `OpenQode.ps1`. You can also download it manually with `.\scripts\download-opencode.ps1`.

## Model Details

### Qwen Models (Free)
- 2,000 requests per day
- 60 requests per minute
- No token limits
- Automatic credential refresh

### OpenCode Models
- No authentication required
- Standard OpenCode features

## File Structure

```
OpenQode-v1.01-Preview/
  (Note: `bin/opencode.exe` is auto-downloaded if missing)
├── OpenQode.ps1          # Main TUI launcher (default)
├── OpenQode-Menu.ps1     # Model selection menu
├── OpenQode.bat          # Windows batch TUI launcher
├── Install.ps1           # Installation script
├── PACKAGE_INFO.txt      # Package summary
├── bin/
│   └── opencode.exe      # OpenCode binary
├── scripts/
│   ├── opencode-launcher.ps1
│   └── opencode-interactive.ps1
└── docs/
    └── README.md         # This file
```

## Troubleshooting

### Authentication Issues
```powershell
# Re-authenticate with Qwen
.\bin\opencode.exe auth qwen
```

### Check Authentication Status
```powershell
# List all authenticated providers
.\bin\opencode.exe auth list
```

### Model Switching
Run OpenQode again and choose a different model from the menu.

## System Requirements

- Windows 10/11
- PowerShell 5.1 or later
- Internet connection for Qwen authentication

## Version Information

- Version: 1.01 Preview Edition
- Release Date: December 2024
- Components: OpenCode + Qwen Integration

## Support

For issues and updates, check the original repositories:
- OpenCode: https://github.com/sst/opencode
- Qwen Code: https://github.com/QwenLM/qwen-code

---

**OpenQode v1.01 Preview Edition**  
*Powerful AI Coding, Free for Everyone*

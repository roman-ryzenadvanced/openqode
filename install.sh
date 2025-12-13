#!/bin/bash
# OpenQode v1.3 Installation Script for Linux/Mac

echo ""
echo "========================================================"
echo "  OpenQode v1.3 Alpha - Installation"
echo "  AI-Powered Coding Assistant with Qwen Integration"
echo "========================================================"
echo ""

cd "$(dirname "$0")"

# Check Node.js
echo "[1/3] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "ERROR: Node.js is not installed!"
    echo ""
    echo "Install Node.js:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  macOS: brew install node"
    echo "  Or download from: https://nodejs.org/"
    echo ""
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 20 ]; then
    echo ""
    echo -e "\033[0;33mWARNING: Node.js v20+ is recommended! You have v${NODE_VERSION}.\033[0m"
    echo "Some features may not work correctly."
    echo ""
fi
echo "       Found: $(node --version)"

# Install npm dependencies
echo ""
echo "[2/3] Installing dependencies..."
echo "       (This may take a minute...)"
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    echo "ERROR: npm install failed!"
    echo "Try: npm install --legacy-peer-deps"
    exit 1
fi
echo "       Done!"

# Check Qwen CLI (optional)
echo ""
echo "[3/3] Checking Qwen CLI (optional)..."
if ! command -v qwen &> /dev/null; then
    echo "       Qwen CLI not found (optional - Modern TUI doesn't need it)"
    echo "       To install: npm install -g @anthropic/qwen-code"
else
    echo "       Qwen CLI already installed!"
fi

# Ensure scripts are executable
chmod +x OpenQode.sh start.sh 2>/dev/null

echo ""
echo "========================================================"
echo -e "\033[1;32m  Installation Complete! \033[0m"
echo "========================================================"
echo ""
echo "  To start OpenQode:"
echo ""
echo -e "    \033[1;36m./OpenQode.sh\033[0m"
echo ""
echo "  Then select Option 5 for the Modern TUI!"
echo ""
echo "========================================================"
echo ""

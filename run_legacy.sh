#!/bin/bash
echo "---------------------------------------------------"
echo "       OPENQODE CLASSIC TUI LAUNCHER (Gen 4)"
echo "---------------------------------------------------"
echo ""

if [ ! -d "node_modules" ]; then
    echo "[INFO] First run detected! Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies. Please install Node.js."
        exit 1
    fi
    echo "[SUCCESS] Dependencies installed!"
    echo ""
fi

echo "[INFO] Starting Classic Interface..."
echo ""
node bin/opencode-tui.cjs

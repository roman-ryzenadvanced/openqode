#!/bin/bash
echo "---------------------------------------------------"
echo "       OPENQODE NEXT-GEN TUI LAUNCHER"
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

echo "[INFO] Starting Next-Gen Interface..."
echo ""
node bin/opencode-ink.mjs

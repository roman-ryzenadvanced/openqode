#!/bin/bash
# OpenQode Start Script for Linux/Mac

echo "Starting OpenQode..."
cd "$(dirname "$0")"

# Start the server
node server.js 15044 &
SERVER_PID=$!

echo "Server started on http://localhost:15044"
echo "Opening browser..."

# Open browser (works on Linux and Mac)
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:15044
elif command -v open &> /dev/null; then
    open http://localhost:15044
fi

echo "Press Ctrl+C to stop the server"
wait $SERVER_PID

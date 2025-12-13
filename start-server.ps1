Write-Host "Starting OpenQode Web Server..." -ForegroundColor Green
Set-Location "E:\TRAE Playground\Test Ideas\OpenQode-v1.01-Preview"

# Kill any existing process on port 3000
npx kill-port 3000 2>$null

Write-Host "OpenQode Web Server is now running on http://localhost:3000" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan

# Start the server
node server.js
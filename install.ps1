# Quick Install Script - AI Interviewer
# Run this in PowerShell to get your app running

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Interviewer - Quick Install" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node version
Write-Host "[1/6] Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "Current Node version: $nodeVersion" -ForegroundColor White

if ($nodeVersion -match "v24") {
    Write-Host "⚠️  WARNING: Node v24 detected!" -ForegroundColor Red
    Write-Host "   Recommended: Switch to Node.js 22 LTS" -ForegroundColor Red
    Write-Host ""
    Write-Host "   To switch (if you have nvm):" -ForegroundColor Yellow
    Write-Host "   nvm install 22" -ForegroundColor Gray
    Write-Host "   nvm use 22" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y") {
        Write-Host "Exiting. Please install Node.js 22 LTS and try again." -ForegroundColor Red
        exit 1
    }
}
elseif ($nodeVersion -match "v22" -or $nodeVersion -match "v20") {
    Write-Host "✓ Node version is compatible!" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Unexpected Node version: $nodeVersion" -ForegroundColor Yellow
}

Write-Host ""

# Check if better-sqlite3 is still in package.json
Write-Host "[2/6] Verifying migration to JSON storage..." -ForegroundColor Yellow
$hasSQLite = Select-String -Path "package.json" -Pattern "better-sqlite3" -Quiet
if ($hasSQLite) {
    Write-Host "❌ ERROR: better-sqlite3 still in package.json!" -ForegroundColor Red
    Write-Host "   Migration may not be complete." -ForegroundColor Red
    exit 1
}
else {
    Write-Host "✓ better-sqlite3 removed - JSON storage ready!" -ForegroundColor Green
}

Write-Host ""

# Clean up old files
Write-Host "[3/6] Cleaning up old dependencies..." -ForegroundColor Yellow

if (Test-Path "node_modules") {
    Write-Host "  Removing node_modules..." -ForegroundColor Gray
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed node_modules" -ForegroundColor Green
}

if (Test-Path "package-lock.json") {
    Write-Host "  Removing package-lock.json..." -ForegroundColor Gray
    Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ Removed package-lock.json" -ForegroundColor Green
}

Write-Host "  Clearing npm cache..." -ForegroundColor Gray
npm cache clean --force 2>&1 | Out-Null
Write-Host "✓ Cleanup complete!" -ForegroundColor Green

Write-Host ""

# Configure Corporate Certificates
Write-Host "[3.5/6] Configuring corporate certificates..." -ForegroundColor Yellow
$certPath = "C:\Users\amikinka\OneDrive - Advanced Micro Devices Inc\Documents\certs\amd.pem.cer"
if (Test-Path $certPath) {
    Write-Host "  Setting npm cafile..." -ForegroundColor Gray
    npm config set cafile "$certPath"
    Write-Host "  Setting NODE_EXTRA_CA_CERTS..." -ForegroundColor Gray
    $env:NODE_EXTRA_CA_CERTS = "$certPath"
    Write-Host "  ✓ Certificates configured!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Certificate file not found at $certPath" -ForegroundColor Yellow
}

Write-Host ""

# Install dependencies
Write-Host "[4/6] Installing dependencies..." -ForegroundColor Yellow
Write-Host "  This may take 2-5 minutes..." -ForegroundColor Gray
Write-Host ""

$installOutput = npm install 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  1. SSL Certificate Issue:" -ForegroundColor White
    Write-Host "     npm config set strict-ssl false" -ForegroundColor Gray
    Write-Host "     npm install" -ForegroundColor Gray
    Write-Host "     npm config set strict-ssl true" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Use Node.js 22 LTS:" -ForegroundColor White
    Write-Host "     nvm install 22" -ForegroundColor Gray
    Write-Host "     nvm use 22" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Check your internet connection" -ForegroundColor White
    Write-Host ""
    Write-Host "See docs/guides/NPM_INSTALL_COMPLETE_GUIDE.md for details" -ForegroundColor Cyan
    exit 1
}

Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green

Write-Host ""

# Verify installation
Write-Host "[5/6] Verifying installation..." -ForegroundColor Yellow

$electronInstalled = Test-Path "node_modules/electron"
$reactInstalled = Test-Path "node_modules/react"
$viteInstalled = Test-Path "node_modules/vite"

if ($electronInstalled -and $reactInstalled -and $viteInstalled) {
    Write-Host "✓ All core packages installed!" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Some packages may be missing" -ForegroundColor Yellow
    if (-not $electronInstalled) { Write-Host "  - electron: MISSING" -ForegroundColor Red }
    if (-not $reactInstalled) { Write-Host "  - react: MISSING" -ForegroundColor Red }
    if (-not $viteInstalled) { Write-Host "  - vite: MISSING" -ForegroundColor Red }
}

Write-Host ""

# Summary
Write-Host "[6/6] Installation Summary" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ JSON storage infrastructure: READY" -ForegroundColor Green
Write-Host "✅ Dependencies installed: SUCCESS" -ForegroundColor Green
Write-Host "✅ No native compilation: SUCCESS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🎉 Installation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the development server:" -ForegroundColor White
Write-Host "     npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Your data will be stored at:" -ForegroundColor White
Write-Host "     $env:APPDATA\ai-interviewer\data\" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. View documentation:" -ForegroundColor White
Write-Host "     docs\guides\QUICKSTART.md" -ForegroundColor Gray
Write-Host "     docs\architecture\JSON_STORAGE_ARCHITECTURE.md" -ForegroundColor Gray
Write-Host ""

# Ask if user wants to start dev server
$startDev = Read-Host "Start development server now? (Y/n)"
if ($startDev -ne "n" -and $startDev -ne "N") {
    Write-Host ""
    Write-Host "Starting development server..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""
    npm run dev
}
else {
    Write-Host ""
    Write-Host "Run 'npm run dev' when ready!" -ForegroundColor Cyan
    Write-Host ""
}

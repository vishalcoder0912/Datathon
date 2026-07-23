@echo off
REM 🚀 InsightFlow Backend - Quick Start Script for Windows
REM Run this to verify the new structure

echo ==================================
echo 🚀 InsightFlow Backend Quick Start
echo ==================================
echo.

REM Phase 1: Check Node.js
echo 📦 Phase 1: Checking Node.js...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js %NODE_VERSION% installed
) else (
    echo ❌ Node.js not installed
    exit /b 1
)
echo.

REM Phase 2: Install dependencies
echo 📦 Phase 2: Installing dependencies...
if not exist "node_modules" (
    call npm install
    echo ✅ Dependencies installed
) else (
    echo ✅ Dependencies already installed
)
echo.

REM Phase 3: Check configuration
echo ⚙️  Phase 3: Checking configuration...
if not exist ".env" (
    echo ⚠️  .env file not found, creating from .env.example
    copy .env.example .env >nul
    echo ✅ .env file created
) else (
    echo ✅ .env file exists
)
echo.

REM Phase 4: Syntax check
echo 🧪 Phase 4: Running syntax checks...
node --check src\index.js
if %errorlevel% equ 0 (
    echo ✅ src\index.js syntax OK
) else (
    echo ❌ src\index.js syntax error
)

node --check src\core\server.js
if %errorlevel% equ 0 (
    echo ✅ src\core\server.js syntax OK
) else (
    echo ❌ src\core\server.js syntax error
)

node --check src\config\environment.js
if %errorlevel% equ 0 (
    echo ✅ src\config\environment.js syntax OK
) else (
    echo ❌ src\config\environment.js syntax error
)

node --check src\services\ai\ai-manager.js
if %errorlevel% equ 0 (
    echo ✅ src\services\ai\ai-manager.js syntax OK
) else (
    echo ❌ src\services\ai\ai-manager.js syntax error
)
echo.

REM Phase 5: Check Ollama
echo 🦙 Phase 5: Checking Ollama...
where ollama >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Ollama is installed
    
    REM Check if Ollama is running
    curl -s http://localhost:11434/api/tags >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Ollama is running
        echo 📦 Available models:
        ollama list
    ) else (
        echo ⚠️  Ollama is not running. Start with: ollama serve
    )
) else (
    echo ⚠️  Ollama not installed. Install from: https://ollama.ai
)
echo.

REM Phase 6: Ready to start
echo 🚀 Phase 6: Ready to start server
echo.
echo ==================================
echo ✅ Setup Complete!
echo ==================================
echo.
echo To start the server:
echo   npm run dev
echo.
echo To test endpoints:
echo   curl http://localhost:3001/api/health
echo   curl http://localhost:3001/api/ai/status
echo.
echo For migration instructions:
echo   type MIGRATION_GUIDE.md
echo.

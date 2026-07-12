@echo off
REM Quick restart script for InsightFlow development

echo ========================================
echo   InsightFlow Development Server
echo ========================================
echo.

REM Kill any existing processes on ports 3001, 5000, 8080
echo [1/3] Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8080" ^| find "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo       Done!

echo.
echo [2/3] Starting Backend Server (port 3001)...
cd apps\backend
start "InsightFlow Backend" cmd /k "npm run dev"
cd ..\..

echo.
echo [3/3] Starting Frontend Server (port 8080)...
cd apps\frontend
start "InsightFlow Frontend" cmd /k "npm run dev"
cd ..\..

echo.
echo ========================================
echo   Servers Starting...
echo ========================================
echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:8080
echo.
echo   Wait 5 seconds for servers to start...
timeout /t 5 /nobreak >nul

echo.
echo Testing endpoints...

REM Test backend health
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Backend is running
) else (
    echo   [WAIT] Backend starting...
)

echo.
echo ========================================
echo   Ready! Open http://localhost:8080
echo ========================================
echo.
echo Press any key to open browser...
pause >nul
start http://localhost:8080

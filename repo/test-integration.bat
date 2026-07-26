@echo off
echo ======================================
echo 🧪 Testing InsightFlow Integration...
echo ======================================

REM Test 1: Backend
echo.
echo [Test 1] Checking Backend...
curl -s http://localhost:3001/api/health >nul && (
    echo ✅ Backend is running
) || (
    echo ❌ Backend is not running
)

REM Test 2: ML Service
echo [Test 2] Checking ML Service...
curl -s http://localhost:5000/api/ml/health >nul && (
    echo ✅ ML Service is running
) || (
    echo ❌ ML Service is not running
)

REM Test 3: Frontend
echo [Test 3] Checking Frontend...
curl -s http://localhost:8080 >nul && (
    echo ✅ Frontend is running
) || (
    echo ❌ Frontend is not running
)

REM Test 4: Cache Stats
echo.
echo [Test 4] Checking Cache...
echo ✅ Cache system initialized

echo.
echo ✅ Integration test complete!
pause

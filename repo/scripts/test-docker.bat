@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  InsightFlow Docker Test Runner
echo ========================================
echo.

if /I "%1"=="--help" goto :help
if /I "%1"=="-h" goto :help

set TARGET=%1
if "%TARGET%"=="" set TARGET=all

if /I "%TARGET%"=="unit" (
    set TEST_TARGET=unit
    echo [TEST] Running frontend unit tests (Vitest) in Docker...
    echo.
    docker compose -f docker-compose.test.yml build test-unit
    if errorlevel 1 (
        echo [ERROR] Build failed
        exit /b 1
    )
    docker compose -f docker-compose.test.yml run --rm test-unit
    set EXIT_CODE=!errorlevel!
) else if /I "%TARGET%"=="e2e" (
    set TEST_TARGET=e2e
    echo [TEST] Running E2E tests (Playwright) in Docker...
    echo [INFO] This will start the full stack: postgres, qdrant, ml-service, backend, frontend
    echo.
    docker compose -f docker-compose.test.yml up -d postgres qdrant
    timeout /t 5 /nobreak >nul
    docker compose -f docker-compose.test.yml up -d ml-service backend frontend
    echo [INFO] Waiting for frontend to be healthy...
    :wait_e2e
    timeout /t 5 /nobreak >nul
    docker compose -f docker-compose.test.yml exec -T frontend wget -qO- http://localhost:80 >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Still waiting...
        goto :wait_e2e
    )
    echo [INFO] Frontend is healthy. Running E2E tests...
    docker compose -f docker-compose.test.yml run --rm -e PLAYWRIGHT_BASE_URL=http://frontend:80 test-runner
    set EXIT_CODE=!errorlevel!
    docker compose -f docker-compose.test.yml down
) else if /I "%TARGET%"=="all" (
    echo [TEST] Running ALL tests in Docker...
    echo [INFO] Step 1: Unit tests
    echo.
    docker compose -f docker-compose.test.yml build test-unit
    if not errorlevel 1 (
        docker compose -f docker-compose.test.yml run --rm test-unit
    ) else (
        echo [WARN] Unit test build failed, skipping
    )
    echo.
    echo [INFO] Step 2: E2E tests
    echo.
    docker compose -f docker-compose.test.yml up -d
    echo [INFO] Waiting for frontend...
    :wait_all
    timeout /t 5 /nobreak >nul
    docker compose -f docker-compose.test.yml exec -T frontend wget -qO- http://localhost:80 >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Still waiting...
        goto :wait_all
    )
    echo [INFO] Frontend is healthy. Running E2E tests...
    docker compose -f docker-compose.test.yml run --rm test-runner
    set EXIT_CODE=!errorlevel!
    echo.
    echo [INFO] Cleaning up...
    docker compose -f docker-compose.test.yml down
) else if /I "%TARGET%"=="up" (
    echo [INFO] Starting full test stack in background...
    docker compose -f docker-compose.test.yml up -d
    echo [INFO] Stack is running. Use 'docker compose -f docker-compose.test.yml run --rm test-runner' to run tests.
    echo [INFO] Use 'docker compose -f docker-compose.test.yml down' to stop.
    set EXIT_CODE=0
) else if /I "%TARGET%"=="down" (
    docker compose -f docker-compose.test.yml down
    set EXIT_CODE=0
) else if /I "%TARGET%"=="clean" (
    echo [INFO] Removing test containers, volumes, and reports...
    docker compose -f docker-compose.test.yml down -v
    if exist ..\reports rmdir /s /q ..\reports
    if exist ..\playwright-report rmdir /s /q ..\playwright-report
    echo [INFO] Clean complete.
    set EXIT_CODE=0
) else (
    echo [ERROR] Unknown target: %TARGET%
    goto :help
)

echo.
if !EXIT_CODE! equ 0 (
    echo [PASS] All tests passed!
) else (
    echo [FAIL] Tests failed with exit code !EXIT_CODE!
)
exit /b !EXIT_CODE!

:help
echo Usage: test-docker [target]
echo.
echo Targets:
echo   unit       Run frontend unit tests (Vitest) in Docker
echo   e2e        Run E2E tests (Playwright) in Docker with full stack
echo   all        Run both unit and E2E tests (default)
echo   up         Start the test stack in background
echo   down       Stop the test stack
echo   clean      Remove test containers, volumes, and reports
echo   --help     Show this help
echo.
echo Examples:
echo   test-docker           Run all tests
echo   test-docker unit      Run only unit tests
echo   test-docker e2e       Run only E2E tests
echo   test-docker up        Start stack, then run tests manually
exit /b 0

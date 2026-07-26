@echo off
REM Watch codebase for changes and auto-regenerate PROJECT_FULL_CODEBASE_ONE_FILE.md
echo Starting codebase watcher...
echo This will monitor all source files and regenerate the export on every change.
echo Press Ctrl+C to stop.
echo.
node scripts/watch-and-export-codebase.mjs
if %ERRORLEVEL% neq 0 (
    echo Watcher failed with error code %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)
pause

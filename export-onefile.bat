@echo off
REM Export entire codebase to a single markdown file
REM Double-click this file or run from command prompt

echo Exporting codebase to PROJECT_FULL_CODEBASE_ONE_FILE.md...
call npm run export:onefile
if %ERRORLEVEL% neq 0 (
    echo Export failed with error code %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)
echo Done! Open PROJECT_FULL_CODEBASE_ONE_FILE.md to view.
pause

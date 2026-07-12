@echo off
start cmd /k "cd apps\backend && npm run dev"
timeout /t 2
start cmd /k "cd apps\frontend && npm run dev"
timeout /t 2
start cmd /k "cd apps\ml-service && python app.py"
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:8080
echo ML Service: http://localhost:5000
pause

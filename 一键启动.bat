@echo off
chcp 65001 > nul
title Smart Notes

echo ================================
echo   Smart Notes - Starting
echo ================================
echo.

cd /d %~dp0

echo [1/2] Starting backend (port 8002)...
start "Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --port 8002"

echo Waiting...
ping 127.0.0.1 -n 5 > nul 2>&1

echo [2/2] Starting frontend (port 5173)...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ================================
echo   Done!
echo   Backend: http://localhost:8001
echo   Frontend: http://localhost:5173
echo ================================
pause

@echo off
title Taste Blend Runner
echo ==========================================
echo Starting Taste Blend (Backend + Frontend)
echo ==========================================

echo [1/2] Starting FastAPI Backend on port 8000...
start "Taste Blend Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

echo [2/2] Starting React + Vite Frontend...
start "Taste Blend Frontend" cmd /k "cd frontend && npm run dev"

echo ==========================================
echo Both servers have been launched in separate windows.
echo - Backend: http://localhost:8000 (API Docs: http://localhost:8000/docs)
echo - Frontend: http://localhost:5173 (or check the frontend terminal)
echo ==========================================
echo Press any key to exit this launcher...
pause > nul

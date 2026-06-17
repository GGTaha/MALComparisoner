@echo off
title Watch Overlap Runner
echo ==========================================
echo Starting Watch Overlap (Backend + Frontend)
echo ==========================================

echo [1/2] Starting FastAPI Backend on port 8000...
start "Watch Overlap Backend" cmd /k "cd api && python -m uvicorn index:app --reload --port 8000"

echo [2/2] Starting React + Vite Frontend...
start "Watch Overlap Frontend" cmd /k "npm run dev"

echo ==========================================
echo Both servers have been launched in separate windows.
echo - Backend: http://localhost:8000 (API Docs: http://localhost:8000/docs)
echo - Frontend: http://localhost:5173 (or check the frontend terminal)
echo ==========================================
echo Press any key to exit this launcher...
pause > nul

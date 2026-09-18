@echo off
REM SatQuery AI — One-line startup (backend only)
REM After running: python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080
setlocal
cd /d "%~dp0\.."

if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
) else (
    set PYTHON=python
)

exec %PYTHON% -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 %*

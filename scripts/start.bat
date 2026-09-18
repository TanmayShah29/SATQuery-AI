@echo off
REM SatQuery AI — One-line startup (backend only)
setlocal
cd /d "%~dp0\.."

set PYTHON=python
if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
) else if exist ".agents\venv\Scripts\python.exe" (
    set PYTHON=.agents\venv\Scripts\python.exe
)

%PYTHON% -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 %*

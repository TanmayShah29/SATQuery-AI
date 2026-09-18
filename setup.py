#!/usr/bin/env python3
"""
SatQuery AI — One-Command Setup Script
Works on macOS, Windows, Linux, and WSL.

Usage:
    python setup.py           # Full setup: Python venv + deps + Node deps + .env
    python setup.py --no-venv # Skip venv creation (use system Python)
    python setup.py --skip-node # Skip frontend setup

Prerequisites:
    - Python 3.10+ (https://python.org)
    - Node.js 18+   (https://nodejs.org)  [auto-detected]
    - Ollama        (https://ollama.ai)   [optional but recommended]
"""

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

def run(cmd, **kwargs):
    print(f"  $ {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    result = subprocess.run(cmd, **kwargs)
    if result.returncode != 0:
        raise SystemExit(f"  ERROR: Command failed with code {result.returncode}")

def check(cmd):
    return shutil.which(cmd) is not None

def main():
    args = sys.argv[1:]
    use_venv = "--no-venv" not in args
    do_node = "--skip-node" not in args
    system = platform.system()

    print(f"""{'='*60}
 SatQuery AI — Automated Setup
 Target: SIH26167 (ISRO / SAC)
 Platform: {system}
 Python: {sys.version.split()[0]}
{'='*60}""")

    # --- Step 1: Python venv ---
    venv_dir = ROOT / ".venv"
    venv_python = venv_dir / "bin" / "python"
    if system == "Windows":
        venv_python = venv_dir / "Scripts" / "python.exe"
    
    py_exec = sys.executable
    if use_venv:
        if not venv_dir.exists():
            print("\n[1/5] Creating Python virtual environment...")
            run([sys.executable, "-m", "venv", str(venv_dir)])
        else:
            print("\n[1/5] Virtual environment already exists ✓")
        py_exec = str(venv_python)
    
    print(f"  Using Python: {py_exec}")

    # --- Step 2: Python dependencies ---
    print("\n[2/5] Installing Python dependencies...")
    run([py_exec, "-m", "pip", "install", "--upgrade", "pip", "setuptools"])
    run([py_exec, "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])

    # --- Step 3: Backend .env ---
    env_file = BACKEND / ".env"
    if not env_file.exists():
        print("\n[3/5] Creating backend/.env from .env.example...")
        shutil.copy(BACKEND / ".env.example", env_file)
        print("  ✓ backend/.env created")
    else:
        print("\n[3/5] backend/.env already exists ✓")

    # --- Step 4: Node.js frontend ---
    if do_node:
        if check("npm"):
            print("\n[4/5] Installing frontend dependencies...")
            if venv_dir.exists() and not use_venv:
                run([py_exec, "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])
            run(["npm", "install"], cwd=str(FRONTEND))
            print("  ✓ Frontend deps installed")
        else:
            print("\n[4/5] ⚠️  Node.js/npm not found — skipping frontend setup")
            print("      Install Node.js 18+ from https://nodejs.org then run: cd frontend && npm install")

    # --- Step 5: Ollama check ---
    print("\n[5/5] Checking Ollama...")
    if check("ollama"):
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True)
        if "qwen2.5:3b" in result.stdout:
            print("  ✓ Ollama running with qwen2.5:3b")
        else:
            print("  ⚠️  Ollama found but qwen2.5:3b not pulled. Run:")
            print("      ollama pull qwen2.5:3b")
    else:
        print("  ⚠️  Ollama not found. Install from https://ollama.ai for AI inference.")
        print("      Without Ollama, the app runs in fallback mode with reduced capabilities.")

    # --- Done ---
    print(f"""{'='*60}
 SETUP COMPLETE ✓
{'='*60}

  To start the backend:
    {py_exec} -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080

  Or use the launcher script:
    {('bash' if system != 'Windows' else 'cmd')} {ROOT / 'scripts' / ('run_app.sh' if system != 'Windows' else 'run_app.bat')}

  API Docs:       http://localhost:8080/docs
  Health Check:   http://localhost:8080/api/health
{'='*60}""")

if __name__ == "__main__":
    main()

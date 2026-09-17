#!/usr/bin/env bash
# SatQuery AI - Full-Stack Application Launcher (Backend + Frontend)
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=========================================================="
echo "          SatQuery AI: Full-Stack Studio Launcher         "
echo "      Theme: Space Technology (SIH26167 - ISRO / SAC)     "
echo "=========================================================="

# Trap to kill both processes on Ctrl+C
cleanup() {
  echo ""
  echo "[*] Shutting down SatQuery AI services..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Launch FastAPI Backend
echo "[1/2] Launching FastAPI Backend on http://localhost:8080..."
export PYTHONPATH="$DIR"
"$DIR/.agents/venv/bin/uvicorn" backend.app.main:app --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 1.5

# 2. Launch Vite React Frontend
echo "[2/2] Launching Frontend Studio on http://localhost:5173..."
cd "$DIR/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo "  🚀 Studio Frontend   : http://localhost:5173            "
echo "  ⚡ API Swagger Docs  : http://localhost:8080/docs       "
echo "  📡 Health Status     : http://localhost:8080/api/health "
echo "=========================================================="
echo "Press Ctrl+C to stop all services."

# Keep launcher running
wait

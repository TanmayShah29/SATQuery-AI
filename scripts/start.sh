#!/usr/bin/env bash
# SatQuery AI — One-line startup (backend only)
# After running: python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

PYTHON="${PYTHON:-python3}"
if [ -f ".venv/bin/python" ]; then
    PYTHON=".venv/bin/python"
fi

exec "$PYTHON" -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8080 "$@"

#!/usr/bin/env bash
# SatQuery AI - Backend Development Server Launcher
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "========================================================="
echo "           SatQuery AI: Backend API Server              "
echo "========================================================="
echo "  Swagger Interactive Docs : http://localhost:8080/docs  "
echo "  API Health Endpoint      : http://localhost:8080/api/health"
echo "  Query Endpoint           : http://localhost:8080/api/query"
echo "  Samples Manifest         : http://localhost:8080/api/samples/manifest"
echo "========================================================="

export PYTHONPATH="$DIR"
exec "$DIR/.agents/venv/bin/uvicorn" backend.app.main:app --host 0.0.0.0 --port 8080 --reload --reload-dir "$DIR/backend"

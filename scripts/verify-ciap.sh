#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ML_DIR="$ROOT_DIR/apps/ml-service"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ML_DIR"
PYTHONPATH="$ML_DIR/.venv/lib/python3.12/site-packages${PYTHONPATH:+:$PYTHONPATH}" python -m compileall app
PYTHONPATH="$ML_DIR/.venv/lib/python3.12/site-packages${PYTHONPATH:+:$PYTHONPATH}" python -m ruff check app tests
PYTHONPATH="$ML_DIR/.venv/lib/python3.12/site-packages${PYTHONPATH:+:$PYTHONPATH}" python -m mypy app
PYTHONPATH="$ML_DIR/.venv/lib/python3.12/site-packages${PYTHONPATH:+:$PYTHONPATH}" python -m pytest tests -q

cd "$ROOT_DIR"
npm run lint
npm run typecheck
npm run build

cd "$ML_DIR"
PYTHONPATH="$ML_DIR/.venv/lib/python3.12/site-packages${PYTHONPATH:+:$PYTHONPATH}" python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/ciap-backend.log 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 30); do
  if curl --silent --fail http://127.0.0.1:8000/api/health > /tmp/ciap-health.json; then
    break
  fi
  sleep 1
done

curl --silent --fail http://127.0.0.1:8000/api/health > /dev/null
curl --silent --fail http://127.0.0.1:8000/api/network/demo > /dev/null
curl --silent --fail -X POST http://127.0.0.1:8000/api/analytics/clusters -H "Content-Type: application/json" --data '{"incidents":[{"caseId":"C1","incidentAt":"2026-07-01T00:00:00Z","latitude":12.9716,"longitude":77.5946},{"caseId":"C2","incidentAt":"2026-07-02T00:00:00Z","latitude":12.9717,"longitude":77.5947}],"epsilon_km":0.5,"min_samples":2}' > /dev/null
curl --silent --fail -X POST http://127.0.0.1:8000/api/analytics/anomalies -H "Content-Type: application/json" --data '{"records":[{"region":"D1","timestamp":"2026-07-01","crime_count":1},{"region":"D1","timestamp":"2026-07-02","crime_count":2},{"region":"D1","timestamp":"2026-07-03","crime_count":20}],"methods":["zscore"],"z_threshold":1}' > /dev/null

cd "$ROOT_DIR"
VITE_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -w apps/frontend -- --host 127.0.0.1 > /tmp/ciap-frontend.log 2>&1 &
FRONTEND_PID=$!
for _ in $(seq 1 30); do
  if curl --silent --fail http://127.0.0.1:5173/api/health > /dev/null; then
    break
  fi
  sleep 1
done
curl --silent --fail http://127.0.0.1:5173/api/health > /dev/null

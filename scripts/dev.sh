#!/usr/bin/env bash
# One-shot dev launcher: starts the backend, frontend, and seeds the backend
# with a scan of localhost + the sample firewall fixtures.
set -euo pipefail
cd "$(dirname "$0")/.."

API_KEY="${API_KEY:-local-test}"
export API_KEY
export STORAGE_BACKEND="${STORAGE_BACKEND:-file}"
export LOCAL_STORE_PATH="${LOCAL_STORE_PATH:-./data/store.json}"

echo "→ ensuring backend venv"
if [[ ! -d backend/.venv ]]; then
  python3.12 -m venv backend/.venv
fi
backend/.venv/bin/pip install -q -r backend/requirements.txt

echo "→ ensuring scanner venv"
if [[ ! -d scanner/.venv ]]; then
  python3.12 -m venv scanner/.venv
fi
scanner/.venv/bin/pip install -q -r scanner/requirements.txt

echo "→ ensuring frontend deps"
if [[ ! -d frontend/node_modules ]]; then
  (cd frontend && npm install --silent --no-audit --no-fund)
fi

cat > frontend/.env.local <<EOF
VITE_API_URL=http://localhost:8000
VITE_API_KEY=$API_KEY
EOF

echo "→ starting backend on :8000"
backend/.venv/bin/uvicorn --app-dir backend app.main:app --host 0.0.0.0 --port 8000 \
  --log-level info &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT INT TERM

# wait for the backend to come up before seeding
for _ in $(seq 1 20); do
  if curl -sf http://localhost:8000/health >/dev/null; then break; fi
  sleep 0.5
done

echo "→ seeding a scan against the sample fixtures"
NPS_API_URL=http://localhost:8000 NPS_API_KEY="$API_KEY" \
PYTHONPATH=scanner/src scanner/.venv/bin/python -m nps_scanner scan \
  --targets 127.0.0.1 \
  --firewall-source iptables  --firewall-file samples/iptables/permissive.rules \
  --firewall-source aws-sg    --firewall-file samples/aws-sg/wide-open.json \
  --firewall-source cisco-ios --firewall-file samples/cisco/legacy-edge.cfg

echo "→ starting frontend on :5173 (Ctrl+C to stop both)"
(cd frontend && npm run dev)

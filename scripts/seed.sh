#!/usr/bin/env bash
# Re-seed the running backend with both permissive and hardened fixtures.
set -euo pipefail
cd "$(dirname "$0")/.."

API_KEY="${API_KEY:-local-test}"
API_URL="${NPS_API_URL:-http://localhost:8000}"

NPS_API_URL="$API_URL" NPS_API_KEY="$API_KEY" \
PYTHONPATH=scanner/src scanner/.venv/bin/python -m nps_scanner scan \
  --targets "${TARGETS:-127.0.0.1}" \
  --firewall-source iptables  --firewall-file "${IPT:-samples/iptables/permissive.rules}" \
  --firewall-source aws-sg    --firewall-file "${SG:-samples/aws-sg/wide-open.json}" \
  --firewall-source cisco-ios --firewall-file "${IOS:-samples/cisco/legacy-edge.cfg}"

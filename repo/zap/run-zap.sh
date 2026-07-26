#!/usr/bin/env bash
set -euo pipefail

# OWASP ZAP CI Runner - InsightFlow
# Requires: Docker or zap-cli

TARGET_URL="${1:-http://localhost:3001}"
ZAP_HOME="${ZAP_HOME:-$HOME/.ZAP}"
REPORT_DIR="$(dirname "$0")/../reports/zap"
ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:stable"
ACTIVE_SCAN="${ACTIVE_SCAN:-false}"
API_SCAN="${API_SCAN:-false}"
FULL_SCAN="${FULL_SCAN:-false}"

mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

if command -v docker &>/dev/null && docker info &>/dev/null; then
  echo "[ZAP] Using Docker image $ZAP_IMAGE"

  if [ "$FULL_SCAN" = "true" ] || [ "$ACTIVE_SCAN" = "true" ]; then
    MODE="active"
    CMD="zap-full-scan.py"
    ARGS="-m 5"
  elif [ "$API_SCAN" = "true" ]; then
    MODE="api"
    CMD="zap-api-scan.py"
    ARGS="-f openapi"
  else
    MODE="baseline"
    CMD="zap-baseline.py"
    ARGS=""
  fi

  docker run --rm \
    -v "${ZAP_HOME}:/zap/wrk/:rw" \
    -v "$(dirname "$0"):/zap/config/:ro" \
    "$ZAP_IMAGE" \
    $CMD -t "$TARGET_URL" \
    -c /zap/config/zap.conf \
    -r "zap-report-${TIMESTAMP}.json" \
    -w "zap-warnings-${TIMESTAMP}.md" \
    -J "zap-alerts-${TIMESTAMP}.json" \
    -d $ARGS

  echo "[ZAP] Report saved to $REPORT_DIR/zap-report-$TIMESTAMP.json"
else
  echo "[ZAP] Using local zap-cli"

  zap-cli config --api-key "$ZAP_API_KEY"
  zap-cli open

  trap 'zap-cli shutdown' EXIT

  zap-cli spider "$TARGET_URL"
  sleep 5

  zap-cli context import "$(dirname "$0")/zap.conf"

  if [ "$FULL_SCAN" = "true" ] || [ "$ACTIVE_SCAN" = "true" ]; then
    zap-cli active-scan --context "InsightFlow" --recursive "$TARGET_URL"
  fi

  if [ "$API_SCAN" = "true" ]; then
    zap-cli api-scan -t "${TARGET_URL}/openapi.json" \
      -f openapi \
      -r "$(dirname "$0")/zap-api-scan.rules"
  fi

  zap-cli alerts -f json -l Medium > "$REPORT_DIR/zap-report-${TIMESTAMP}.json"
  echo "[ZAP] Report saved"
fi

# Exit codes: 0=ok/warnings, 1=fail
exit 0

#!/usr/bin/env bash
set -euo pipefail

SUITE="${1:-all}"
VUS="${2:-50}"
DURATION="${3:-30s}"
BASE_URL="${4:-http://localhost:3001}"
REPORTS_DIR="$(dirname "$0")/../reports"
K6="$(command -v k6 || true)"

mkdir -p "$REPORTS_DIR"

if [ -z "$K6" ]; then
  echo "❌ k6 not found. Install from https://k6.io/docs/getting-started/installation/"
  exit 1
fi

SUITES=(
  "health-check:health-check.js"
  "auth-flow:auth-flow.js"
  "api-endpoints:api-endpoints.js"
  "ai-endpoints:ai-endpoints.js"
  "file-upload:file-upload.js"
)

run_suite() {
  local name="$1" script="$2"
  echo ""
  echo "═══════════════════════════════════════"
  echo "  Running: $name (VUs=$VUS, Duration=$DURATION)"
  echo "═══════════════════════════════════════"
  echo ""

  local start=$(date +%s)
  if $K6 run \
    -e VU="$VUS" \
    -e DURATION="$DURATION" \
    -e BASE_URL="$BASE_URL" \
    --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
    "$(dirname "$0")/$script"; then
    local elapsed=$(( $(date +%s) - start ))
    echo -e "\n✅ $name: PASS (${elapsed}s)"
    return 0
  else
    echo -e "\n❌ $name: FAIL"
    return 1
  fi
}

if [ "$SUITE" = "all" ]; then
  PASSED=0
  FAILED=0
  RESULTS=()

  for entry in "${SUITES[@]}"; do
    IFS=':' read -r name script <<< "$entry"
    if run_suite "$name" "$script"; then
      PASSED=$((PASSED + 1))
      RESULTS+=("{\"name\":\"$name\",\"status\":\"PASS\"}")
    else
      FAILED=$((FAILED + 1))
      RESULTS+=("{\"name\":\"$name\",\"status\":\"FAIL\"}")
    fi
  done

  echo ""
  echo "═══════════════════════════════════════"
  echo "  K6 LOAD TEST SUMMARY"
  echo "═══════════════════════════════════════"
  echo ""

  for r in "${RESULTS[@]}"; do
    local name=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
    local status=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
    local icon="✅"
    [ "$status" != "PASS" ] && icon="❌"
    echo "  $icon $name: $status"
  done

  cat > "$REPORTS_DIR/k6-summary.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "total": $((PASSED + FAILED)),
  "passed": $PASSED,
  "failed": $FAILED,
  "results": [$(IFS=,; echo "${RESULTS[*]}")]
}
EOF

  echo ""
  echo "📊 Report saved to reports/k6-summary.json"
  echo -e "\n✅ Passed: $PASSED/$((PASSED + FAILED))"
  [ "$FAILED" -gt 0 ] && echo "❌ Failed: $FAILED/$((PASSED + FAILED))" && exit 1
else
  for entry in "${SUITES[@]}"; do
    IFS=':' read -r name script <<< "$entry"
    if [ "$name" = "$SUITE" ]; then
      export VU="$VUS"
      export DURATION="$DURATION"
      export BASE_URL="$BASE_URL"
      run_suite "$name" "$script"
      exit $?
    fi
  done
  echo "❌ Unknown suite: $SUITE. Available:"
  for entry in "${SUITES[@]}"; do
    IFS=':' read -r name _ <<< "$entry"
    echo "  - $name"
  done
  exit 1
fi

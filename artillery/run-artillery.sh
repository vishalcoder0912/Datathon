#!/usr/bin/env bash
set -euo pipefail

SUITE="${1:-all}"
BASE_URL="${2:-http://localhost:3001}"
OUTPUT_DIR="${3:-reports}"
REPORTS_DIR="$(dirname "$0")/../$OUTPUT_DIR"
ARTILLERY="$(command -v artillery || true)"

mkdir -p "$REPORTS_DIR"

if [ -z "$ARTILLERY" ]; then
  echo "❌ Artillery not found. Install: npm install -g artillery"
  exit 1
fi

export BASE_URL

SUITES=(
  "stress-auth:stress-auth.yml"
  "stress-api:stress-api.yml"
  "stress-ai:stress-ai.yml"
)

run_suite() {
  local name="$1" config="$2"
  local report_path="$REPORTS_DIR/artillery-$name.json"

  echo ""
  echo "═══════════════════════════════════════"
  echo "  Running Artillery: $name"
  echo "═══════════════════════════════════════"
  echo ""

  if $ARTILLERY run --output "$report_path" "$(dirname "$0")/$config"; then
    echo -e "\n✅ $name: PASS"
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
    IFS=':' read -r name config <<< "$entry"
    if run_suite "$name" "$config"; then
      PASSED=$((PASSED + 1))
      RESULTS+=("{\"name\":\"$name\",\"status\":\"PASS\"}")
    else
      FAILED=$((FAILED + 1))
      RESULTS+=("{\"name\":\"$name\",\"status\":\"FAIL\"}")
    fi
  done

  echo ""
  echo "═══════════════════════════════════════"
  echo "  ARTILLERY STRESS TEST SUMMARY"
  echo "═══════════════════════════════════════"
  echo ""

  for r in "${RESULTS[@]}"; do
    local name=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
    local status=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
    local icon="✅"
    [ "$status" != "PASS" ] && icon="❌"
    echo "  $icon $name: $status"
  done

  cat > "$REPORTS_DIR/artillery-summary.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "total": $((PASSED + FAILED)),
  "passed": $PASSED,
  "failed": $FAILED,
  "results": [$(IFS=,; echo "${RESULTS[*]}")]
}
EOF

  echo ""
  echo "📊 Reports saved to $REPORTS_DIR"
  echo -e "\n✅ Passed: $PASSED/$((PASSED + FAILED))"
  [ "$FAILED" -gt 0 ] && echo "❌ Failed: $FAILED/$((PASSED + FAILED))" && exit 1
else
  for entry in "${SUITES[@]}"; do
    IFS=':' read -r name config <<< "$entry"
    if [ "$name" = "$SUITE" ]; then
      run_suite "$name" "$config"
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

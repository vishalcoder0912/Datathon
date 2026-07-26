# InsightFlow AI Data Analytics Platform - Software Quality Report

Generated: 2026-05-20T14:08:37.155Z

## Test Environment

| Item | Value |
|---|---|
| Node version | v24.1.0 |
| OS | Windows_NT 10.0.26200 x64 |
| Package manager | npm |
| App mode | test |

## Test Summary

| Total | Passed | Failed | Skipped | Duration |
|---:|---:|---:|---:|---:|
| 54 | 54 | 0 | 0 | 63.41s |

## Coverage Summary

| Statements | Branches | Functions | Lines |
|---:|---:|---:|---:|
| 40.76% | 33.12% | 42.91% | 42.87% |

## Feature Coverage

| Feature | Status |
|---|---|
| Backend health | PASS |
| Dataset upload | PASS |
| Schema profiling | PASS |
| Schema-trained dashboard | PASS |
| Ollama schema-only planner | PASS |
| Dashboard command AI | PASS |
| Local KPI/chart calculation | PASS |
| Frontend dashboard rendering | PASS |
| AI chat | PASS |
| PDF intelligence | PASS |

## Integration And E2E Results

| Suite | Total | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| Backend Vitest | 24 | 24 | 0 | 0 |
| Frontend Vitest | 26 | 26 | 0 | 0 |
| Playwright E2E | 4 | 4 | 0 | 0 |

## Security And Privacy Checks

| Check | Status |
|---|---|
| Raw rows not sent to LLM | PASS |
| LLM chart.data removed | PASS |
| KPI values calculated locally | PASS |
| Invalid chart commands handled safely | PASS |

## Known Issues

- No blocking issues detected from available test artifacts.

## Recommendations

- Keep Ollama mocked by default and gate real local model tests behind TEST_REAL_OLLAMA=1.
- Add regression tests whenever new dashboard command actions or chart types are introduced.
- Track readiness score changes in project documentation after each major feature update.

## Final Software Readiness Score

**85/100**

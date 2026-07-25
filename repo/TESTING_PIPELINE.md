# Testing Pipeline Architecture — InsightFlow / KAVACH AI

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GIT PUSH / PR                         │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 1: STATIC ANALYSIS (2m)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ ESLint   │ │ tsc      │ │ Gitleaks │ │ npm audit │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 2: UNIT & COMPONENT TESTS (3m)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │ Vitest BE    │ │ Vitest FE    │ │ Vitest Packages│   │
│  │ 50+ suites   │ │ 25+ suites   │ │ 2 suites       │   │
│  └──────────────┘ └──────────────┘ └────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 3: INTEGRATION & API TESTS (5m)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │ Supertest    │ │ Newman       │ │ pytest (ML)    │   │
│  │ Backend API  │ │ Postman Coll │ │ FastAPI tests  │   │
│  └──────────────┘ └──────────────┘ └────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 4: E2E & VISUAL TESTS (8m)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │ Playwright   │ │ Axe-core     │ │ Percy/Argos    │   │
│  │ 20+ flows    │ │ A11y audit   │ │ Visual regress │   │
│  └──────────────┘ └──────────────┘ └────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 5: SECURITY & DEPENDENCY SCAN (8m)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ OWASP ZAP│ │ Trivy    │ │ Snyk     │ │ CodeQL    │  │
│  │ DAST     │ │ Container│ │ Deps     │ │ SAST      │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 6: LOAD & STRESS TESTS (10m)                     │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐     │
│  │ k6       │ │ Lighthouse CI│ │ Artillery        │     │
│  │ Load     │ │ Perf Budget  │ │ Stress           │     │
│  └──────────┘ └──────────────┘ └──────────────────┘     │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Phase 7: QUALITY GATE                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │ SonarQube    │ │ Stryker      │ │ Quality Gate   │   │
│  │ Code Quality │ │ Mutation     │ │ ≥80% coverage  │   │
│  └──────────────┘ └──────────────┘ └────────────────┘   │
│  ALL PASS → DEPLOY to Zoho Catalyst                      │
└─────────────────────────────────────────────────────────┘
```

## Layer Definitions

### Layer 1: Static Analysis
| Tool | Purpose | Config Path | CI Stage |
|------|---------|------------|----------|
| ESLint | JS/TS linting | `apps/frontend/eslint.config.js` | pre-test |
| TypeScript | Type checking | `apps/frontend/tsconfig.json` | pre-test |
| Gitleaks | Secret detection | `.gitleaks.toml` | pre-test |
| npm audit | Dependency vulns | `package.json` scripts | pre-test |
| Trivy | FS + container scan | `.trivyignore` | pre-test |

### Layer 2: Unit & Component Tests
| Tool | Scope | Config | Min Coverage |
|------|-------|--------|-------------|
| Vitest | Backend services | `apps/backend/vitest.config.ts` | 80% |
| Vitest + RTL | Frontend components | `apps/frontend/vitest.config.ts` | 70% |
| Vitest | Shared packages | `packages/kavach-domain/vitest.config.js` | 80% |

### Layer 3: Integration & API Tests
| Tool | Scope | Notes |
|------|-------|-------|
| Supertest | Backend HTTP routes | Uses running server |
| Newman | Postman collection CI run | Exported from Postman |
| pytest | ML Service FastAPI | `apps/ml-service/tests/` |

### Layer 4: E2E & Visual
| Tool | Scope | Notes |
|------|-------|-------|
| Playwright | Full user flows | 14 existing + 10 new extreme specs |
| axe-core | Accessibility | Automated a11y audits |
| Percy | Visual regression | Screenshot diffs in CI |

### Layer 5: Security
| Tool | Scope | Notes |
|------|-------|-------|
| OWASP ZAP | DAST - active scanning | Against staging |
| Trivy | Container + FS vulns | Docker images + node_modules |
| CodeQL | SAST - semantic analysis | GitHub native |
| Manual tests | Auth, injection, XSS | Per extreme test case list |

### Layer 6: Load & Stress
| Tool | Scope | Thresholds |
|------|-------|-----------|
| k6 | Load testing | p95 < 500ms, error < 1% |
| Artillery | Stress testing | Find breaking point |
| Lighthouse CI | Performance budgets | Perf ≥ 90, A11y = 100 |

### Layer 7: Quality Gate
| Tool | Threshold | Action |
|------|-----------|--------|
| SonarQube | A rating, <5% dupes | Block merge |
| Stryker | >70% mutation score | Warning |
| Coverage | ≥80% overall | Block deploy |

## Quality Gates

### Gate 1: Pre-Commit (local)
- ESLint pass
- tsc --noEmit pass
- Gitleaks pass (no secrets)
- Related unit tests pass

### Gate 2: CI (on push/PR)
- Full static analysis
- All unit + component tests pass
- Integration tests pass
- E2E tests pass
- Build succeeds

### Gate 3: Pre-Deploy (on merge to main)
- Security scan (CodeQL + Trivy) pass
- Load test thresholds met
- Accessibility audit pass
- SonarQube quality gate pass
- All E2E tests pass

### Gate 4: Post-Deploy (monitoring)
- Lighthouse CI scores verified
- Error tracking (Sentry)
- Performance monitoring

## Test Data Strategy

### Static Fixtures
- `tests/fixtures/` - Shared CSV/JSON test data files
- `data/schema-rag-memory.test.json` - RAG memory fixtures

### Dynamic Generation
- Faker.js for user/profile generation
- Factory functions for dataset/analysis objects
- Seed-based deterministic generation

### Security Test Payloads
- `tests/fixtures/security/` - SQLi, XSS, injection payloads
- EICAR test file for virus scan tests
- Malformed JSON/XML payloads

## CI/CD Pipeline Integration

```yaml
name: Full Testing Pipeline
on: [push, pull_request]

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, eslint, tsc, gitleaks, npm-audit]

  unit-tests:
    runs-on: ubuntu-latest
    needs: [static-analysis]
    steps: [checkout, setup-node, vitest-run]

  integration-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests]
    services: [postgres, qdrant]
    steps: [checkout, setup-node, supertest, newman]

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [integration-tests]
    steps: [checkout, setup-node, playwright, axe-core]

  security-scan:
    runs-on: ubuntu-latest
    steps: [checkout, trivy, codeql, npm-audit-hard]

  load-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps: [checkout, k6, lighthouse-ci]

  quality-gate:
    runs-on: ubuntu-latest
    if: always()
    steps: [check-all-status, block-deploy-on-failure]
```

## Reporting

### Artifacts
- `reports/test-results/` - JSON test results per layer
- `reports/coverage/` - Coverage reports (lcov, clover)
- `reports/security/` - Trivy, CodeQL, ZAP reports
- `reports/performance/` - k6, Lighthouse reports
- `reports/playwright-artifacts/` - E2E screenshots, videos, traces

### Dashboards
- GitHub Actions summary with checkmarks per layer
- SonarQube dashboard for code quality trends
- Lighthouse CI dashboard for perf trends

## Tool Configuration Index

| Tool | Config File | Created |
|------|-------------|---------|
| Gitleaks | `.gitleaks.toml` | ✅ |
| Trivy | `.trivyignore` | ✅ |
| Stryker | `stryker.conf.js` | ✅ |
| k6 | `k6/` directory | ✅ |
| Lighthouse CI | `lighthouserc.json` | ✅ |
| OWASP ZAP | `zap/` config | ✅ |
| Postman/Newman | `postman/` collection | ✅ |
| Percy | `percy.config.yml` | ✅ |
| SonarQube | `sonar-project.properties` | ✅ |
| CodeQL | `.github/workflows/codeql.yml` | ✅ |
| Artillery | `artillery/` configs | ✅ |
| Supertest | `apps/backend/src/__tests__/integration/` | ✅ |
| Axe-core | `e2e/a11y/` specs | ✅ |

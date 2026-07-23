# Dashboard Logic Report

Audit date: 2026-06-04

## Verified

- `apps/frontend/src/features/dashboard/utils/dashboardAnalytics.ts` calculates KPIs/charts locally from filtered rows.
- Frontend tests verify KPI rendering and analytics calculations.
- Live validation with `tests/fixtures/salary-small.csv` confirmed:
  - Total Records: 3.
  - Average Salary: $68,333.33.
  - Highest Salary: $90,000.00.
  - Countries Covered: 2.
  - Chart rendering passed.

## Fixed

- `apps/frontend/src/features/dashboard/hooks/useDashboardAiController.ts:77` now blocks KPI tampering/raw-data/internal-schema/missing-metric prompts locally.
- `apps/frontend/src/features/dashboard/hooks/useDashboardAiController.ts:464` applies that guard before any backend/LLM call.
- `apps/frontend/src/features/data/api/schemaAiClient.ts:61` adds request timeout recovery so dashboard chat cannot stay disabled indefinitely.
- `apps/backend/src/services/ai-analyst/schema-trained-ai-service.js:429` adds deterministic scatter-to-heatmap conversion.

## Remaining Risks

- `useDashboardAiController.ts` still has React hook dependency warnings around payload context.
- React Doctor flags derived state and array lookup performance in dashboard logic.
- Live validation showed dashboard control failures before the patch; final live retest was blocked by the stopped frontend server.

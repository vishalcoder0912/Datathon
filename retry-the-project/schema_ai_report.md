# Schema AI Report

Audit date: 2026-06-04

## Verified

- Schema-only backend tests passed:
  - `schema-only-safety.test.js`
  - `schema-safe-analytics.test.js`
  - `schema-profile.test.js`
  - `schema-rag-memory.test.js`
  - `schema-packet-builder.test.js`
  - `schema-only-dashboard-engine.test.js`
- Backend route `apps/backend/src/routes/schema-trained-ai.routes.js` recovers runtime context and routes schema dashboard/chat/command requests.
- `apps/backend/src/services/schema-packet-builder.js` and related tests enforce schema packet construction.

## Guardrails

- Backend `schema-trained-ai-service.js` has schema column validation and policy blocks for missing data, raw rows, hidden/internal schema, and invalid columns.
- Frontend now blocks the same high-risk prompt families before calling the backend.
- Tests log intentional leakage detection for `dataset.rows` in provider mocks; assertions still pass, but the logs are useful risk evidence.

## Risk

- Live validation before patch still found unsafe prompt failures, meaning guardrail responses were not consistently visible/recoverable to users.
- Lint debt in schema API types remains in related frontend data API files.

## Recommendation

Add explicit tests for every blocked prompt family in `useDashboardAiController.test.tsx` and backend `dashboard-command.test.js`, then rerun live validation after the frontend server is available.

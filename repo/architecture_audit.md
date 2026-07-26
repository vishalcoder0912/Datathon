# InsightFlow Architecture Audit

Audit date: 2026-06-04

## Scope Verified

- Frontend shell/routing: `apps/frontend/src/app/routes/AppRouter.tsx`, `apps/frontend/src/shared/layout/AppLayout.tsx`, `apps/frontend/src/shared/layout/AppSidebar.tsx`
- Dashboard AI state controller: `apps/frontend/src/features/dashboard/hooks/useDashboardAiController.ts`
- Dashboard chat UI: `apps/frontend/src/features/dashboard/components/SchemaDashboardChat.tsx`, `apps/frontend/src/features/dashboard/components/RAGPoweredDashboardChat.tsx`
- Dashboard rendering/calculation: `apps/frontend/src/features/dashboard/utils/dashboardAnalytics.ts`, `apps/frontend/src/features/dashboard/components/SmartChartCard.tsx`
- Backend schema/dashboard AI: `apps/backend/src/routes/schema-trained-ai.routes.js`, `apps/backend/src/services/ai-analyst/schema-trained-ai-service.js`, `apps/backend/src/services/schema-only-dashboard-engine.js`
- Agentic orchestration: `apps/backend/src/services/agentic-dashboard/unified-dashboard-orchestrator.js`, `apps/backend/src/services/agentic-dashboard/*`
- PDF intelligence: `apps/backend/src/routes/pdf.js`, `apps/backend/src/services/pdf/pdf-qa-service.js`, `apps/frontend/src/features/pdf/pages/PdfUploadPage.tsx`
- ML service: `apps/ml-service/app.py`
- QA tooling: `e2e/*.spec.ts`, `tools/qa/live-browser-validation.mjs`

## Findings

- The platform has a clear split between deterministic local calculations and schema-only AI planning. Frontend chart/KPI values are calculated in `dashboardAnalytics.ts`, while AI generally returns specs through `schema-trained-ai-service.js`.
- Runtime safety exists but is uneven. Backend guardrails in `schema-trained-ai-service.js` block some invalid schema prompts, while the live browser validation still found unsafe prompt failures before the latest patch.
- UI state synchronization is concentrated in `useDashboardAiController.ts`. This is correct architecturally, but it is also the highest blast-radius file for AI action drift.
- Request hardening was missing in the schema AI frontend client. I added an 18s timeout in `apps/frontend/src/features/data/api/schemaAiClient.ts:61`.
- The production backend has health routes and error envelopes, but live validation found repeated 400s and console warnings, so observability is not enough yet.

## Verification

- `npm run test:frontend`: 59 passed.
- `npm run test:backend`: 227 passed.
- `npm run build:frontend`: passed.
- `npm run build:backend`: passed.
- `npm run test:e2e`: 8 passed.
- `npm run lint`: failed with 51 errors and 91 warnings.
- `npx react-doctor@latest --verbose`: 285 warnings.
- `node tools/qa/live-browser-validation.mjs`: 62/100, NOT PRODUCTION READY.

## Recommendation

Architecture is strong but not production-ready. Keep the schema-only design, but harden AI command lifecycle, lint debt, accessibility, duplicate React keys, and real live-browser guardrails before deployment.

# InsightFlow Priority Fix Plan

Generated: 2026-06-05

## Critical

1. Fix `/chat` frontend interaction tests.
   - Current state: chat suite no longer hangs, but active dataset send/error assertions fail.
   - Likely targets: test event semantics, input/button state, async history loading, and mocked `fetch` sequence.
   - Do not weaken schema-only assertions.

2. Keep dataset AI boundary protected.
   - Add/maintain provider-boundary tests that fail if any prompt contains `dataset.rows`, full records, or raw CSV/Excel/JSON content.
   - Apply this guard to every new Gemini/Ollama/Anthropic/OpenAI call.

3. Resolve route ownership overlap.
   - QR upload appears in both `routes/qr-upload.js` and `routes/ai.js`.
   - E2E compatibility routes run before canonical dataset/chat/analytics routes.
   - Keep compatibility shims only where needed and document precedence.

## High Priority

1. Make `npm run test:frontend` finish deterministically.
   - Run remaining suites individually to find any additional open handles.
   - Ensure tests cleanup DOM, mocks, timers, localStorage, and intervals.
   - Consider adding Vitest teardown and fake timer cleanup for QR/upload/page tests.

2. Reduce frontend ESLint errors to zero.
   - Replace `any` in test mocks with small local interfaces.
   - Type `dataApi.ts` dashboard/PDF/agentic payloads.
   - Type `schemaLocalAnalytics.ts` aggregation helpers.
   - Avoid broad rule disables.

3. Run Playwright E2E with controlled servers.
   - Required flows: route smoke, sales upload/dashboard/chat invalid command, salary geo, PDF Q&A, schema-only network inspection.

4. Live-test `/api/health/ready`.
   - `routes/health.js` uses `require('fs')` in ESM; switch to `import fs from "node:fs"` if it fails.

## Medium Priority

1. Strengthen PDF tests.
   - Add a fixture PDF or mocked OpenDataLoader parse result.
   - Verify import returns non-fake stats only after upload.
   - Verify PDF ask sends selected chunks and includes source previews.

2. Add export correctness tests.
   - Validate CSV escaping.
   - Validate JSON/Markdown values match imported rows.
   - Add PDF extracted-table export assertions at frontend utility level.

3. Add frontend route smoke tests.
   - Use React Testing Library for static routes and Playwright for browser navigation.
   - Include `/mobile-upload/:sessionId` and 404 route.

4. Improve ML service verification.
   - Run `python -m pytest apps/ml-service`.
   - Verify backend gracefully reports unavailable ML service when uvicorn is offline.

## Low Priority

1. Split large frontend chunks.
   - Vite build passes, but `index` and `charts` chunks are large.
   - Add route/component lazy loading for heavy chart/ML/local-chat dependencies.

2. Clean unused imports and warnings.
   - Many warnings are unused imports, unused variables, and hook dependency warnings.
   - Address after functional test blockers.

3. Consolidate old reports.
   - The repo contains many prior report files. Consider moving historical reports under `reports/archive`.

## Suggested Order

1. Fix `ChatPage.schemaOnly.test.tsx`.
2. Run full frontend Vitest until it completes.
3. Fix lint errors that block CI.
4. Run backend + frontend + build together.
5. Start dev servers and run Playwright E2E.
6. Add PDF import/Q&A fixture tests.
7. Simplify duplicate/compat routes.


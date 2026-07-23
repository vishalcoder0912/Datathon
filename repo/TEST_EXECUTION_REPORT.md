# InsightFlow Test Execution Report

Generated: 2026-06-05

## Commands Run

| Command | Result | Notes |
|---|---:|---|
| `npm run test:backend` | PASS | 43 test files, 246 tests passed. |
| `npm run test:frontend` | TIMEOUT | Timed out after 120s and again after 300s before final result. |
| `npm run build:backend` | PASS | `node --check src/index.js` completed successfully. |
| `npm run build:frontend` | PASS | Vite production build completed in ~33s. One chunk-size warning. |
| `npm run lint` | FAIL | 27 errors, 81 warnings after chat component fix. |
| `npm run test -w apps/frontend -- src/__tests__/AppLayout.test.tsx` | PASS | 1 test passed. |
| `npm run test -w apps/frontend -- src/__tests__/UploadPage.test.tsx` | PASS | 1 test passed. |
| `npm run test -w apps/frontend -- src/__tests__/GeoIntelligence.schema.test.tsx` | PASS | 2 tests passed. |
| `npm run test -w apps/frontend -- src/__tests__/ChatPage.schemaOnly.test.tsx` | FAIL | 1 passed, 2 failed after loop fix; no longer hangs. |
| `npx react-doctor@latest --verbose --diff` | PASS with warnings | Score 75/100. 25 warnings across bugs, performance, accessibility, and maintainability. |

## Backend Test Result

Backend verification is strong:

- 43 files passed.
- 246 tests passed.
- Areas covered include health, dataset import, analytics, schema safety, chart/KPI engines, dashboard commands, provider fallback, ML client, geo intelligence, PDF route error handling, and agentic services.

Notable backend runtime notes:

- SQLite emitted experimental Node warnings.
- Gemini provider health logged invalid API key; fallback/provider tests still passed.
- Some tests intentionally logged clean error cases and provider fallback warnings.

## Frontend Test Result

The full frontend suite does not currently produce a final result within the allowed audit window. After narrowing:

- `AppLayout.test.tsx`: passed.
- `UploadPage.test.tsx`: passed.
- `GeoIntelligence.schema.test.tsx`: passed.
- `ChatPage.schemaOnly.test.tsx`: originally timed out; after fixing `ChatInterface`, it terminates but fails 2 interaction assertions.

Chat test failure details:

- The empty-state test passes.
- The active dataset chat response test fails because the expected assistant response does not render.
- The invalid-field test fails because the expected validation error does not render.
- The DOM snapshot shows the input value remained empty and send button disabled, suggesting the test interaction/mocking path is still not submitting the prompt.

## Lint Result

`npm run lint` fails with existing frontend lint debt:

- 27 errors.
- 81 warnings.
- Main error categories:
  - `@typescript-eslint/no-explicit-any` in frontend tests, `dataApi.ts`, `schemaLocalAnalytics.ts`, and `useDashboardAiController.ts`.
  - Unused imports/variables.
  - React hook dependency warnings.

I fixed two `any` usages in `ChatInterface.tsx`, reducing lint errors from 29 to 27. I did not blanket-disable lint rules or weaken tests.

## React Doctor Result

`npx react-doctor@latest --verbose --diff` completed successfully with a 75/100 score.

Warnings included:

- Missing effect dependencies in `ChatInterface.tsx`.
- Fetching inside a React effect in `ChatInterface.tsx`.
- Large components in chat/upload/schema dashboard areas.
- Heavy eager imports in chart/ML components.
- Index keys and Framer Motion import concerns in schema dashboard chat.

The missing-dependency warning in `ChatInterface.tsx` is related to the loop fix made in this audit. It should be revisited with a deeper refactor, ideally by moving history mapping into a stable callback or adopting a query/cache abstraction, rather than reintroducing the unstable dependency loop.

## Bug Fixed

Fixed a frontend chat render/effect loop in `apps/frontend/src/features/chat/components/ChatInterface.tsx`.

Root cause:

- `loadDashboardState(dataset.id)` returned new object references on every render.
- Those objects fed `buildCommandCenterModel`.
- The chat-history effect depended on derived model arrays.
- Loading history set state, causing another render and another history load.

Fix:

- Memoized the stored dashboard state by dataset id.
- Reduced chat-history effect dependencies to dataset identity/name.
- Typed backend chat history mapping and error handling.

Impact:

- `ChatPage.schemaOnly.test.tsx` no longer times out.
- Remaining chat test failures are now visible and should be fixed next.

## Builds

Backend build:

- Passed syntax check.

Frontend build:

- Passed production build.
- Vite warning: `assets/index-*.js` exceeds 500 kB after minification. This is a performance/code-splitting concern, not a correctness failure.

## Tests Not Run

- Playwright E2E suite was not run in this turn because frontend unit test/lint issues already exposed blockers, and E2E likely needs coordinated dev servers.
- Python ML service tests were not run in this turn.
- Live PDF upload with an actual PDF fixture was not run in this turn.

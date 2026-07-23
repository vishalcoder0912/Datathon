# E2E Report

Audit date: 2026-06-04

## Playwright

Command: `npm run test:e2e`

Result: 8 passed.

Covered flows:

- Dataset upload and dashboard rendering.
- Dashboard creation via mocked schema dashboard API.
- Chart creation and custom chart chat commands.
- KPI generation.
- Filter clearing.
- PDF upload and mocked Q&A.
- Invalid dashboard request safety.
- Schema-only safety sentinel check.
- AI provider fallback rendering.

## Live Browser Validation

Command: `node tools/qa/live-browser-validation.mjs`

Fresh result before fixes:

- Overall: 62/100.
- Verdict: NOT PRODUCTION READY.
- Data accuracy: 100.
- Chart validation: 100.
- Dashboard control: 25.
- Hallucination resistance: 25.
- Security: 0.
- Performance: 0.

Evidence directory: `reports/browser-validation/2026-06-04T12-09-25-180Z`

Failures included KPI tampering prompts, hallucination prompts, data leakage prompts, chat staying disabled, dashboard control commands not completing, and browser console errors.

## Retest Limitation

After patching, deterministic unit/build/e2e tests passed again. A second live validation could not complete because the frontend dev server on `5173` had stopped and the environment rejected the background restart request due a usage-limit guard.

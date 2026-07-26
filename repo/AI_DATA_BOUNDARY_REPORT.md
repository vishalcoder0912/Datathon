# InsightFlow AI Data Boundary Report

Generated: 2026-06-05

## Boundary Rule

For normal uploaded datasets, AI should receive schema/profile/aggregated context only. It should not receive full rows, full CSV/XLSX/JSON contents, or row-by-row records.

For PDF Intelligence, extracted PDF text/chunks are allowed because document Q&A requires document content. Long documents should use chunk retrieval.

## Dataset AI: Verified Schema-Only Paths

Backend dataset chat:

- File: `apps/backend/src/services/llama-chat-agent.js`
- Builds `facts` with `buildDatasetFacts(dataset)`.
- Constructs `safeContext` containing dataset name, row count, column count, columns, numeric stats, categorical top values, and privacy flags.
- Explicit privacy flags: `schemaOnly: true`, `rawRowsSentToAI: false`.
- The prompt includes `JSON.stringify(safeContext)`, not `dataset.rows`.
- Invalid columns are rejected before model call.

Schema packet builder:

- File: `apps/backend/src/services/schema-packet-builder.js`
- `buildSchemaPacket` samples rows locally for statistics but returns only metadata: row count, column count, column stats, top categorical values, warnings, semantic roles, categories/date ranges.
- Tests assert `packet.rows` and `packet.data` are absent.

Dashboard AI:

- File: `apps/backend/src/services/dashboard-ai-agent.js`
- Uses rows locally for chart/KPI execution.
- LLM planner receives `buildCompactSchemaPacket(dataset)` plus `retrieveStatsContext(...)`, not raw rows.
- Plans are guardian-validated before local execution.

Schema-only dashboard engine:

- File: `apps/backend/src/services/schema-only-dashboard-engine.js`
- Builds a safe schema packet with per-column role, null counts, unique counts, numeric stats, top values, and PII risk.
- PII-like columns are marked `allowedForAI: false`.
- LLM planner prompt says never generate chart data arrays.

Provider safety:

- Backend tests include leakage detection for Gemini and Ollama provider paths.
- `npm run test:backend` passed 246 tests, including schema-only safety and provider fallback suites.

## Dataset AI Risks

- Some schema-training and RAG routes accept `dataset` or `rows` in request bodies to build local profiles/training context. This is acceptable only if downstream LLM calls use profiles, not rows. Core tests cover many of these paths, but route-level review should continue whenever new provider calls are added.
- Frontend API methods for `sendDashboardCommand` and `sendSchemaChat` currently pass `columns` but not `rows`; this supports the schema-only boundary. Dashboard local calculations still use rows in-browser, which is expected.
- Logs should stay aggregated. Import logs currently print dataset name, row count, and column count, not row data.

## PDF AI: Verified Content/Chunk Paths

PDF import:

- File: `apps/backend/src/routes/pdf.js`
- `/api/pdf/import` parses a PDF, builds extracted dataset, tables, text elements, and chunks.
- Response privacy flags: `rawPdfSentToLLM: false`, `extractedTextCanBeUsedForRAG: true`, `dashboardValuesCalculatedLocally: true`.

PDF Q&A:

- File: `apps/backend/src/services/pdf/pdf-qa-service.js`
- `searchPdfChunks` tokenizes query and retrieves top matching chunks.
- `answerPdfQuestion` sends only matched chunk content as `PDF Context` to Ollama.
- If Ollama is unavailable, response falls back to source snippets.
- Sources include source number, chunk id, and preview.

PDF boundary conclusion:

- PDF AI correctly uses extracted chunk context rather than fake PDF stats.
- This differs from dataset AI by design: PDF Q&A needs extracted document content.

## Test Evidence

Passed backend suites include:

- `schema-only-safety.test.js`
- `ollama-schema-safety.test.js`
- `hybrid-ai-system.test.js`
- `schema-packet-builder.test.js`
- `chat-routes.test.js`
- `pdf-intelligence.test.js`

Important observed logs:

- Provider leakage tests intentionally reported detection messages for payloads containing `dataset.rows`; the tests still passed because the detection/fallback behavior worked.
- Gemini health logged invalid API key, but backend provider fallback tests passed.

## Boundary Verdict

Dataset AI boundary: Mostly verified and working.

PDF AI boundary: Verified by inspection and partial route test; full real PDF upload E2E still should be rerun.

Critical future guardrail: every new AI provider call should accept a `schemaPacket`/`safeContext` object, never a raw `dataset` object unless a sanitizer is enforced at the provider boundary.


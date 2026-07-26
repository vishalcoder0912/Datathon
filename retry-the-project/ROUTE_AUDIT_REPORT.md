# InsightFlow Route Audit Report

Generated: 2026-06-05

Backend runtime: `apps/backend/src/index.js` -> `apps/backend/src/core/server.js` -> `apps/backend/src/routes/index.js`.

No auth middleware was found on the audited route stack. Treat all listed routes as unauthenticated unless deployed behind external controls.

## Backend Route Inventory

| Method | Path | File | Purpose | Input | Response | Frontend Usage | Coverage / Status |
|---|---|---|---|---|---|---|---|
| GET | `/` | `routes/index.js` | API root metadata | none | API name/endpoints | direct/debug | Working by code inspection |
| GET | `/api/health` | `routes/health.js` | basic health | none | health envelope | status/debug | Covered, passing |
| GET | `/api/health/detailed` | `routes/health.js` | detailed process health | none | system/process/memory | debug | Not specifically tested |
| GET | `/api/health/ping` | `routes/health.js` | ping | none | pong | debug | Covered by health route family |
| GET | `/api/health/ready` | `routes/health.js` | readiness | none | checks | infra | Code has CommonJS `require` inside ESM function; should be live-tested |
| GET | `/api/health/live` | `routes/health.js` | liveness | none | live status | infra | Not specifically tested |
| GET | `/api/state` | `routes/state.js` and early e2e compat | hydrate app state | none | dataset/chat/analysis state | `DataContext` | Covered, passing |
| PUT | `/api/state` | `routes/state.js` | update app state | state payload | state | frontend state | Not specifically tested |
| POST | `/api/state/reset` | `routes/state.js` | reset app state | none | reset state | frontend/debug | Not specifically tested |
| GET | `/api/datasets` | `routes/datasets.js` | list datasets | none | dataset summaries | possible admin/list | Covered indirectly |
| POST | `/api/datasets/demo` | `routes/datasets.js` | load demo sales dataset | none | dataset, chatMessages, analysis | upload/dashboard empty state | Covered indirectly |
| POST | `/api/datasets/import` | `routes/datasets.js` | import parsed dataset | name, rows, columns | dataset, analysis | upload flow | Covered, passing |
| POST | `/api/datasets/merge` | `routes/datasets.js` | classify/merge multi-file upload | datasets[] | merged dataset, analysis | upload multi-file | Needs broader E2E |
| GET | `/api/datasets/:id` | `routes/datasets.js` | get dataset | id | dataset | data/table/debug | Covered indirectly |
| DELETE | `/api/datasets/:id` | `routes/datasets.js` | delete dataset | id | datasetId | data management | Not specifically tested |
| PATCH | `/api/datasets/:id/rows/:rowId` | `routes/datasets.js` | edit dataset row | column,value | dataset | data table | Covered in architecture tests |
| GET | `/api/datasets/:id/schema` | `routes/analytics.js` | schema packet | id | schema | schema/data/API clients | Covered, passing |
| GET | `/api/datasets/:id/analyze` | `routes/analytics.js` | dataset profile/analysis | id | analysis | analytics | Covered |
| GET | `/api/datasets/:id/ai-correlations` | `routes/analytics.js` | correlations | id | correlations | analytics | Covered, passing |
| GET | `/api/datasets/:id/ai/profile` | `routes/analytics.js` | profile | id | profile | analytics | Covered, passing |
| GET | `/api/datasets/:id/ai/anomalies` | `routes/analytics.js` | anomaly detection | id | anomalies | analytics | Covered, passing |
| GET | `/api/datasets/:id/ai/relationships` | `routes/analytics.js` | relationship classification | id | relationships | analytics | Covered lightly |
| GET | `/api/datasets/:id/ai/cleaning` | `routes/analytics.js` | cleaning suggestions | id | suggestions | analytics | Covered, passing |
| GET | `/api/datasets/:id/auto-charts` | `routes/analytics.js` | chart recommendations | id | charts | dashboards/legacy | Not specifically tested |
| POST | `/api/datasets/:id/chat` | `routes/chat.js` | dataset chat | query | userMessage, assistantMessage | `/chat` | Backend covered, passing |
| GET | `/api/datasets/:id/chat/history` | `routes/chat.js` | chat history | id | messages | `/chat` | Covered by frontend/backend tests; frontend interaction failing |
| DELETE | `/api/datasets/:id/chat/history` | `routes/chat.js` | clear chat history | id | messages[] | possible UI | Not specifically tested |
| POST | `/api/datasets/:id/dashboard-command` | `routes/schema-trained-ai.routes.js` before `routes/chat.js` | schema-trained dashboard command | query, currentDashboard, optional rows/columns | dashboard action | dashboard/chat API client | Covered, passing |
| GET | `/api/ai/schema-training-memory` | `routes/schema-trained-ai.routes.js` | memory stats/data | none | memory | schema training UI | Covered |
| POST | `/api/ai/schema-training/train-memory` | `routes/schema-trained-ai.routes.js` | bulk train memory | datasets[] | trained count | tooling | Covered |
| GET | `/api/ai/schema-rag-memory` | `routes/schema-trained-ai.routes.js` | RAG memory | none | memory | schema RAG UI | Covered |
| POST | `/api/ai/schema-rag/train` | `routes/schema-trained-ai.routes.js` | train schema RAG | dataset/schemaProfile | result | tooling | Covered |
| POST | `/api/ai/schema-rag/retrieve` | `routes/schema-trained-ai.routes.js` | retrieve schema memories | schemaProfile/dataset | matches | schema RAG | Covered |
| POST | `/api/datasets/:id/schema-rag-train` | `routes/schema-trained-ai.routes.js` | train current dashboard pattern | dataset id + body | result | dashboard | Covered |
| POST | `/api/datasets/:id/schema-understand` | `routes/schema-trained-ai.routes.js` | schema explanation | dataset | explanation | schema UI | Covered |
| POST | `/api/datasets/:id/smart-rag-dashboard` | `routes/schema-trained-ai.routes.js` | smart dashboard context | dataset | dashboard/context | dashboard | Covered |
| POST | `/api/datasets/:id/smart-rag-train` | `routes/schema-trained-ai.routes.js` | smart RAG training | dataset | result | tooling | Covered |
| POST | `/api/datasets/:id/schema-dashboard` | `routes/schema-trained-ai.routes.js` | schema dashboard | dataset/schema | dashboard/profile | dashboard | Covered |
| POST | `/api/datasets/:id/schema-train` | `routes/schema-trained-ai.routes.js` | train dashboard plan | dashboardPlan/rating | entry | dashboard | Covered |
| POST | `/api/datasets/:id/schema-chat` | `routes/schema-trained-ai.routes.js` | schema chat | query/runtimeContext | chat response | schema chat client | Covered |
| POST | `/api/dashboard-ai/generate` | `routes/dashboardAiRoutes.js` | schema-only dashboard generation | rows,dictionary,name | schemaProfile/dashboard | dashboard AI | Covered lightly |
| POST | `/api/dashboard-ai/command` | `routes/dashboardAiRoutes.js` | dashboard command | query,rows,currentDashboard | action/chart/fix | dashboard AI | Covered lightly |
| POST | `/api/dashboard-ai/fix` | `routes/dashboardAiRoutes.js` | validate/fix dashboard | rows,currentDashboard | corrected dashboard | dashboard AI | Covered |
| POST | `/api/dashboard/chart-query` | `routes/dashboard-chart-handler.js` | RAG/custom chart query | query,datasetId,charts | chart/confidence/context | dashboard | Covered, passing |
| POST | `/api/dashboard/remove-chart` | `routes/dashboard-chart-handler.js` | remove chart command | chartId | removedChartId | dashboard | Covered |
| POST | `/api/datasets/:id/dashboard-validate-fix` | `routes/dashboard-quality.js` | dashboard quality validation | currentDashboard | correctedDashboard/issues | dashboard | Covered |
| GET | `/api/ai/providers/health` | `routes/ai.js` | provider health | none | health | sidebar/status | Covered; Gemini key invalid in logs |
| GET | `/api/ai/ollama/health` | `routes/ai.js` | Ollama health | none | model status | status | Covered |
| GET | `/api/ai/ollama-status` | `routes/ai.js` | dual Ollama status | none | status | status | Covered |
| GET | `/api/ai/status` | `routes/ai.js` | AI manager status | none | status | status | Covered |
| GET | `/api/ai/providers` | `routes/ai.js` | available providers | none | providers | status | Covered |
| GET | `/api/ai/stats` | `routes/ai.js` | AI usage stats | none | stats | debug | Covered |
| POST | `/api/ai/test` | `routes/ai.js` | test generation | prompt/provider | response | debug | Covered indirectly |
| POST | `/api/ai/chat` | `routes/ai.js` | test chat | messages | response | debug | Covered indirectly |
| POST | `/api/ai/switch` | `routes/ai.js` | switch active provider | provider | status | debug | Covered |
| POST | `/api/ai/reset-stats` | `routes/ai.js` | reset stats | none | stats | debug | Covered |
| GET | `/api/cascade/status` | `routes/ai.js` | cascade provider status | none | cascade | API client | Covered |
| POST | `/api/pdf/import` | `routes/pdf.js` | PDF import/extraction | multipart PDF | pdf,dataset,analysis,privacy | `/pdf` | Backend code inspected; full upload not run |
| POST | `/api/pdf/:pdfId/ask` | `routes/pdf.js` | PDF Q&A | query | answer,sources | `/pdf` | Covered unknown-PDF; chunk behavior inspected |
| POST | `/api/qr-upload/generate` | `routes/qr-upload.js` and duplicate in `routes/ai.js` | QR upload session | workspace/portal | session QR | upload page | Duplication risk; code exists |
| GET | `/api/qr-upload/:sessionId/status` | `routes/qr-upload.js` and duplicate in `routes/ai.js` | QR status | token query | status/files/dataset | upload page | Duplication risk |
| GET | `/api/qr-upload/:sessionId/upload` | `routes/qr-upload.js` | mobile portal redirect/page | token query | redirect/html | mobile upload | Needs live verification |
| POST | `/api/qr-upload/:sessionId/upload` | `routes/qr-upload.js` | mobile file upload | multipart files | status/dataset | mobile upload | Needs live verification |
| GET | `/api/ml/health` | `routes/ml-analytics.js` before `machine-learning.js` | ML service health | none | ready/unavailable | ML page/API | Covered; graceful offline |
| POST | `/api/ml/profile` | `routes/ml-analytics.js` | ML profile | rows/dataset | result | ML/analytics | Covered |
| POST | `/api/ml/correlations` | `routes/ml-analytics.js` | ML correlations | rows/dataset | result | ML/analytics | Covered |
| POST | `/api/ml/anomalies` | `routes/ml-analytics.js` | ML anomalies | rows/dataset | result | ML/analytics | Covered |
| POST | `/api/ml/feature-importance` | `routes/ml-analytics.js` | feature importance | rows,target | result | ML page | Covered |
| POST | `/api/ml/train-model` | `routes/ml-analytics.js` | train model gateway | rows,target | result | ML page | Covered |
| POST | `/api/ml/predict` | `routes/ml-analytics.js` | predict gateway | model/input | result | ML page | Covered |
| POST | `/api/ml/cluster` | `routes/ml-analytics.js`/`machine-learning.js` | cluster | rows | result | ML | Covered partially |
| POST | `/api/ml/compare-datasets` | `routes/ml-analytics.js` | compare datasets | datasets | result | ML | Covered |
| POST | `/api/ml/rag-training-records` | `routes/ml-analytics.js` | RAG records | data | result | tooling | Not specifically tested |
| GET | `/api/ml/models` | `routes/machine-learning.js` if reached | model list | none | models | ML page | Route order may shadow with compat/gateway |
| GET | `/api/ml/models/:id` | `routes/machine-learning.js` | model info | id | model | ML page | Not specifically tested |
| DELETE | `/api/ml/models/:id` | `routes/machine-learning.js` | delete model | id | result | ML page | Not specifically tested |
| POST | `/api/datasets/:id/ml/:operation` | `routes/ml-analytics.js` | dataset-scoped ML operation | operation body | result | ML/analytics | Covered partially |
| POST | `/api/agentic/analyze` | `routes/agentic-api.js` | agentic analysis | goal,dataset/schema | agent result | `/agentic` | Covered |
| GET | `/api/agentic/agents` | `routes/agentic-api.js` | list agents | none | agents | `/agentic` | Covered |
| GET | `/api/agentic/workflows` | `routes/agentic-api.js` | workflows | none | workflows | `/agentic` | Covered |
| GET | `/api/agentic/health` | `routes/agentic-api.js` | agentic health | none | status | `/agentic` | Covered |
| GET | `/api/agentic/metrics` | `routes/agentic-api.js` | agentic metrics | none | metrics | `/agentic` | Covered |
| GET | `/api/agentic-models/config` | `routes/agentic-models.js` | public model config | none | config | frontend API | Covered |
| GET | `/api/agentic-models/health` | `routes/agentic-models.js` | model health | none | checks | frontend API | Covered |
| POST | `/api/agentic-models/datasets/:id/analyze` | `routes/agentic-models.js` | model-aware analysis | goal/schema_only | analysis/actions | frontend API | Covered |
| POST | `/api/agentic-models/datasets/:id/chat` | `routes/agentic-models.js` | model-aware chat | message/query | response | possible UI | Covered lightly |
| POST | `/api/agentic-ds/datasets/:id/full-analysis` | `routes/agentic-data-science.js` | full data science analysis | dataset/schema | analysis | `/agentic-data-science` | Covered lightly |
| POST | `/api/insight-flow/analyze` | `routes/insight-flow.js` | master analytics pipeline | rows,columns,goal | result | schema client | Covered |
| POST | `/api/insight-flow/validate` | `routes/insight-flow.js` | self-critic validation | dashboard/schema | validation | schema client | Covered |
| POST | `/api/datasets/:id/playbook-analysis` | `routes/playbook-analysis.js` | DataAnalyticsProjects playbook | dataset id | analysis | API client | Covered |
| POST | `/api/datasets/:id/ai-analyst/analyze` | `routes/ai-analyst.routes.js` | AI analyst run | id | analysis | API client | Covered |
| POST | `/api/datasets/:id/ai-analyst/command` | `routes/ai-analyst.routes.js` | analyst command | command/currentAnalysis | result | API client | Covered |
| POST | `/api/datasets/:id/analytics-brain` | `routes/analytics-brain.js` | schema-safe analytics brain | id | result | API client | Covered |
| POST | `/api/analytics-brain/feedback` | `routes/analytics-brain.js` | feedback | pattern/action/rating | result | API client | Not specifically tested |
| GET | `/api/analytics-brain/memory` | `routes/analytics-brain.js` | brain memory | none | memory | debug | Not specifically tested |
| GET | `/api/datasets/:id/export/json` | `routes/export.js` | dataset JSON export | id | file download | export API | Covered lightly |
| GET | `/api/datasets/:id/export/csv` | `routes/export.js` | dataset CSV export | id | file download | export API | Covered lightly |
| GET | `/api/datasets/:id/export/md` | `routes/export.js` | markdown export | id | file download | export API | Covered lightly |
| POST | `/api/datasets/:id/export/report` | `routes/export.js` | JSON report | id | report | export UI/API | Not specifically tested |
| GET/POST | e2e compatibility routes | `routes/e2e-compat.routes.js` | legacy/e2e shims for state, local import, schema AI query, ML, dataset chat, etc. | mixed | mixed | E2E tests | Useful but can shadow canonical behavior |

## Frontend Route Inventory

| Route | Page component | Feature | Required data/context | API calls | Empty/Error State | Status |
|---|---|---|---|---|---|---|
| `/` | `EliteDashboardPage` | main dashboard | dataset optional | state/demo via context | yes | Working/builds |
| `/dashboard` | `EliteDashboardPage` | dashboard | dataset optional | state/demo/context | yes | Working/builds |
| `/upload` | `UploadPage` | CSV/XLSX/JSON/QR upload | none | import/merge/QR/status | yes | Individual test passed |
| `/pdf` | `PdfUploadPage` | PDF Intelligence | optional active PDF/dataset | pdf import/ask | yes | Builds; needs live upload E2E |
| `/pdf-upload` | `PdfUploadPage` | PDF Intelligence alias | optional | pdf import/ask | yes | Builds |
| `/chat` | `ChatPage` -> `ChatInterface` | AI chat | dataset optional | chat history/chat | yes | Loads; interaction test failing |
| `/local-chat` | `LocalChatPage` | local SQL-like chat | local dataset | local import/schema-ai/local-query compat | yes | Builds; less covered |
| `/data` | `DataTablePage` | data table | dataset | row update/export/context | yes | Builds |
| `/analytics` | `AnalyticsPage` | analytics hub | dataset | analytics APIs/context | yes | Builds/tests exist |
| `/agentic` | `AgenticPage` | agentic UI | dataset optional | agentic APIs | yes | Builds |
| `/analytics/profile` | `DataProfilingPage` | profile | dataset | analytics/context | yes | Builds |
| `/analytics/anomalies` | `AnomalyDetectionPage` | anomalies | dataset | analytics/context | yes | Builds |
| `/analytics/relationships` | `RelationshipsPage` | relationships | dataset | analytics/context | yes | Builds |
| `/analytics/cleaning` | `DataCleaningPage` | cleaning | dataset | analytics/context | yes | Builds |
| `/analytics/export` | `ExportPage` | export | dataset | export APIs/local | yes | Builds |
| `/agentic-data-science` | `AgenticDataSciencePage`/ML alias | data science | dataset optional | ML/agentic DS | yes | Builds |
| `/ml` | `MLPage` | train/predict UI | dataset/manual | `/api/ml/train`, `/api/ml/predict` | yes | Builds |
| `/mobile-upload/:sessionId` | `MobileUploadPortal` | mobile upload portal | QR session token | QR status/upload | yes | Builds; needs live E2E |
| `*` | `NotFoundPage` | 404 | none | none | yes | Builds |

## Route Bugs / Risks Found

- `routes/health.js` uses `require('fs')` inside an ESM module in `checkReadiness`; `/api/health/ready` should be live-tested and may fail depending on runtime.
- QR upload routes are duplicated in `routes/ai.js` and `routes/qr-upload.js`; route order currently favors `qr-upload.js`, but duplicate ownership is risky.
- E2E compatibility routes are registered before canonical dataset/chat/analytics routes and may mask route behavior in tests.
- Frontend `/chat` had a repeated history-load/render cycle. Fixed in `ChatInterface.tsx`.
- Frontend `/chat` schema-only test now terminates but still fails because the test interaction does not submit the mocked prompt.


# InsightFlow Project Understanding Report

Generated: 2026-06-05

## What This Project Is

InsightFlow is an AI-assisted data analytics application. It combines a React/TypeScript/Tailwind frontend, a Node HTTP backend, a Python FastAPI/uvicorn ML service, local/browser dataset processing, schema-aware dashboard generation, AI chat, PDF Intelligence, Geo Intelligence, Agentic AI workflows, exports, and ML analytics fallbacks.

The implementation is not a thin mock. The repo contains working backend route handlers, SQLite-backed dataset persistence, frontend pages, local dashboard calculation engines, schema/profile builders, Ollama/Gemini/Anthropic provider routing, PDF extraction/RAG services, QR upload support, test fixtures, Vitest suites, and Playwright E2E specs.

## Tech Stack

- Root workspace: npm workspaces.
- Frontend: React 18, TypeScript, Vite, Tailwind, React Router, Recharts, lucide-react, Vitest/jsdom.
- Backend: Node ESM HTTP server, custom route aggregator, SQLite via repository layer, Vitest.
- ML service: Python FastAPI app at `apps/ml-service/app.py`, started with `python -m uvicorn`.
- AI providers: Ollama local models, Gemini, Anthropic, OpenAI provider scaffolding, cascade/router services.
- PDF: `@opendataloader/pdf`, PDF table/text extraction, chunked PDF knowledge base, local Ollama Q&A fallback.

## Package Scripts

Root scripts:

- `npm run dev`: starts backend, frontend, and ML service concurrently.
- `npm run dev:frontend`: Vite frontend.
- `npm run dev:backend`: Node backend.
- `npm run dev:ml`: uvicorn ML service on `127.0.0.1:8000`.
- `npm run test:backend`: backend Vitest run.
- `npm run test:frontend`: frontend Vitest run.
- `npm run test:e2e`: Playwright.
- `npm run build:frontend`: Vite production build.
- `npm run build:backend`: Node syntax check.
- `npm run lint`: frontend ESLint.

Frontend scripts:

- `dev`, `build`, `build:dev`, `lint`, `preview`, `test`, `test:watch`.

Backend scripts:

- `dev`, `dev:watch`, `start`, `build`, `test`, `test:run`, schema/RAG/agentic training exports.

## Architecture

Frontend architecture:

- Entry: `apps/frontend/src/main.tsx` -> `App.tsx` -> `AppProviders.tsx` -> `AppRouter.tsx`.
- Routes are lazy-loaded behind `AppLayout`.
- Shared layout: sidebar, command top bar, theme/status components.
- Data state: `DataContext`, `localDataContext`, `data-context-store`, and browser-local dashboard state.
- Data upload parses local CSV/XLSX/JSON, imports datasets through backend, and supports QR/mobile upload.
- Dashboard uses schema-aware local engines (`commandCenterAnalytics`, `dashboardAnalytics`, `insightFlowEngine`) to calculate KPIs, charts, filters, geo, insights, and audit trail from actual rows.

Backend architecture:

- Entry: `apps/backend/src/index.js` -> `src/core/server.js` -> `src/routes/index.js`.
- Routing is a custom async dispatcher, not a standard Express router.
- Route groups are ordered intentionally: ML gateway and e2e compatibility routes run early; schema-trained routes run before legacy chat/dashboard handlers.
- Dataset persistence is handled through `database/dataset-repository.js`.
- Most analytics and dashboard values are calculated locally; LLMs are used for planning, narrative, and command interpretation with schema/profile constraints.

AI architecture:

- Dataset chat: `llama-chat-agent.js` builds a safe schema/facts context and calls Ollama; fallback answers use computed facts.
- Dashboard AI: uses compact schema packets plus local statistical context, then locally validates and executes chart plans against rows.
- Schema-trained AI: routes provide schema dashboard, schema chat, RAG memory, smart dashboard training, and dashboard command support.
- Provider routing: Ollama/Gemini/Anthropic/OpenAI services exist with tests for fallback and leakage detection.

Dataset flow:

1. Frontend parses CSV/XLSX/JSON or receives QR/mobile/PDF imports.
2. Backend creates dataset with columns/rows and persists it.
3. State route hydrates current dataset to frontend.
4. Dashboard and analytics engines infer schema and calculate results from rows.
5. AI receives schema/profile/facts, not full raw rows, for normal dataset chat/planning.

Dashboard flow:

- `EliteDashboardPage` builds a `CommandCenterModel` from rows, filters, manual charts/KPIs, and stored dashboard state.
- KPIs/charts/insights/geo are calculated locally from current filtered rows.
- Dashboard chat commands are interpreted locally in the frontend and/or by schema-only backend services.
- Audit trail is stored in browser dashboard state.

PDF flow:

1. Frontend uploads PDF to `/api/pdf/import`.
2. Backend parses PDF through OpenDataLoader.
3. `pdf-dataset-builder` creates extracted dataset, tables, text elements, and chunks.
4. Dataset rows from extracted tables are persisted.
5. PDF Q&A retrieves relevant chunks and sends extracted PDF context to local Ollama.

Chat flow:

- `/chat` renders `ChatInterface`.
- If no dataset exists, chat gives a local empty-state response.
- If a dataset exists, it loads `/api/datasets/:id/chat/history` and posts to `/api/datasets/:id/chat`.
- Backend validates referenced columns and returns clean 400 errors for invalid fields.

Geo Intelligence flow:

- Frontend detects geo columns by country/state/city/region/location keywords.
- It picks a metric using domain-aware priority: revenue/profit/sales, salary, billing, rating, amount, quantity, etc.
- It normalizes location names, groups rows, computes top/bottom locations, average metric, total records, and summary insight.

Testing structure:

- Backend Vitest: `apps/backend/src/__tests__`, including route, schema, AI safety, analytics, dashboard, ML, geo, and agentic tests.
- Frontend Vitest: `apps/frontend/src/__tests__` and `src/test`.
- Fixtures: `tests/fixtures` contains sales, salary, student, invalid mixed, and mock PDF text datasets.
- E2E: `e2e/*.spec.ts` includes dashboard/chat/custom chart, schema safety, upload, PDF, geo, analytics, provider fallback, and invalid command flows.


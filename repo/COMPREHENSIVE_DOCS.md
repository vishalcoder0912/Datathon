# KAVACH AI — Comprehensive Documentation

**Karnataka AI Visualization & Analytics for Crime Hotspots**

A local Datathon 2026 prototype for explainable, aggregated crime-intelligence analysis. Built with React/TypeScript frontend, Node.js backend, PostgreSQL 16 + PostGIS, optional FastAI analytics, and local Ollama LLM for explainability.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Project Structure](#3-project-structure)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Database Schema](#6-database-schema)
7. [ML Service (FastAPI)](#7-ml-service-fastapi)
8. [Agentic AI Analytics Pipeline](#8-agentic-ai-analytics-pipeline)
9. [Copilot Architecture](#9-copilot-architecture)
10. [Security & RBAC](#10-security--rbac)
11. [Analytics Methods](#11-analytics-methods)
12. [PDF Intelligence](#12-pdf-intelligence)
13. [AI Provider Routing](#13-ai-provider-routing)
14. [API Reference](#14-api-reference)
15. [Deployment Guide](#15-deployment-guide)
16. [Testing](#16-testing)
17. [Configuration Reference](#17-configuration-reference)
18. [Safety Boundaries](#18-safety-boundaries)
19. [Future Production Work](#19-future-production-work)
20. [Appendix: Key Files & Their Purposes](#20-appendix-key-files--their-purposes)

---

## 1. Project Overview

**What it is:** KAVACH AI is a local-first, explainable crime-intelligence analytics platform. It processes FIR-shaped crime data to produce hotspots, trends, alerts, anomalies, risk scores, case networks, and MO similarity — all with deterministic calculations and optional local-LLM explanations.

**Core design principles:**

- **No paid API required** — works entirely offline with local LLM (Ollama)
- **No hosted vector database** — PostgreSQL/PostGIS is the source of truth
- **No cloud authentication** — local JWT with bcrypt
- **Deterministic analytics** — LLM never invents metrics; all numbers come from code
- **Explainability first** — every output states confidence, limitations, data source, period, and human-review status

**Project names:** Internally referenced as both **KAVACH AI** (primary) and **InsightFlow** (package name).

---

## 2. System Architecture

```
React + TypeScript + TanStack Query + MapLibre + Cytoscape
                    |
                  REST/SSE
                    v
    Existing Node.js HTTP backend — auth, RBAC, audit, approved tools
                    |
             parameterized SQL
                    v
          PostgreSQL 16 + PostGIS
             |                  |
             v                  v
 FastAPI analytics service   local Ollama (optional)
```

**Data flow:**
1. Frontend (Vite :5173) → REST/SSE calls to Node backend
2. Node backend (:3001) → parameterized SQL to PostgreSQL/PostGIS
3. Node backend → internal FastAPI calls for bounded analytics
4. Node backend → local Ollama for copilot explanations
5. Frontend never calls FastAPI or Ollama directly

**Data source modes:**
- `KAVACH_DATA_SOURCE=postgres` — default persistent mode
- `KAVACH_DATA_SOURCE=file-demo` — synthetic file fallback (UI-labelled)

---

## 3. Project Structure

```
DATATHON/
├── apps/
│   ├── frontend/               # React + Vite + TypeScript UI
│   │   ├── src/
│   │   │   ├── app/            # App entry, routes, providers
│   │   │   ├── features/       # Domain features
│   │   │   │   ├── agents/     # Agentic AI UI
│   │   │   │   ├── analytics/  # Analytics pages
│   │   │   │   ├── chat/       # AI chat interface
│   │   │   │   ├── dashboard/  # Core dashboard pages
│   │   │   │   ├── data/       # Data table views
│   │   │   │   ├── ml/         # ML training UI
│   │   │   │   └── pdf/        # PDF intelligence UI
│   │   │   ├── kavach/         # KAVACH command-centre pages
│   │   │   │   └── ...         # Maps, graphs, auth-aware API client
│   │   │   ├── shared/         # Shared components, hooks, utils
│   │   │   ├── api/            # API client layer
│   │   │   ├── auth/           # Auth context & helpers
│   │   │   └── types/          # TypeScript types
│   │   └── vite.config.ts
│   │
│   ├── backend/                # Node.js HTTP API
│   │   ├── src/
│   │   │   ├── server.js       # Entry point (shim → index.js)
│   │   │   ├── index.js        # Bootstrap
│   │   │   ├── core/           # Core server framework
│   │   │   ├── config/         # Environment & app config
│   │   │   ├── routes/         # 33 route modules
│   │   │   ├── services/       # 58 service modules
│   │   │   ├── kavach/         # KAVACH domain (repositories, services, validators)
│   │   │   ├── agents/         # Agent orchestration (base-agent, orchestrator, etc.)
│   │   │   ├── genai/          # GenAI building blocks (analytics engine, dashboard builder)
│   │   │   ├── auth/           # JWT, bcrypt, RBAC enforcement
│   │   │   ├── middleware/     # Error, validation, logger, rate-limit
│   │   │   ├── db/             # Database connection, migrations
│   │   │   ├── database/       # Dataset repository layer
│   │   │   └── utils/          # Helpers & validators
│   │   └── prompts/            # LLM prompt templates
│   │
│   └── ml-service/             # Python FastAPI analytics
│       ├── app/
│       │   ├── main.py         # FastAPI entry point
│       │   ├── routers/        # API endpoints
│       │   ├── services/       # Analytics methods
│       │   └── schemas.py      # Pydantic models
│       ├── pdf_intelligence/   # PDF parsing & analysis
│       └── fast_dashboard_engine.py
│
├── packages/
│   ├── kavach-domain/          # Domain types & validation
│   ├── shared-analytics/       # Shared analytics logic
│   └── shared-errors/          # Centralized error classes
│
├── infra/
│   ├── docker-compose.yml      # PostgreSQL 16 + PostGIS
│   ├── postgres/               # Migration files (001-010)
│   └── geo/                    # Synthetic district/station overlays
│
├── docs/                       # 21 documentation files
├── scripts/                    # 16 utility & migration scripts
├── e2e/                        # Playwright E2E tests (12 specs)
├── tools/
│   └── qa/                     # QA report generation tools
├── data/                       # Demo data, SQLite files, PDF store
├── tests/                      # Additional test files
├── graphify-out/               # Knowledge graph output
│
├── package.json                # Root workspace config
├── playwright.config.ts        # E2E test config
├── vercel.json                 # Vercel deployment config
└── gemini-config.js            # Gemini AI config
```

---

## 4. Frontend Architecture

### 4.1 Tech Stack
- **Framework:** React 18+ with TypeScript
- **Build tool:** Vite
- **Styling:** Tailwind CSS
- **State management:** Zustand + TanStack Query (React Query)
- **Routing:** React Router
- **Maps:** MapLibre GL JS + react-simple-maps
- **Graph visualization:** Cytoscape.js
- **Testing:** Vitest + Playwright
- **Linting:** ESLint

### 4.2 Frontend Directory Structure
```
apps/frontend/src/
├── app/
│   ├── App.tsx                 # Root component
│   ├── AppRouter.tsx           # Route definitions
│   └── providers/              # Context providers (auth, query, theme)
│
├── features/
│   ├── agents/                 # Agentic AI control panel
│   ├── analytics/              # Data profiling, correlation pages
│   ├── chat/                   # AI chat interface
│   ├── dashboard/              # Dashboard pages, components, utils, hooks
│   ├── data/                   # Data table & grid views
│   ├── ml/                     # ML model training UI
│   └── pdf/                    # PDF upload & intelligence UI
│
├── kavach/                     # KAVACH command centre
│   ├── pages/                  # Crime-intelligence pages
│   ├── components/             # Map overlays, graphs, alerts
│   └── api/                    # Auth-aware KAVACH API client
│
├── shared/
│   ├── components/             # Reusable UI (buttons, modals, tables)
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Utility functions
│   └── layout/                 # App shell, sidebar, header
│
├── api/                        # Base API client
├── auth/                       # Auth context, login flow
├── types/                      # Shared TypeScript types
├── config/                     # Frontend configuration
└── components/                 # Global components
```

### 4.3 Key Features (Frontend)

| Feature | Description |
|---------|-------------|
| **Dashboard** | KPI cards, charts, data tables — auto-generated from schema |
| **Data Table** | Browse, sort, filter, and edit imported datasets |
| **Analytics** | Profile, anomalies, correlations, distributions |
| **Chat** | Natural-language Q&A over loaded datasets |
| **ML** | Train/predict with AutoML pipeline |
| **Upload** | CSV/XLSX import with schema auto-detection |
| **Export** | JSON, CSV, Markdown export |
| **PDF Intelligence** | Upload & analyze PDF documents |
| **Agentic AI** | Schema-driven AI analytics agent dashboard |
| **KAVACH Maps** | Crime hotspot maps with MapLibre |
| **Case Networks** | Relationship graphs with Cytoscape |

---

## 5. Backend Architecture

### 5.1 Tech Stack
- **Runtime:** Node.js (ESM)
- **Framework:** Express-like custom server (no framework, bare Node)
- **Database:** pg (PostgreSQL), better-sqlite3 (local fallback)
- **Auth:** jsonwebtoken, bcrypt
- **Validation:** Zod
- **AI:** Google Generative AI, OpenAI, Anthropic SDKs, Ollama
- **Storage:** SQLite (default), PostgreSQL/PostGIS (production)
- **Testing:** Vitest

### 5.2 Backend Entry Points
- `src/index.js` — Bootstrap, loads server
- `src/server.js` — Shim that imports `index.js`
- `src/core/server.js` — Core HTTP server implementation

### 5.3 Routes (33 modules)

| Route Module | Purpose |
|---|---|
| `auth.js` | Login, logout, token refresh, registration |
| `kavach.js` | KAVACH crime-intelligence REST API |
| `datasets.js` | Dataset CRUD operations |
| `analytics.js` | Analytics endpoints |
| `chat.js` | AI chat endpoint |
| `health.js` | Health check |
| `agentic.js` | Agentic API entry |
| `agentic-api.js` | Agentic analytics API |
| `agentic-data-science.js` | Data science agent endpoints |
| `agentic-models.js` | Agent model management |
| `agents.js` | Agent orchestration routes |
| `ai-analyst.routes.js` | AI analyst endpoints |
| `ai.js` | General AI endpoints |
| `analytics-brain.js` | Analytics brain (smart queries) |
| `dashboard-chart-handler.js` | Dashboard chart generation |
| `dashboard-quality.js` | Dashboard quality checks |
| `dashboardAiRoutes.js` | AI dashboard routes |
| `data-gateway.js` | Universal data gateway |
| `deep-agentic-training.js` | Deep agentic model training |
| `e2e-compat.routes.js` | E2E test compatibility |
| `export.js` | Data export |
| `insight-flow.js` | InsightFlow pipeline |
| `learning-feedback.js` | Learning feedback loop |
| `machine-learning.js` | ML model endpoints |
| `ml-analytics.js` | ML analytics |
| `ollama-manager-routes.js` | Ollama model management |
| `pdf.js` | PDF intelligence |
| `playbook-analysis.js` | Playbook analysis |
| `qr-upload.js` | QR-based data upload |
| `schema-agent.js` | Schema agent endpoints |
| `schema-trained-ai.routes.js` | Trained schema AI |
| `state.js` | State/session management |

### 5.4 Services (58 modules)

| Category | Services |
|---|---|
| **AI/Chat** | `gemini-ai-service`, `ollama-ai-service`, `ollama-service`, `llama-chat-agent`, `llama-validation-middleware`, `ai-cascade-service`, `ai-data-service`, `ai-analyst/*`, `ai-providers/*` |
| **Analytics** | `analytics-service`, `analytics-engine`, `analytics-brain-service`, `analytics-memory-service`, `analytics-playbook-engine`, `local-statistics-service` |
| **Schema** | `schema-packet-builder`, `schema-packet-worker`, `schema-ai-service`, `schema-detector`, `schema-dashboard-engine`, `schema-only-dashboard-engine`, `schema-agent/*`, `semantic-column-matcher` |
| **Dashboard** | `dashboard-ai-agent`, `dashboard-intent-detector`, `dashboard/*` |
| **Guardian** | `guardian/*` — rejects bad charts, fake fields, impossible claims |
| **ML** | `ml-client`, `ml/*`, `predictive-analytics` |
| **PDF** | `pdf/*` |
| **QR/Upload** | `qr-upload-service`, `qr-upload/*` |
| **Other** | `export-service`, `report-generator`, `data-visualization-service`, `data-merger`, `data-sampling-service`, `dataset-role-detector`, `domain-detector`, `query-cache`, `recommendation-engine`, `pipeline-service`, `alert-service`, `playbooks/*`, `vector/*`, `agentic/*`, `agentic-dashboard/*`, `performance/*` |

### 5.5 Agent Framework
- `agents/base-agent.js` — Abstract base agent with tool-use contract
- `agents/agent-orchestrator.js` — Orchestrates multi-agent workflows
- `agents/data-analyst-agent.js` — Specialized data analysis agent
- `agents/ollama-agent-roles.js` — Ollama-based role definitions
- `agents/index.js` — Agent index/exports

### 5.6 GenAI Building Blocks
- `genai/analyticsEngine.js` + `.ts` — Core analytics engine
- `genai/dashboardBuilder.js` + `.ts` — Dashboard builder
- `genai/reportGenerator.ts` — Report generation

### 5.7 KAVACH Domain
- `kavach/kavach-repository.js` — Abstract repository interface
- `kavach/kavach-services.js` — KAVACH-specific business services
- `kavach/report-pdf.js` — PDF report rendering
- `kavach/repositories/` — Postgres & file-demo implementations
- `kavach/services/` — Alert, hotspot, risk, network services
- `kavach/validators/` — Zod validation schemas
- `kavach/connectors/` — External connector adapters

---

## 6. Database Schema

### 6.1 PostgreSQL 16 + PostGIS

The schema uses snake_case table names with PostgreSQL foreign keys. All demo data is synthetic.

**Migrations** are ordered from `001` to `010` in `infra/postgres/migrations/`:

| Version | Purpose |
|---|---|
| 001 | PostgreSQL extensions (PostGIS, pg_trgm, etc.) |
| 002 | Normalized reference tables (state, district, police_unit, etc.) |
| 003 | Case/FIR tables (case_master, complainants, victims, accused) |
| 004 | Canonical person, locations, MO tables |
| 005 | Analytics, imports, reports, audit tables |
| 006 | Users, refresh tokens, roles |
| 007 | Operational, spatial, and trigram indexes |
| 008 | Frontend-compatible and analytical views |
| 009 | Triggers, status history, crime-number functions |
| 010 | Safe reference seed data |

### 6.2 Core Tables

**Reference Data:**
- `state`, `district`, `unit_type`, `police_unit`
- `gender`, `case_category`, `case_status`
- `gravity_offence`, `crime_head`, `crime_sub_head`
- `act`, `legal_section`

**Case Data:**
- `case_master` — Primary case record with `crime_no`, timestamps, PostGIS point
- `complainant_details`, `victim`, `accused` — Role-specific facts
- `act_section_association`, `arrest_surrender`, `chargesheet_details`
- `case_status_history`
- `crime_number_counter` + `generate_crime_number()` — Atomic ID generation

**Identity & Location:**
- `person`, `person_alias`, `case_person_role`, `person_identity_match`
- `location`, `case_location`, `vehicle`, `case_vehicle`
- `modus_operandi` — Structured fields, extracted features, confidence

**Analytics & Governance:**
- `alert`, `alert_evidence`
- `model_version`, `model_run`, `prediction`, `prediction_factor`
- `district_socioeconomic_indicator` — Aggregate correlations only
- `data_import`, `data_import_error`, `data_quality_issue`
- `audit_log`, `intelligence_report`, `copilot_query`
- `user_account`, `refresh_token`, `role_permission`, `user_case_assignment`

### 6.3 Key Analytics Views

| View | Purpose |
|---|---|
| `analytics.v_incidents` | Legacy incident API shape |
| `analytics.v_incident_persons` | Person-role links |
| `analytics.v_persons_masked` | Masked PII (no phone, address, DOB, complainant data) |
| `analytics.v_district_indicators` | Aggregate research fields only |
| `analytics.v_case_network_edges` | Case-backed edge evidence for graph consumers |

### 6.4 Spatial Features
- SRID 4326 for all spatial columns
- GiST indexes for bounding-box, radius, point-in-district, point-in-station queries
- DBSCAN clustering via PostGIS

### 6.5 Crime Number Format
Generated as: `category + district + station + year + serial` via `generate_crime_number()`.

---

## 7. ML Service (FastAPI)

### 7.1 Overview
A Python FastAPI service providing bounded, explainable analytical methods. Called internally by the Node backend only. Runs on port 5000.

### 7.2 Structure
```
apps/ml-service/
├── app/
│   ├── main.py              # FastAPI app with CORS, routers
│   ├── database.py          # Database connection
│   ├── schemas.py           # Pydantic response models
│   ├── legacy_compat.py     # Legacy compatibility layer
│   ├── routers/
│   │   ├── analytics.py     # REST endpoints for analytics
│   │   └── __init__.py
│   └── services/
│       ├── hotspots.py      # DBSCAN hotspot detection
│       ├── anomalies.py     # IQR, z-score, Isolation Forest
│       ├── trend_alerts.py  # Rolling window alerts
│       ├── risk.py          # Geographic composite risk
│       ├── networks.py      # NetworkX graph analysis
│       ├── mo_similarity.py # MO pattern matching
│       ├── socioeconomic.py # Aggregate research
│       ├── explanations.py  # LLM-powered explanations
│       └── common.py        # Shared utilities
├── pdf_intelligence/        # PDF parsing pipeline
├── fast_dashboard_engine.py # Fast dashboard generation
├── requirements.txt
├── Dockerfile
└── tests/
```

### 7.3 Analytics Methods

| Method | Algorithm | Description |
|---|---|---|
| **Hotspots** | DBSCAN (PostGIS or haversine) | Spatial clustering with min incident count |
| **Emerging Alerts** | Rolling 7-day window vs 28-day baseline | Z-score, percentage increase, dedup |
| **Anomalies** | IQR + z-score + Isolation Forest | Multivariate outlier detection |
| **Risk** | Weighted geographic composite | Transparent score with model version |
| **Networks** | NetworkX (degree, betweenness, PageRank, communities) | Case-link graph analysis |
| **MO Similarity** | Jaccard + trigram + optional embeddings | Pattern matching with evidence |
| **Socioeconomic** | Aggregate correlation (non-causal) | Research-only indicators |

---

## 8. Agentic AI Analytics Pipeline

### 8.1 Architecture
A schema-first analytics system where deterministic calculations stay local and LLMs help with planning, explanation, critique, and natural-language interaction.

**Core rule:** The LLM never invents metrics. It receives schema profiles, dashboard state, column roles, sample-safe summaries, and calculated results.

### 8.2 Agent Pipeline

```
1. Schema Profiler
   → Detect: metrics, dimensions, date fields, entity fields, geo fields
   → Compute: unique counts, missing values, sample values

2. Dashboard Planner
   → Uses schema roles to propose KPIs, charts, filters, story sections

3. Analytics Engine
   → Calculates: averages, medians, totals, rankings, histograms,
     correlations, trends, outliers from real rows

4. Dashboard Guardian
   → Rejects: bad charts, fake date fields, fake geo fields,
     wrong aggregations, impossible claims

5. Insight Writer
   → Converts calculated outputs into plain-language findings

6. Chat Agent
   → Answers user questions using schema, current dashboard state,
     and deterministic results (may call Ollama through backend)
```

### 8.3 Key Quality Rules
- Trend chart must not use Age
- Hospital/entity ranking must say "Entity ranking"
- Map must not fake coordinates
- Insight copy must match dataset domain
- Data preview must work on mobile and desktop

---

## 9. Copilot Architecture

### 9.1 Tool-Router Design
The Copilot uses an **allowlisted-tool architecture**. It never executes model-generated SQL.

```
Question → language/intent routing → approved tool
→ Zod validation → RBAC/scope check
→ repository or analytics call → structured result
→ local Ollama explanation → citations/limitations → audit record
```

### 9.2 Supported Tools
- Overview, trends, district/station summaries
- Comparisons, hotspots, spikes
- Repeat-link profiles, case network
- MO similarity, delays, risk areas
- Data quality, intelligence briefs

### 9.3 Response Format
Every Copilot response contains:
- `answer` — Natural language answer
- `toolUsed` — Which analytical tool was invoked
- `filters` — Active filters applied
- `dataPeriod` — Date range of source data
- `recordCount` — Number of records consulted
- `sourceList` — Data sources used
- `confidence` — Confidence level
- `limitations` — Known limitations
- `followUpSuggestions` — Suggested next questions

### 9.4 Model Configuration

| Role | Recommended Model | Fallback |
|---|---|---|
| Main analyst | `qwen3:8b` | `llama3.2:3b` |
| Dashboard planner | `qwen3:8b` | — |
| Chatbot | `qwen3:8b` | `llama3.2:3b` |
| Validators | `qwen3:4b` | — |
| Fast chat | `llama3.2:3b` | — |
| Embeddings | `nomic-embed-text` | — |

---

## 10. Security & RBAC

### 10.1 Authentication
- Local PostgreSQL-backed accounts only
- Passwords hashed with bcrypt
- Short-lived signed JWTs for access tokens
- Rotating refresh tokens, hashed in DB, delivered as HTTP-only cookies
- Passwords, raw tokens, and identity hashes never logged or returned

### 10.2 Roles & Permissions

| Role | Scope |
|---|---|
| `STATE_ADMIN` | All districts, user management, audit access |
| `SCRB_ANALYST` | State aggregate intelligence with masking |
| `DISTRICT_OFFICER` | Assigned district only |
| `STATION_OFFICER` | Assigned station only |
| `INVESTIGATOR` | Assigned cases only |
| `EVALUATOR` | Synthetic read-only, masked identities |
| `AUDITOR` | Audit/report metadata |
| `DATA_ENGINEER` | Imports and data-quality workflow |

Authorization applies both **permission** and **district/station/case scope**. The frontend hides inapplicable navigation, but the backend is the enforcement point.

### 10.3 Security Controls
- Zod validation at all HTTP boundaries
- Parameterized SQL (no string interpolation)
- Request IDs on all requests
- Structured sanitised error responses
- Body/upload size limits
- Filename and file-type validation
- Rate limiting
- Explicit CORS allowlist
- Masked serializers for evaluator/aggregate roles (no raw contact data, addresses, DOBs, hashes, victim/complainant details)
- Audited events: login/logout/failure, sensitive views, network requests, report ops, imports, corrections, reviews, role changes

---

## 11. Analytics Methods

### 11.1 Hotspot Detection
- **Method:** DBSCAN (PostGIS where available, haversine in FastAPI)
- **Requirements:** Minimum incident count threshold
- **Output:** Centroid, categories, period, baseline, confidence, evidence

### 11.2 Emerging Alerts
- **Window:** Current 7-day vs rolling 28-day baseline
- **Metrics:** Minimum volume, percentage increase, robust z-score
- **Grouping:** By district/station/category/daypart
- **Deduplication:** Key-based dedup to prevent alert fatigue

### 11.3 Anomaly Detection
- **Univariate:** IQR and z-score baselines
- **Multivariate:** Isolation Forest (optional)
- **Output:** Model/version, top factors, data freshness, review state

### 11.4 Risk Scoring
- **Type:** Transparent aggregate geographic composite
- **Scope:** District/station forecasting
- **Transparency:** Weights, model version, factors, confidence, limitations persisted
- **Boundary:** Never a personal risk or guilt score

### 11.5 Case Network Analysis
- **Library:** NetworkX
- **Metrics:** Degree, betweenness centrality, PageRank, components, communities, common neighbours, cross-district bridges
- **Edge evidence:** Every edge carries case evidence

### 11.6 MO Similarity
- **Structured:** Exact matches on structured MO fields
- **Weighted Jaccard:** On categorical MO attributes
- **Trigram:** Text similarity on free-text MO descriptions
- **Embeddings:** Optional local model (nomic-embed-text)
- **Output:** Matched features with evidence links

### 11.7 Socioeconomic Research
- **Type:** Aggregate correlations only
- **Label:** Explicitly non-causal
- **Boundary:** Never feeds predictive models

### 11.8 Explainability Standard
Every analytical output includes:
- What was detected
- Why it was detected
- Source data and period
- Record count
- Algorithm/model version
- Confidence level
- Limitations
- Human-review status

---

## 12. PDF Intelligence

### 12.1 Pipeline
```
apps/ml-service/pdf_intelligence/
├── pdf_intelligence_engine.py   # Main engine orchestrator
├── pdf_detector.py              # Document type/quality detection
├── pdf_text_extractor.py        # Text extraction
├── pdf_table_extractor.py       # Table extraction
├── pdf_ocr_engine.py            # OCR for scanned documents
├── pdf_chunker.py               # Semantic chunking
├── pdf_summarizer.py            # Summarization
├── messy_text_cleaner.py        # Text cleaning
├── messy_table_cleaner.py       # Table cleaning
└── __init__.py
```

### 12.2 Capabilities
- Text extraction from digital PDFs
- OCR for scanned documents
- Table extraction with structure preservation
- Semantic chunking for LLM context windows
- Summarization with key findings
- Quality detection (document type, clarity assessment)
- Cleaning of messy text and table extractions

---

## 13. AI Provider Routing

### 13.1 Provider Priority
The system automatically selects the best available AI model:

1. **Gemini (Google)** — Default if `GOOGLE_API_KEY` configured
2. **Claude (Anthropic)** — Fallback if `ANTHROPIC_API_KEY` configured
3. **GPT-4 (OpenAI)** — Fallback if `OPENAI_API_KEY` configured
4. **Ollama (Local)** — Works offline, default for local setups
5. **Local Analysis** — Always available, deterministic fallback

### 13.2 Provider Configuration
Providers are configured via environment variables only, never exposed in frontend code. Cloud provider values can remain blank for local-only operation.

### 13.3 Local Model Defaults
- Primary: Ollama (`http://localhost:11434`)
- Default model: `qwen3:4b` (small), `qwen3:8b` (full)
- Fallback: `llama3.2:3b`

---

## 14. API Reference

### 14.1 Health
```
GET /api/health
→ { status: "healthy", version: "...", uptime: ... }
```

### 14.2 Authentication
```
POST /api/auth/login    → { token, refreshToken, user }
POST /api/auth/refresh  → { token, refreshToken }
POST /api/auth/logout   → { success: true }
```

### 14.3 Datasets
```
GET    /api/datasets              → List all datasets
GET    /api/datasets/current      → Current active dataset
POST   /api/datasets/demo         → Load demo dataset
POST   /api/datasets/import       → Import dataset (CSV rows body)
GET    /api/datasets/:id          → Get dataset by ID
GET    /api/datasets/:id/schema   → Get dataset schema/profile
DELETE /api/datasets/:id          → Delete dataset
```

### 14.4 Analytics
```
GET /api/datasets/:id/ai/profile        → Full data profile
GET /api/datasets/:id/ai/anomalies      → Anomaly detection
GET /api/datasets/:id/ai-correlations   → Correlation analysis
GET /api/datasets/:id/ai/distribution   → Distribution charts
GET /api/datasets/:id/ai/trends         → Trend analysis
```

### 14.5 Chat
```
POST /api/datasets/:id/chat
Body: { query: "What is the average age?" }
→ { answer, confidence, toolUsed, ... }
```

### 14.6 KAVACH Intelligence
```
GET  /api/kavach/overview           → Dashboard overview
GET  /api/kavach/hotspots           → Crime hotspots
GET  /api/kavach/alerts             → Emerging alerts
GET  /api/kavach/anomalies          → Anomaly results
GET  /api/kavach/risk               → Risk assessment
GET  /api/kavach/networks           → Case networks
GET  /api/kavach/mo-similarity      → MO pattern matches
GET  /api/kavach/trends             → Temporal trends
GET  /api/kavach/intelligence-brief → Full intelligence brief
```

### 14.7 Agentic AI
```
POST /api/agentic/analyze       → Run full agentic pipeline
POST /api/agentic/chat          → Agentic chat with context
POST /api/agentic/dashboard     → Generate AI dashboard
POST /api/agentic/schema        → Schema analysis
```

### 14.8 ML Service (FastAPI :5000)
```
GET    /health                     → Health check
POST   /analytics/hotspots         → Hotspot detection
POST   /analytics/anomalies        → Anomaly detection
POST   /analytics/alerts           → Emerging alerts
POST   /analytics/risk             → Risk scoring
POST   /analytics/networks         → Network analysis
POST   /analytics/mo-similarity    → MO similarity
POST   /analytics/socioeconomic    → Socioeconomic research
POST   /pdf/intelligence           → PDF analysis
```

### 14.9 Other
```
GET  /api/export/:id          → Export dataset (JSON/CSV/MD)
POST /api/upload              → Upload file (CSV/XLSX/PDF)
POST /api/qr-upload           → QR-code-based upload
GET  /api/ml/models           → List trained models
POST /api/ml/train            → Train model
POST /api/ml/predict          → Make predictions
```

---

## 15. Deployment Guide

### 15.1 Prerequisites
- Docker Desktop/Engine (for PostgreSQL/PostGIS)
- Node.js 20+ (Node 22+ recommended)
- Python 3.10+
- (Optional) Ollama for local LLM

### 15.2 Quick Start
```bash
# Install dependencies
npm install

# Configure environment
copy .env.example .env
# Set SEED_ADMIN_PASSWORD in .env

# Set up Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
source .venv/bin/activate       # macOS/Linux
pip install -r apps/ml-service/requirements.txt

# Start PostgreSQL
npm run db:up

# Run migrations & seed
npm run db:migrate
npm run db:seed
npm run db:migrate-demo

# (Optional) Pull local LLM
ollama pull qwen3:4b

# Start all services
npm run dev:full
```

### 15.3 Access Points
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| ML Service | http://localhost:5000/health |
| Ollama | http://localhost:11434 |

### 15.4 Useful Commands
```bash
npm run db:down              # Stop PostgreSQL
npm run db:reset             # Reset database
npm run lint                 # Run linting
npm run test:backend         # Run backend tests
npm run test:frontend        # Run frontend tests
npm run test:integration     # Integration tests
npm run test:e2e             # Playwright E2E tests
npm run test:e2e:kavach      # KAVACH-specific E2E
npm run build                # Build for production
npm run qa:report            # Generate QA report
```

### 15.5 Production Boundary
Production deployment requires:
- Approved network design with TLS termination
- Secret manager for credentials
- Least-privilege database role
- Independent security assessment
- Legal/privacy review
- Formal model validation
- Monitoring, backup, disaster recovery
- Human-review operations process
- Managed public demo hosting is out of scope

---

## 16. Testing

### 16.1 Test Types

| Type | Tool | Command |
|---|---|---|
| Unit (backend) | Vitest | `npm run test:backend` |
| Unit (frontend) | Vitest | `npm run test:frontend` |
| Integration | Vitest | `npm run test:integration` |
| E2E | Playwright | `npm run test:e2e` |
| AI Provider | Vitest | `npm run test:ai` |
| RAG Retrieval | Vitest | `npm run test:rag` |
| Dashboard Guardian | Vitest | `npm run test:guardian` |
| API Verification | Custom | `npm run test:insightflow-api` |
| KAVACH E2E | Playwright | `npm run test:e2e:kavach` |

### 16.2 E2E Test Specs (Playwright)
Located in `e2e/`:
- `agentic-ai-full-flow.spec.ts` — Full agentic AI pipeline
- `ai-dashboard-command-flow.spec.ts` — AI dashboard commands
- `ai-provider-fallback.spec.ts` — AI provider fallback
- `analytics-schema-flow.spec.ts` — Schema analytics flow
- `dashboard-ai-schema-command-flow.spec.ts` — Schema commands
- `dashboard-chat-custom-chart.spec.ts` — Custom chart chats
- `dashboard-upload-flow.spec.ts` — Upload flow
- `geo-intelligence-flow.spec.ts` — Geo intelligence
- `invalid-dashboard-request.spec.ts` — Error handling
- `kavach.spec.ts` — KAVACH core flow
- `pdf-intelligence-flow.spec.ts` — PDF intelligence
- `schema-only-safety.spec.ts` — Schema safety
- `upload-dashboard-flow.spec.ts` — Upload to dashboard

### 16.3 QA Tooling
Located in `tools/qa/`:
- `generate-final-qa-report.mjs` — Final QA report generator
- `generate-software-report.mjs` — Software quality report
- `software-quality-checklist.json` — Quality checklist
- `manual-qa-checklist.md` — Manual QA steps
- `bug-report-template.md` — Bug report template
- `run-playwright-e2e.mjs` — E2E runner
- `live-browser-validation.mjs` — Live browser validation
- `report-template.html` — HTML report template

---

## 17. Configuration Reference

### 17.1 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend port |
| `NODE_ENV` | `development` | Environment mode |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `KAVACH_DATA_SOURCE` | `postgres` | Data source mode (`postgres` or `file-demo`) |
| `JWT_ACCESS_SECRET` | — | JWT signing secret (access tokens) |
| `JWT_REFRESH_SECRET` | — | JWT signing secret (refresh tokens) |
| `CORS_ALLOWED_ORIGINS` | — | Explicit CORS origins |
| `SEED_ADMIN_EMAIL` | — | Admin seed email |
| `SEED_ADMIN_PASSWORD` | — | Admin seed password |
| `GOOGLE_API_KEY` | — | Google Gemini API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `LOG_LEVEL` | `info` | Logging level |

### 17.2 Docker Compose
```yaml
# infra/docker-compose.yml
# Starts: postgis/postgis:16-3.4
# Volume: named local volume (persistent)
# Config: UTF-8 init, Asia/Kolkata timezone, UTC timestamps
```

---

## 18. Safety Boundaries

KAVACH AI is designed with explicit ethical and safety constraints:

### 18.1 What It Does NOT Do
- ❌ Predict individual guilt or innocence
- ❌ Recommend arrest or enforcement actions
- ❌ Use biometric matching
- ❌ Use caste, religion, or gender as predictive features
- ❌ Execute model-generated SQL
- ❌ Expose raw PII to non-authorized roles
- ❌ Operate as an internet-facing production system

### 18.2 Data Handling
- All people and cases in the demo are **synthetic**
- Person labels describe case roles and links only
- Evaluator and aggregate roles receive **masked identities**
- Religion and caste compatibility tables exist but are **never used** as risk, hotspot, network, or predictive features

### 18.3 Required Warnings
- All intelligence outputs require **human verification**
- Must not be used as the sole basis for law-enforcement action
- Socioeconomic correlations are explicitly labelled **non-causal**

---

## 19. Future Production Work

Production readiness requires:

| Area | Requirements |
|---|---|
| **Governance** | Government-controlled deployment |
| **Security** | Independent security assessment, TLS, secret manager |
| **Privacy** | Legal/privacy review, DPIA |
| **Models** | Formal model validation, bias testing |
| **Data** | Verified KSP source mapping |
| **Operations** | Monitoring, alerting, backup/DR |
| **Process** | Explicit human-review operations, SOPs |
| **Access** | Least-privilege DB roles, network segmentation |

---

## 20. Appendix: Key Files & Their Purposes

### Root Configuration
| File | Purpose |
|---|---|
| `package.json` | Workspace root, defines all monorepo packages & scripts |
| `playwright.config.ts` | E2E test configuration |
| `vercel.json` | Vercel deployment config |
| `gemini-config.js` | Gemini AI configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |

### Key Scripts
| File | Purpose |
|---|---|
| `scripts/migrate-kavach-demo-to-postgres.mjs` | Demo data migration |
| `scripts/seed-kavach.mjs` | KAVACH seed data |
| `scripts/run-kavach-e2e.mjs` | KAVACH E2E runner |
| `scripts/verify-insightflow-backend.mjs` | Backend verification |
| `scripts/audit-codebase.js` | Codebase audit |
| `scripts/export-ai-safe.js` | AI-safe export |
| `scripts/generate-codebase-export.mjs` | Full codebase export |

### Documentation Root Files
| File | Purpose |
|---|---|
| `README.md` | Main project readme |
| `PROJECT_ARCHITECTURE.md` | System architecture overview |
| `IMPLEMENTATION_NOTES.md` | Implementation details |
| `DEPLOY.md` | Deployment instructions |
| `QUICK_START.md` | Quick start guide |
| `QUICK_REFERENCE.md` | Quick reference |
| `FEATURE_CHECKLIST.md` | Feature completion checklist |
| `TESTING_DOCUMENTATION.md` | Testing documentation |
| `COMPREHENSIVE_DOCS.md` | This file |

### KAVACH-Specific Documentation (`agentics-ai/`)
| File | Purpose |
|---|---|
| `AGENTIC_ANALYTICS_ARCHITECTURE.txt` | Agentic AI architecture |
| `PROJECT_STRUCTURE.txt` | Project structure map |
| `SETUP.txt` | Setup instructions |
| `LLM_PROVIDERS.txt` | LLM provider configuration |
| `BUG_REPORT.txt` | Bug report format |

### E2E Test Specs
| File | Feature Under Test |
|---|---|
| `e2e/agentic-ai-full-flow.spec.ts` | Full agentic pipeline |
| `e2e/ai-dashboard-command-flow.spec.ts` | Dashboard AI commands |
| `e2e/ai-provider-fallback.spec.ts` | Provider fallback |
| `e2e/analytics-schema-flow.spec.ts` | Schema analytics |
| `e2e/dashboard-ai-schema-command-flow.spec.ts` | Schema dashboard commands |
| `e2e/dashboard-chat-custom-chart.spec.ts` | Chat + custom charts |
| `e2e/dashboard-upload-flow.spec.ts` | Upload to dashboard |
| `e2e/geo-intelligence-flow.spec.ts` | Geo intelligence |
| `e2e/invalid-dashboard-request.spec.ts` | Error handling |
| `e2e/kavach.spec.ts` | KAVACH core |
| `e2e/pdf-intelligence-flow.spec.ts` | PDF intelligence |
| `e2e/schema-only-safety.spec.ts` | Schema safety |
| `e2e/upload-dashboard-flow.spec.ts` | Upload flow |

---

*Generated from `COMPREHENSIVE_DOCS.md` — covers KAVACH AI / InsightFlow 1.0.0*
*Last updated: July 2026*

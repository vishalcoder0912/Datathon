# Agentic AI Data Analysis Architecture

## Goal

Transform InsightFlow into a fully agentic, schema-first AI data analysis platform.

When a user uploads any dataset, small or huge, the backend should not blindly load the whole file into memory or send raw rows to the LLM. The system should extract schema, profile the dataset safely, choose the correct processing pipeline, store schema/profile in the database, retrieve similar schema memories through RAG, generate a master dashboard, and let the user chat with the dataset through safe backend tools.

The LLM should plan and explain. The backend should calculate and retrieve.

---

## Target User Flow

1. User uploads a dataset.
2. Backend stores the original file.
3. Backend extracts schema and profile using streaming or query-engine scanning.
4. Backend stores schema, profile, file metadata, and selected pipeline in DB.
5. Backend retrieves similar schema/dashboard patterns from RAG memory.
6. Agent planner creates dashboard plan: KPIs, charts, filters, insights.
7. Guardian validates every KPI/chart/action against schema.
8. Deterministic executor calculates dashboard values from the dataset.
9. Dashboard artifact is persisted.
10. Frontend renders dashboard from the persisted artifact.
11. User asks questions in side chat.
12. AI converts the prompt into a validated query/action.
13. Backend safely retrieves or calculates only the needed result.
14. AI explains the result and can update dashboard artifacts if requested.

---

## Core Principle

```text
LLM = planner, analyst, narrator, and tool caller.
Backend = schema profiler, SQL validator, query executor, calculator, dashboard artifact manager.
```

The LLM must never directly access the full raw dataset.

---

## High-Level Architecture

```text
Upload
  -> File Storage
  -> Schema Profiler
  -> Schema Registry DB
  -> Pipeline Router
  -> RAG Memory Retrieval
  -> Agentic Dashboard Planner
  -> Dashboard Guardian
  -> Deterministic SQL/Analytics Executor
  -> Dashboard Artifact Store
  -> Frontend Dashboard
  -> Side Chat Agent
  -> Safe SQL Tool Gateway
```

---

## Backend Modules To Add Or Consolidate

Recommended structure:

```text
apps/backend/src/
├── routes/
│   └── agentic.routes.js
├── services/
│   ├── ingestion/
│   │   ├── upload-service.js
│   │   ├── file-storage-service.js
│   │   └── dataset-job-service.js
│   ├── schema/
│   │   ├── schema-profiler.js
│   │   ├── column-role-detector.js
│   │   ├── schema-fingerprint.js
│   │   └── schema-registry.js
│   ├── pipeline/
│   │   ├── pipeline-router.js
│   │   ├── pipeline-registry.js
│   │   └── pipeline-executor.js
│   ├── rag/
│   │   ├── schema-rag-index.js
│   │   ├── schema-memory-store.js
│   │   └── dashboard-pattern-retriever.js
│   ├── agentic/
│   │   ├── agent-orchestrator.js
│   │   ├── schema-analyst-agent.js
│   │   ├── dashboard-planner-agent.js
│   │   ├── sql-planner-agent.js
│   │   ├── insight-narrator-agent.js
│   │   └── feedback-learning-agent.js
│   ├── guardian/
│   │   ├── dashboard-guardian.js
│   │   ├── sql-guardian.js
│   │   └── tool-call-guardian.js
│   ├── query/
│   │   ├── safe-sql-gateway.js
│   │   ├── query-executor.js
│   │   ├── calculation-engine.js
│   │   └── result-summarizer.js
│   └── dashboard/
│       ├── dashboard-artifact-store.js
│       ├── dashboard-widget-executor.js
│       └── dashboard-update-service.js
```

---

## Canonical API Routes

Create one clean route family instead of many competing AI/dashboard route systems.

```text
POST /api/datasets/upload
GET  /api/datasets/:id/schema
GET  /api/datasets/:id/profile
GET  /api/datasets/:id/dashboard

POST /api/agentic/datasets/:id/dashboard/generate
POST /api/agentic/datasets/:id/chat
POST /api/agentic/datasets/:id/query-plan
POST /api/agentic/datasets/:id/execute
POST /api/agentic/datasets/:id/feedback
GET  /api/agentic/runs/:runId
```

Old routes can remain temporarily as adapters, but the frontend should use the canonical route family.

---

## Database Schema

Minimum required persistent entities:

```text
datasets
- id
- name
- original_file_name
- file_type
- size_bytes
- row_count
- status
- selected_pipeline
- storage_path
- optimized_path
- created_at
- updated_at

dataset_schemas
- id
- dataset_id
- schema_fingerprint
- schema_json
- profile_json
- domain
- quality_score
- created_at

column_profiles
- id
- dataset_id
- column_name
- detected_type
- semantic_role
- null_pct
- unique_count
- sample_values_json
- stats_json

dashboard_artifacts
- id
- dataset_id
- version
- dashboard_json
- generated_by_run_id
- status
- created_at

agent_runs
- id
- dataset_id
- run_type
- input_json
- output_json
- model
- provider
- status
- raw_rows_sent
- created_at

agent_tool_calls
- id
- agent_run_id
- tool_name
- input_json
- output_json
- status
- duration_ms
- created_at

rag_memories
- id
- dataset_id
- schema_fingerprint
- memory_type
- content_json
- embedding_id
- rating
- created_at

chat_messages
- id
- dataset_id
- role
- content
- metadata_json
- created_at
```

---

## Schema Profiler

The schema profiler should work no matter how large the dataset is.

Responsibilities:

- Read file by streaming or query-engine scan.
- Infer columns.
- Detect column types.
- Detect column roles.
- Detect possible dataset domain.
- Compute safe profile metadata.
- Create schema fingerprint.
- Store schema and profile in DB.

Column role examples:

```text
metric
category
date
geo
identifier
text
boolean
currency
percentage
target
```

Safe profile output:

```json
{
  "datasetId": "ds_123",
  "rowCount": 5000000,
  "columnCount": 12,
  "domain": "sales",
  "qualityScore": 91.4,
  "columns": [
    {
      "name": "Revenue",
      "type": "number",
      "role": "metric",
      "nullPct": 0.2,
      "min": 0,
      "max": 500000,
      "avg": 8420.44
    }
  ]
}
```

---

## Pipeline Router

Each dataset should get a different backend pipeline depending on schema, size, and domain.

Example pipeline IDs:

```text
small-csv-memory
large-csv-duckdb
excel-multi-sheet
json-flattened
pdf-table-rag
sales-dashboard
hr-dashboard
finance-dashboard
geo-intelligence
time-series
text-heavy-rag
generic-exploration
```

Pipeline selector input:

```json
{
  "fileType": "csv",
  "rowCount": 5000000,
  "sizeBytes": 800000000,
  "domain": "sales",
  "roles": {
    "metrics": ["Revenue", "Profit"],
    "dimensions": ["Region", "Product"],
    "dates": ["OrderDate"]
  }
}
```

Pipeline selector output:

```json
{
  "pipelineId": "large-csv-duckdb",
  "executionEngine": "duckdb",
  "dashboardStrategy": "sales-dashboard",
  "queryMode": "safe-sql-tool",
  "requiresVectorIndex": false
}
```

---

## RAG Memory

RAG should store and retrieve schema/dashboard patterns, not raw data.

Store memories for:

- schema fingerprint
- dataset domain
- column roles
- accepted dashboard plans
- accepted KPI patterns
- accepted chart patterns
- successful chat query plans
- user feedback

RAG flow:

1. Build schema packet.
2. Retrieve similar schema memories.
3. Send schema packet + top memories to planner.
4. Planner creates dashboard plan.
5. Guardian validates plan.
6. Executor calculates values.
7. Accepted dashboard trains memory.

---

## Agent Roles

### 1. Schema Analyst Agent

Reads schema/profile only and explains what kind of dataset this is.

### 2. Pipeline Selector Agent

Chooses the best pipeline based on schema, size, type, and domain.

### 3. Dashboard Planner Agent

Creates KPI/chart/filter plan from schema and RAG memory.

### 4. SQL Planner Agent

Converts user prompts into SQL/action plans.

### 5. SQL Guardian Agent

Validates SQL before execution.

### 6. Calculation Executor

Runs safe SQL, aggregations, and calculations.

### 7. Insight Narrator Agent

Turns results into clear business insight.

### 8. Feedback Learning Agent

Stores accepted dashboards and query plans as reusable memories.

---

## Safe SQL Gateway

The AI can propose SQL, but only the backend gateway can execute it.

Allowed:

```text
SELECT
WHERE
GROUP BY
ORDER BY
LIMIT
COUNT
SUM
AVG
MIN
MAX
MEDIAN
safe date grouping
safe calculated fields
```

Blocked:

```text
INSERT
UPDATE
DELETE
DROP
ALTER
TRUNCATE
unbounded SELECT * on large datasets
unknown columns
unknown tables
internal system tables
```

SQL execution flow:

```text
User prompt
  -> schema/profile prompt
  -> SQL planner
  -> SQL guardian
  -> query executor
  -> result validator
  -> insight narrator
```

Example response:

```json
{
  "answer": "North region generated the highest revenue with 32% of total sales.",
  "sql": "SELECT Region, SUM(Revenue) AS total_revenue FROM dataset GROUP BY Region ORDER BY total_revenue DESC LIMIT 10",
  "result": [
    { "Region": "North", "total_revenue": 1200000 }
  ],
  "audit": {
    "rawRowsSentToLLM": false,
    "sqlValidated": true,
    "executionEngine": "duckdb"
  }
}
```

---

## Dashboard Generation

After upload, automatically generate a master dashboard.

Dashboard should include:

- KPI cards
- trend charts
- category comparison charts
- distribution charts
- correlation/scatter charts where valid
- outlier summary
- data quality summary
- AI executive summary
- recommended questions

Dashboard artifact example:

```json
{
  "datasetId": "ds_123",
  "version": 1,
  "kpis": [
    {
      "id": "total_revenue",
      "title": "Total Revenue",
      "metric": "Revenue",
      "aggregation": "sum",
      "value": 12000000
    }
  ],
  "charts": [
    {
      "id": "revenue_by_region",
      "type": "bar",
      "title": "Revenue by Region",
      "sql": "SELECT Region, SUM(Revenue) AS Revenue FROM dataset GROUP BY Region ORDER BY Revenue DESC LIMIT 10"
    }
  ],
  "insights": [],
  "audit": {
    "rawRowsSentToLLM": false,
    "validated": true
  }
}
```

---

## Chat Side Panel

The side chat should support:

- Ask data questions.
- Generate new charts.
- Add/remove/update KPIs.
- Apply filters.
- Explain anomalies.
- Compare segments.
- Calculate business metrics.
- Save useful outputs to dashboard.

Chat flow:

```text
User: Show revenue by region for last quarter
AI planner: creates SQL/action plan
SQL guardian: validates columns and query type
Executor: runs query
Narrator: explains result
Dashboard updater: optionally adds chart
```

---

## Frontend Requirements

Frontend should not depend on full rows for large datasets.

Add or update hooks:

```text
useDatasetUploadJob
useDatasetSchema
useAgenticDashboard
useAgenticChat
useDashboardArtifact
```

Frontend should receive:

- schema summary
- dashboard artifact
- chart result sets
- chat answer
- execution audit
- job status

Frontend should not receive huge raw row arrays.

---

## Implementation Phases

### Phase 1: Stabilize Current Repo

- Fix ML service port mismatch.
- Fix shared package path.
- Make CI fail on lint/typecheck/test/build errors.
- Remove duplicate frontend data state.
- Verify every frontend API route has a backend handler.

### Phase 2: Schema-First Backend

- Add schema registry.
- Add streaming schema profiler.
- Store schema/profile in DB.
- Add dataset pipeline records.
- Add dataset upload job tracking.

### Phase 3: Pipeline Router

- Build pipeline selector.
- Add dataset domain detector.
- Add execution policy per dataset.
- Route large datasets to query engine instead of memory.

### Phase 4: Agentic Dashboard

- Add canonical agentic routes.
- Add dashboard planner agent.
- Add dashboard guardian.
- Add deterministic dashboard executor.
- Persist dashboard artifacts.

### Phase 5: Safe Chat + SQL Tools

- Add SQL planner.
- Add SQL guardian.
- Add safe SQL gateway.
- Add calculation executor.
- Add query result summarizer.
- Store chat and tool-call audit logs.

### Phase 6: RAG Feedback Memory

- Store accepted dashboard patterns.
- Store successful query plans.
- Retrieve similar schema patterns on new dataset upload.
- Improve dashboard recommendations from feedback.

### Phase 7: Production Hardening

- Add auth and workspace scoping.
- Add upload limits.
- Add query timeouts.
- Add CORS production lock.
- Add test coverage for full flow.

---

## Acceptance Criteria

- Large dataset upload does not crash backend or frontend.
- Schema/profile is stored before dashboard generation.
- Dashboard generation works without sending raw rows to LLM.
- Different datasets select different pipelines.
- User chat creates validated SQL/action plans.
- SQL is validated before execution.
- AI can calculate results through tools.
- Dashboard can update from chat commands.
- Agent runs and tool calls are persisted.
- RAG memory improves future dashboard generation.

---

## Final Rule

Do not add more random dashboard routes until the canonical agentic flow exists.

Consolidation first. Features second. Otherwise this becomes another haunted monorepo with charts.

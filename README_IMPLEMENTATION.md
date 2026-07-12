# InsightFlow Schema-only Ollama AI Full Code

This bundle contains drop-in files for your existing InsightFlow architecture.

## Core rule

The LLM receives schema metadata only. It never receives full raw rows, never returns `chart.data`, and never invents KPI values.

Runtime flow:

```txt
Upload dataset
→ backend builds schema profile
→ schema memory finds similar dashboard pattern
→ Ollama returns KPI/chart/filter specs only
→ frontend/local analytics calculates real KPI/chart data from rows
→ dashboard renders real values
→ AI chat modifies dashboard by returning specs only
```

## Files to copy

Copy these files into the same paths in your project:

```txt
apps/backend/Modelfile.schema-analyst
apps/backend/.env.schema-ai.example
apps/backend/src/services/ai-analyst/schema-fingerprint.js
apps/backend/src/services/ai-analyst/dashboard-plan-engine.js
apps/backend/src/services/ai-analyst/schema-training-store.js
apps/backend/src/services/ai-analyst/llm-schema-dashboard-planner.js
apps/backend/src/services/ai-analyst/schema-trained-ai-service.js
apps/backend/src/routes/schema-trained-ai.routes.js
apps/backend/scripts/train-schema-dashboard-llm.js
apps/backend/scripts/export-schema-training-jsonl.js

apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts
apps/frontend/src/features/dashboard/utils/schemaLocalAnalytics.ts
apps/frontend/src/features/dashboard/utils/dynamicQuestionSuggestions.ts
apps/frontend/src/features/dashboard/hooks/useSchemaTrainedDashboard.ts
apps/frontend/src/features/dashboard/components/SchemaDashboardChat.tsx
```

## Route registration

Open:

```txt
apps/backend/src/routes/index.js
```

Add import:

```js
import { handleSchemaTrainedAIRoutes } from "./schema-trained-ai.routes.js";
```

Inside your main route handler, before older dashboard/chat routes:

```js
if (await handleSchemaTrainedAIRoutes(request, response, pathname)) {
  return;
}
```

If your project runs from `apps/backend/api/index.js` instead of `src/routes/index.js`, register the same handler there before older route logic.

## Ollama model

```bash
cd apps/backend
ollama create insightflow-schema-analyst -f Modelfile.schema-analyst
```

Add env:

```env
OLLAMA_BASE_URL=http://localhost:11434
DASHBOARD_LLM_MODEL=insightflow-schema-analyst
CHAT_LLM_MODEL=qwen3:8b
FALLBACK_LLM_MODEL=llama3.2
EMBEDDING_MODEL=nomic-embed-text
CODE_LLM_MODEL=qwen2.5-coder:7b
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_CONTEXT_LENGTH=4096
```

## Frontend usage

Inside your dashboard page:

```tsx
const schemaDashboard = useSchemaTrainedDashboard({
  datasetId: activeDataset.id,
  datasetName: activeDataset.name,
  rows: activeDataset.rows,
  columns: activeDataset.columns,
});

<SchemaDashboardChat
  columns={schemaDashboard.profile?.columns || []}
  messages={schemaDashboard.messages}
  loading={schemaDashboard.commandLoading}
  model={schemaDashboard.model}
  provider={schemaDashboard.provider}
  memoryMatch={schemaDashboard.memoryMatch}
  onSend={schemaDashboard.sendCommand}
/>
```

Use:

```tsx
schemaDashboard.kpis
schemaDashboard.charts
schemaDashboard.filteredRows
```

Render `schemaDashboard.charts` with your existing `SmartChartCard` or `AnalyticsChart`.

## Test commands

Check Ollama:

```bash
curl http://localhost:11434/api/tags
```

Check backend:

```bash
curl http://localhost:3001/api/health
```

Check schema memory:

```bash
curl http://localhost:3001/api/ai/schema-training-memory
```

Generate test dashboard:

```bash
curl -X POST http://localhost:3001/api/datasets/test-local/schema-dashboard \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Salary Test\",\"rows\":[{\"country\":\"India\",\"salary_usd\":50000,\"experience\":2},{\"country\":\"USA\",\"salary_usd\":90000,\"experience\":5},{\"country\":\"India\",\"salary_usd\":65000,\"experience\":3}],\"useLlm\":true}"
```

Dashboard command:

```bash
curl -X POST http://localhost:3001/api/datasets/test-local/dashboard-command \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Salary Test\",\"rows\":[{\"country\":\"India\",\"salary_usd\":50000,\"experience\":2},{\"country\":\"USA\",\"salary_usd\":90000,\"experience\":5},{\"country\":\"India\",\"salary_usd\":65000,\"experience\":3}],\"query\":\"show average salary_usd by country as bar chart\",\"useLlm\":true}"
```

Expected response includes:

```json
{
  "action": "GENERATE_CHART",
  "chartSpec": {
    "type": "bar",
    "xKey": "country",
    "yKey": "salary_usd",
    "aggregation": "avg"
  },
  "schemaOnly": true
}
```

# InsightFlow Schema-Trained AI Patch

This patch adds a **schema-trained AI analyst layer**.

It does not send raw dataset rows to the LLM. It stores and trains on:

- schema profile
- column roles
- domain
- accepted KPI templates
- accepted chart templates
- user feedback

Runtime flow:

```txt
Upload dataset
→ clean dictionary rows
→ generate schema profile
→ create schema signature/fingerprint
→ match with trained schema memory
→ build KPI/chart plan from trained templates + rules
→ optional Ollama planner improves the plan using schema only
→ frontend calculates values locally from filteredRows
→ user accepts/rejects dashboard
→ backend stores the schema pattern for next time
```

## Files in this patch

```txt
apps/backend/src/services/ai-analyst/schema-fingerprint.js
apps/backend/src/services/ai-analyst/dashboard-plan-engine.js
apps/backend/src/services/ai-analyst/llm-schema-dashboard-planner.js
apps/backend/src/services/ai-analyst/schema-training-store.js
apps/backend/src/services/ai-analyst/schema-trained-ai-service.js
apps/backend/src/routes/schema-trained-ai.routes.js
apps/backend/scripts/train-schema-dashboard-llm.js
apps/backend/scripts/export-schema-training-jsonl.js
apps/backend/Modelfile.schema-analyst
apps/backend/data/schema-training-memory.seed.json
apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts
apps/frontend/src/features/dashboard/hooks/useSchemaTrainedDashboard.ts
apps/frontend/src/features/dashboard/components/SchemaDashboardChat.tsx
```

## Backend route registration

Open:

```txt
apps/backend/src/routes/index.js
```

Add import:

```js
import { handleSchemaTrainedAIRoutes } from "./schema-trained-ai.routes.js";
```

Add this before older dashboard/chat routes so the new command route wins:

```js
if (await handleSchemaTrainedAIRoutes(request, response, pathname)) {
  return;
}
```

Your project already has many similar route handlers, so this follows your current route style.

## Seed/train the schema brain

Copy seed memory:

```bash
cd apps/backend
mkdir -p data
cp data/schema-training-memory.seed.json data/schema-training-memory.json
```

Train more datasets:

```bash
cd apps/backend
node scripts/train-schema-dashboard-llm.js ./training-datasets --export-jsonl
```

Or train using uploaded/imported dataset endpoint:

```bash
curl -X POST http://localhost:3001/api/datasets/<DATASET_ID>/schema-train \
  -H "Content-Type: application/json" \
  -d '{"rating":"good","dashboardPlan":{"kpis":[],"charts":[]}}'
```

## Create optional Ollama custom analyst model

This is not weight fine-tuning. It creates an Ollama model with a strong system prompt.
Actual learning is done by schema-memory + examples.

```bash
cd apps/backend
ollama create insightflow-schema-analyst -f Modelfile.schema-analyst
```

Then use:

```env
DASHBOARD_LLM_MODEL=insightflow-schema-analyst
CHAT_LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

## New endpoints

```txt
GET  /api/ai/schema-training-memory
POST /api/ai/schema-training/train-memory
POST /api/datasets/:id/schema-dashboard
POST /api/datasets/:id/schema-train
POST /api/datasets/:id/dashboard-command
POST /api/datasets/:id/schema-chat
```

`/schema-dashboard` returns KPI/chart specs generated from schema memory.
`/dashboard-command` powers dashboard chatbot commands.
`/schema-chat` powers general AI chat but still uses schema/profile + local stats, not raw-row LLM leakage.

## Frontend integration

Add the methods from:

```txt
apps/frontend/src/features/data/api/schemaTrainedApi.additions.ts
```

into your existing `api` object in `dataApi.ts`.

Then, after a dataset is uploaded/imported, call:

```ts
const result = await api.generateSchemaDashboard(dataset.id, true);
```

Use returned `dashboard.kpis` and `dashboard.charts` as dashboard specs. Your existing `dashboardAnalytics.ts` should calculate actual values from `filteredRows`.

## Important rule

Never trust LLM chart data.

Allowed from LLM:

```json
{
  "action": "GENERATE_CHART",
  "chartSpec": { "type": "bar", "xKey": "country", "yKey": "salary_usd", "aggregation": "avg" }
}
```

Not allowed:

```json
{
  "chart": { "data": [1, 2, 3] }
}
```

If an LLM returns data arrays, ignore them and rebuild from local rows.
